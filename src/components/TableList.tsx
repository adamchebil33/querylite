import { useEffect, useState } from 'react';
import { formatBytes } from '../lib/files';
import { useApp, type FileLoad } from '../state/store';

function Spinner() {
  return (
    <span
      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent"
      aria-hidden
    />
  );
}

/** Ticks on the main thread: it keeps counting only because loading happens in a worker. */
function Elapsed({ since }: { since: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(timer);
  }, []);
  return <span className="tabular-nums">{((now - since) / 1000).toFixed(1)} s</span>;
}

function LoadRow({ load }: { load: FileLoad }) {
  const dismiss = useApp((s) => s.dismissLoad);
  if (load.error) {
    return (
      <li
        role="alert"
        className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm dark:border-red-900 dark:bg-red-950/40"
      >
        <div className="flex items-start justify-between gap-2">
          <p className="font-medium break-all">{load.fileName}</p>
          <button
            type="button"
            className="text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
            aria-label={`Dismiss error for ${load.fileName}`}
            onClick={() => dismiss(load.id)}
          >
            ✕
          </button>
        </div>
        <p className="mt-1 text-red-700 dark:text-red-300">{load.error}</p>
      </li>
    );
  }
  return (
    <li className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800">
      <Spinner />
      <span className="min-w-0 flex-1 truncate">
        Loading {load.fileName} ({formatBytes(load.size)})
      </span>
      <Elapsed since={load.startedAt} />
    </li>
  );
}

export function TableList() {
  const tables = useApp((s) => s.tables);
  const loads = useApp((s) => s.loads);
  const removeTable = useApp((s) => s.removeTable);

  return (
    <ul className="flex flex-col gap-2">
      {tables.map((table) => (
        <li
          key={table.name}
          data-testid="table-item"
          className="rounded-lg border border-slate-200 bg-white p-3 text-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono font-semibold">{table.name}</span>
            <button
              type="button"
              className="text-slate-400 hover:text-red-600"
              aria-label={`Remove table ${table.name}`}
              onClick={() => void removeTable(table.name)}
            >
              ✕
            </button>
          </div>
          <p className="mt-0.5 text-slate-500">
            {table.rowCount.toLocaleString('en-US')} rows · {table.columns.length} columns
          </p>
        </li>
      ))}
      {loads.map((load) => (
        <LoadRow key={load.id} load={load} />
      ))}
    </ul>
  );
}
