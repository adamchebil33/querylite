import { create } from 'zustand';
import { readJson, writeJson } from '../lib/storage';

export interface HistoryEntry {
  sql: string;
  /** When the query ran (epoch milliseconds). */
  at: number;
  ok: boolean;
}

export interface SavedQuery {
  name: string;
  sql: string;
}

const HISTORY_KEY = 'querylite.history';
const SAVED_KEY = 'querylite.saved';
export const MAX_HISTORY = 50;

interface LibraryState {
  history: HistoryEntry[];
  saved: SavedQuery[];
  record: (sql: string, ok: boolean) => void;
  clearHistory: () => void;
  /** Saves under a name, replacing any saved query with the same name. */
  save: (name: string, sql: string) => void;
  remove: (name: string) => void;
}

/**
 * Query history and saved queries. Both hold SQL text only and live in this
 * browser's local storage; nothing is sent anywhere.
 */
export const useLibrary = create<LibraryState>((set, get) => ({
  history: readJson<HistoryEntry[]>(HISTORY_KEY, []),
  saved: readJson<SavedQuery[]>(SAVED_KEY, []),

  record: (sql, ok) => {
    // Re-running the same query moves it to the top instead of adding a duplicate.
    const rest = get().history.filter((entry) => entry.sql !== sql);
    const history = [{ sql, at: Date.now(), ok }, ...rest].slice(0, MAX_HISTORY);
    set({ history });
    writeJson(HISTORY_KEY, history);
  },

  clearHistory: () => {
    set({ history: [] });
    writeJson(HISTORY_KEY, []);
  },

  save: (name, sql) => {
    const saved = [{ name, sql }, ...get().saved.filter((q) => q.name !== name)];
    set({ saved });
    writeJson(SAVED_KEY, saved);
  },

  remove: (name) => {
    const saved = get().saved.filter((q) => q.name !== name);
    set({ saved });
    writeJson(SAVED_KEY, saved);
  },
}));
