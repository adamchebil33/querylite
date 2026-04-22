import { useEffect, useState } from 'react';
import type { TableInfo } from '../db/engine';
import { formatBytes } from '../lib/files';
import { formatCount } from '../lib/format';
import { SAMPLES } from '../samples';
import { useApp, type FileLoad } from '../state/store';
import { FilePickerButton } from './DropZone';
import { QueriesPanel } from './QueriesPanel';

function Spinner() {
  return (
    <span
      className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent"
      aria-hidden
    />
  );
}

/** Ticks on the main thread: it keeps counting only because loading happens in a worker. */
export function Elapsed({ since }: { since: number }) {
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
    <li className="flex items-center gap-2 rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800">
      <Spinner />
      <span className="min-w-0 flex-1 truncate" title={load.fileName}>
        {load.fileName}
        {load.size > 0 && ` (${formatBytes(load.size)})`}
      </span>
      {load.progress !== undefined && load.progress < 1 ? (
        <span className="tabular-nums">{Math.round(load.progress * 100)}%</span>
      ) : (
        <Elapsed since={load.startedAt} />
      )}
    </li>
  );
}

function TableCard({ table }: { table: TableInfo }) {
  const [open, setOpen] = useState(true);
  const removeTable = useApp((s) => s.removeTable);
  const previewTable = useApp((s) => s.previewTable);

  return (
    <li
      data-testid="table-item"
      className="rounded-lg border border-slate-200 bg-white text-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex items-center gap-1 p-2">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          <svg
            viewBox="0 0 12 12"
            aria-hidden
            className={`h-3 w-3 shrink-0 fill-slate-400 transition-transform ${open ? 'rotate-90' : ''}`}
          >
            <path d="M4 2l5 4-5 4z" />
          </svg>
          <span className="truncate font-mono font-semibold" title={table.source}>
            {table.name}
          </span>
        </button>
        <button
          type="button"
          className="rounded px-1.5 py-0.5 text-xs text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950"
          onClick={() => void previewTable(table.name)}
        >
          Preview
        </button>
        <button
          type="button"
          className="px-1 text-slate-400 hover:text-red-600"
          aria-label={`Remove table ${table.name}`}
          onClick={() => void removeTable(table.name)}
        >
          ✕
        </button>
      </div>
      <p className="px-2 pb-2 text-xs text-slate-500">
        {formatCount(table.rowCount, 'row')} · {formatCount(table.columns.length, 'column')}
      </p>
      {open && (
        <ul className="border-t border-slate-100 py-1 dark:border-slate-800">
          {table.columns.map((column) => (
            <li key={column.name} className="flex items-baseline justify-between gap-3 px-2 py-0.5">
              <span className="truncate font-mono text-xs" title={column.name}>
                {column.name}
              </span>
              <span className="shrink-0 font-mono text-[11px] text-slate-400 lowercase">
                {column.type}
              </span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export function Sidebar({ onFiles }: { onFiles: (files: File[]) => void }) {
  const [tab, setTab] = useState<'tables' | 'queries'>('tables');

  const tabClass = (active: boolean) =>
    `px-1 pb-1 text-xs font-semibold tracking-wide uppercase border-b-2 ${
      active
        ? 'border-indigo-500 text-slate-900 dark:text-slate-100'
        : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
    }`;

  return (
    <aside className="flex w-72 shrink-0 flex-col border-r border-slate-200 dark:border-slate-800">
      <div className="flex items-center justify-between px-3 py-2">
        <div role="tablist" className="flex gap-3">
          <button type="button" role="tab" aria-selected={tab === 'tables'} className={tabClass(tab === 'tables')} onClick={() => setTab('tables')}>
            Tables
          </button>
          <button type="button" role="tab" aria-selected={tab === 'queries'} className={tabClass(tab === 'queries')} onClick={() => setTab('queries')}>
            Queries
          </button>
        </div>
        <FilePickerButton
          onFiles={onFiles}
          className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          + Add files
        </FilePickerButton>
      </div>
      {tab === 'queries' ? <QueriesPanel /> : <TablesTab />}
    </aside>
  );
}

function TablesTab() {
  const tables = useApp((s) => s.tables);
  const loads = useApp((s) => s.loads);
  const loadSample = useApp((s) => s.loadSample);

  return (
    <>
      <ul className="flex flex-1 flex-col gap-2 overflow-y-auto px-3 pb-3">
        {tables.map((table) => (
          <TableCard key={table.name} table={table} />
        ))}
        {loads.map((load) => (
          <LoadRow key={load.id} load={load} />
        ))}
        {tables.length === 0 && loads.length === 0 && (
          <li className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-xs text-slate-500 dark:border-slate-700">
            Drop CSV, TSV, JSON or Parquet files anywhere on the page.
          </li>
        )}
      </ul>
      <div className="border-t border-slate-200 px-3 py-2 dark:border-slate-800">
        <h2 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
          Sample datasets
        </h2>
        <ul className="mt-1.5 flex flex-col gap-1">
          {SAMPLES.map((sample) => {
            const loaded = sample.tables.every((t) =>
              tables.some((x) => x.name === t.name && x.source === sample.name),
            );
            return (
              <li key={sample.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate" title={sample.description}>
                  {sample.name}
                </span>
                {loaded ? (
                  <span className="text-xs text-slate-400">Loaded</span>
                ) : (
                  <button
                    type="button"
                    className="rounded px-1.5 py-0.5 text-xs text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950"
                    aria-label={`Load sample ${sample.name}`}
                    onClick={() => void loadSample(sample.id)}
                  >
                    Load
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}
