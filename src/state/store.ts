import { create } from 'zustand';
import {
  dropTable,
  friendlyError,
  getEngine,
  loadFile,
  type TableInfo,
} from '../db/engine';
import { fileKind, tableNameFor } from '../lib/files';

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

interface AppState {
  engine: EngineStatus;
  tables: TableInfo[];
  /** Files currently loading, plus failed ones until dismissed. */
  loads: FileLoad[];
  startEngine: () => void;
  addFiles: (files: File[]) => Promise<void>;
  removeTable: (name: string) => Promise<void>;
  dismissLoad: (id: number) => void;
}

let loadId = 0;

export const useApp = create<AppState>((set, get) => ({
  engine: { state: 'starting', progress: 0 },
  tables: [],
  loads: [],

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
}));
