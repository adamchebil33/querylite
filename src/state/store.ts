import { create } from 'zustand';
import {
  cancelQuery,
  checkReadOnly,
  dropTable,
  errorMessage,
  friendlyError,
  getEngine,
  listTables,
  loadFile,
  loadRemoteParquet,
  runQuery,
  type QueryResult,
  type TableInfo,
} from '../db/engine';
import { readGenerateReply, type AiTask } from '../../shared/ai';
import { AiError, askAi } from '../lib/aiClient';
import { fileKind, quoteIdent, tableNameFor } from '../lib/files';
import { tablesMentioned } from '../lib/sql';
import { SAMPLES, sampleById } from '../samples';
import { decodeShare } from '../lib/share';
import { useLibrary } from './library';
import { nextSort, sortedSql, type SortSpec } from '../lib/sort';

export type EngineStatus =
  | { state: 'starting'; progress: number }
  | { state: 'ready' }
  | { state: 'error'; message: string };

export interface FileLoad {
  id: number;
  fileName: string;
  size: number;
  startedAt: number;
  /** Download progress between 0 and 1, when it can be measured. */
  progress?: number;
  error?: string;
}

export type QueryState =
  | { status: 'idle' }
  | { status: 'running'; startedAt: number }
  | {
      status: 'done';
      result: QueryResult;
      /** The query as the user ran it, without any sorting applied on top. */
      sql: string;
      sort: SortSpec | null;
      /** True if the database sorted the full result; false if the shown rows are sorted in place. */
      sortedByDatabase: boolean;
      /** Total rows in the tables the query read, for "over N rows". */
      scannedRows: number;
    }
  | { status: 'error'; message: string };

export interface AiState {
  /** The request in flight, if any. */
  busy: AiTask | null;
  notice: {
    tone: 'ok' | 'error';
    text: string;
    /** The SQL the AI just put in the editor; a Run button is offered while the editor still holds it. */
    sql?: string;
  } | null;
  /** Plain-English explanation of the current query. */
  explanation: string | null;
}

interface AppState {
  ai: AiState;
  /** Writes SQL for a plain-English question and puts it in the editor, without running it. */
  askAi: (question: string) => Promise<void>;
  explainSql: () => Promise<void>;
  /** Asks for a corrected version of the query that just failed. */
  fixError: () => Promise<void>;
  dismissAi: () => void;
  engine: EngineStatus;
  tables: TableInfo[];
  /** Files currently loading, plus failed ones until dismissed. */
  loads: FileLoad[];
  sql: string;
  query: QueryState;
  startEngine: () => void;
  addFiles: (files: File[]) => Promise<void>;
  /** Loads a built-in sample dataset and runs its first example question. */
  loadSample: (id: string, options?: { runFirstQuestion?: boolean }) => Promise<boolean>;
  /** Opens a share link: loads the samples it names, then shows and runs its SQL. */
  openSharedLink: (hash: string) => Promise<void>;
  removeTable: (name: string) => Promise<void>;
  dismissLoad: (id: number) => void;
  setSql: (sql: string) => void;
  /** Runs the given SQL, or the editor's contents if none is given. */
  run: (sql?: string) => Promise<void>;
  previewTable: (name: string) => Promise<void>;
  cancel: () => void;
  /** Sorts the result by a column; clicking again reverses, then clears. */
  sortBy: (column: number) => Promise<void>;
}

let loadId = 0;
let cancelled = false;

export const previewSql = (tableName: string) =>
  `SELECT * FROM ${/^[a-z_][a-z0-9_]*$/.test(tableName) ? tableName : quoteIdent(tableName)} LIMIT 100;`;

/** Statements that only read never change the list of tables. */
const isReadOnly = (sql: string) => /^\s*(select|with|from|describe|show|explain|summarize)\b/i.test(sql);

const aiMessage = (error: unknown) =>
  error instanceof AiError ? error.message : 'AI is unavailable right now. Everything else still works.';

/**
 * Gets SQL from the AI and, only if DuckDB confirms it is a single read-only
 * query, puts it in the editor for the user to review. It is never run here.
 */
async function offerAiSql(task: 'generate' | 'fix', input: { question?: string; sql?: string; error?: string }) {
  const { setState: set, getState: get } = useApp;
  const done = (notice: AiState['notice']) => set({ ai: { busy: null, notice, explanation: null } });
  set({ ai: { busy: task, notice: null, explanation: null } });
  try {
    const reply = await askAi(task, get().tables, input);
    const answer = task === 'generate' ? readGenerateReply(reply) : { kind: 'sql' as const, sql: reply };
    if (answer.kind === 'none') {
      done({ tone: 'error', text: `AI did not write SQL for that: ${answer.reason}` });
      return;
    }
    const sql = answer.sql;
    const check = await checkReadOnly(sql);
    if (!check.ok) {
      done({
        tone: 'error',
        text: `The AI's answer was not a single read-only query, so it was discarded. Try rephrasing. (${check.reason})`,
      });
      return;
    }
    set({ sql });
    done({
      tone: 'ok',
      sql,
      text:
        task === 'fix'
          ? 'AI suggested a fix and put it in the editor above. Review it before running it.'
          : `AI wrote SQL for “${input.question?.trim()}” and put it in the editor above. Review it before running it.`,
    });
  } catch (error) {
    done({ tone: 'error', text: aiMessage(error) });
  }
}

export const useApp = create<AppState>((set, get) => ({
  engine: { state: 'starting', progress: 0 },
  tables: [],
  loads: [],
  sql: '',
  query: { status: 'idle' },

  ai: { busy: null, notice: null, explanation: null },

  askAi: async (question) => {
    if (!question.trim() || get().ai.busy) return;
    await offerAiSql('generate', { question });
  },

  fixError: async () => {
    const query = get().query;
    if (query.status !== 'error' || get().ai.busy) return;
    await offerAiSql('fix', { sql: get().sql, error: query.message });
  },

  explainSql: async () => {
    const sql = get().sql.trim();
    if (!sql || get().ai.busy) return;
    set({ ai: { busy: 'explain', notice: null, explanation: null } });
    try {
      const explanation = await askAi('explain', get().tables, { sql });
      set({ ai: { busy: null, notice: null, explanation } });
    } catch (error) {
      set({ ai: { busy: null, notice: { tone: 'error', text: aiMessage(error) }, explanation: null } });
    }
  },

  dismissAi: () => set((s) => ({ ai: { ...s.ai, notice: null, explanation: null } })),

  startEngine: () => {
    set({ engine: { state: 'starting', progress: 0 } });
    getEngine((progress) => {
      if (get().engine.state === 'starting') set({ engine: { state: 'starting', progress } });
    }).then(
      () => set({ engine: { state: 'ready' } }),
      (error) => set({ engine: { state: 'error', message: friendlyError(error) } }),
    );
  },

  addFiles: async (files) => {
    // Reserve table names up front so files dropped together never collide.
    const reserved = new Set(get().tables.map((t) => t.name));
    const jobs = files.map((file) => {
      const load: FileLoad = {
        id: ++loadId,
        fileName: file.name,
        size: file.size,
        startedAt: Date.now(),
      };
      const kind = fileKind(file.name);
      if (!kind) {
        load.error = 'Unsupported file type. Use CSV, TSV, JSON, Parquet or Excel (.xlsx).';
        return { load };
      }
      const tableName = tableNameFor(file.name, reserved);
      reserved.add(tableName);
      return { load, file, kind, tableName };
    });
    set((s) => ({ loads: [...s.loads, ...jobs.map((j) => j.load)] }));

    // One at a time: DuckDB runs statements serially on a connection anyway.
    for (const job of jobs) {
      if (!job.file) continue;
      try {
        const table = await loadFile(job.file, job.kind, job.tableName);
        set((s) => ({
          tables: [...s.tables, table],
          loads: s.loads.filter((l) => l.id !== job.load.id),
        }));
        // Show the first loaded data right away if the user hasn't written anything yet.
        if (get().sql.trim() === '' && get().query.status !== 'running') {
          void get().previewTable(table.name);
        }
      } catch (error) {
        set((s) => ({
          loads: s.loads.map((l) =>
            l.id === job.load.id ? { ...l, error: friendlyError(error) } : l,
          ),
        }));
      }
    }
  },

  loadSample: async (id, { runFirstQuestion = true } = {}) => {
    const sample = sampleById(id);
    if (!sample) return false;
    const patch = (loadIdToPatch: number, change: Partial<FileLoad>) =>
      set((s) => ({
        loads: s.loads.map((l) => (l.id === loadIdToPatch ? { ...l, ...change } : l)),
      }));

    let failed = false;
    for (const table of sample.tables) {
      const existing = get().tables.find((t) => t.name === table.name);
      if (existing?.source === sample.name) continue; // already loaded
      const load: FileLoad = {
        id: ++loadId,
        fileName: `${sample.name}: ${table.name}`,
        size: 0,
        startedAt: Date.now(),
        progress: 0,
      };
      set((s) => ({ loads: [...s.loads, load] }));
      if (existing) {
        patch(load.id, {
          error: `A table named "${table.name}" already exists. Remove it to load this sample.`,
        });
        failed = true;
        continue;
      }
      try {
        const info = await loadRemoteParquet(table.file, table.name, sample.name, (progress) =>
          patch(load.id, { progress }),
        );
        set((s) => ({
          tables: [...s.tables, info],
          loads: s.loads.filter((l) => l.id !== load.id),
        }));
      } catch (error) {
        patch(load.id, { error: friendlyError(error) });
        failed = true;
      }
    }
    if (!failed && runFirstQuestion && get().query.status !== 'running') {
      const first = sample.questions[0];
      set({ sql: first.sql });
      await get().run(first.sql);
    }
    return !failed;
  },

  openSharedLink: async (hash) => {
    const shared = decodeShare(
      hash,
      SAMPLES.map((s) => s.id),
    );
    if (!shared) return;
    set({ sql: shared.sql });
    let ready = true;
    for (const id of shared.samples) {
      ready = (await get().loadSample(id, { runFirstQuestion: false })) && ready;
    }
    // Only run automatically against sample data. A link without a sample
    // refers to someone's own files, so the SQL is shown and left for the visitor to run.
    if (ready && shared.samples.length > 0 && get().sql === shared.sql) await get().run(shared.sql);
  },

  removeTable: async (name) => {
    await dropTable(name);
    set((s) => ({ tables: s.tables.filter((t) => t.name !== name) }));
  },

  dismissLoad: (id) => set((s) => ({ loads: s.loads.filter((l) => l.id !== id) })),

  setSql: (sql) => set({ sql }),

  run: async (sqlOverride) => {
    const sql = (sqlOverride ?? get().sql).trim();
    if (!sql || get().query.status === 'running') return;
    cancelled = false;
    set({ query: { status: 'running', startedAt: Date.now() } });
    try {
      const result = await runQuery(sql);
      const tables = get().tables;
      const names = new Set(
        tablesMentioned(
          sql,
          tables.map((t) => t.name),
        ),
      );
      const scannedRows = tables
        .filter((t) => names.has(t.name))
        .reduce((sum, t) => sum + t.rowCount, 0);
      set({
        query: { status: 'done', result, sql, sort: null, sortedByDatabase: false, scannedRows },
      });
      useLibrary.getState().record(sql, true);
    } catch (error) {
      if (!cancelled) useLibrary.getState().record(sql, false);
      set({
        query: cancelled ? { status: 'idle' } : { status: 'error', message: errorMessage(error) },
      });
    }
    if (!isReadOnly(sql)) {
      // The statement may have created, replaced or dropped tables.
      const tables = await listTables(get().tables).catch(() => null);
      if (tables) set({ tables });
    }
  },

  cancel: () => {
    if (get().query.status !== 'running') return;
    cancelled = true;
    void cancelQuery();
  },

  sortBy: async (column) => {
    const current = get().query;
    if (current.status !== 'done') return;
    const sort = nextSort(current.sort, column);

    // A complete result is sorted in place. A result cut off at the display
    // limit must be re-sorted by the database, or rows beyond the cut would be missed.
    if (!current.result.truncated && !current.sortedByDatabase) {
      set({ query: { ...current, sort } });
      return;
    }
    cancelled = false;
    set({ query: { status: 'running', startedAt: Date.now() } });
    try {
      const field = current.result.table.schema.fields[column];
      const result = await runQuery(
        sort ? sortedSql(current.sql, quoteIdent(field.name), sort.direction) : current.sql,
      );
      set({ query: { ...current, result, sort, sortedByDatabase: sort !== null } });
    } catch {
      // The query can't be wrapped (or was cancelled): sort the rows already shown.
      set({ query: { ...current, sort: cancelled ? current.sort : sort, sortedByDatabase: false } });
    }
  },

  previewTable: async (name) => {
    const sql = previewSql(name);
    set({ sql });
    await get().run(sql);
  },
}));
