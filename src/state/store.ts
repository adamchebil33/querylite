import { create } from 'zustand';
import {
  cancelQuery,
  dropTable,
  errorMessage,
  friendlyError,
  getEngine,
  listTables,
  loadFile,
  runQuery,
  type QueryResult,
  type TableInfo,
} from '../db/engine';
import { fileKind, quoteIdent, tableNameFor } from '../lib/files';
import { tablesMentioned } from '../lib/sql';
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

interface AppState {
  engine: EngineStatus;
  tables: TableInfo[];
  /** Files currently loading, plus failed ones until dismissed. */
  loads: FileLoad[];
  sql: string;
  query: QueryState;
  startEngine: () => void;
  addFiles: (files: File[]) => Promise<void>;
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

export const useApp = create<AppState>((set, get) => ({
  engine: { state: 'starting', progress: 0 },
  tables: [],
  loads: [],
  sql: '',
  query: { status: 'idle' },

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
        load.error = 'Unsupported file type. Use CSV, TSV, JSON or Parquet.';
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
    } catch (error) {
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
