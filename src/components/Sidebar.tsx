import { useEffect, useState } from 'react';
import type { TableInfo } from '../db/engine';
import { formatBytes } from '../lib/files';
import { SAMPLES } from '../samples';
import { useApp, type FileLoad } from '../state/store';
import { FilePickerButton } from './DropZone';
import { QueriesPanel } from './QueriesPanel';

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
      <li role="alert" className="border-b border-rule border-l-2 border-l-danger bg-danger-wash px-3 py-2 text-[13px]">
        <div className="flex items-start justify-between gap-2">
          <p className="font-medium break-all">{load.fileName}</p>
          <button
            type="button"
            className="text-muted hover:text-ink"
            aria-label={`Dismiss error for ${load.fileName}`}
            onClick={() => dismiss(load.id)}
          >
            ✕
          </button>
        </div>
        <p className="mt-1 text-danger">{load.error}</p>
      </li>
    );
  }
  const fraction = load.progress !== undefined && load.progress < 1 ? load.progress : null;
  return (
    <li className="border-b border-rule px-3 py-2 text-[13px]">
      <div className="flex items-baseline gap-2">
        <span className="min-w-0 flex-1 truncate" title={load.fileName}>
          {load.fileName}
          {load.size > 0 && ` (${formatBytes(load.size)})`}
        </span>
        <span className="font-mono text-[11px] text-muted">
          {fraction !== null ? `${Math.round(fraction * 100)}%` : <Elapsed since={load.startedAt} />}
        </span>
      </div>
      {/* A bar that fills while downloading, then sweeps while the database reads the file. */}
      <div className="mt-1.5 h-px bg-rule">
        <div
          className={`h-px bg-accent ${fraction === null ? 'w-full animate-pulse' : ''}`}
          style={fraction !== null ? { width: `${fraction * 100}%` } : undefined}
        />
      </div>
    </li>
  );
}

function TableEntry({ table }: { table: TableInfo }) {
  const [open, setOpen] = useState(true);
  const removeTable = useApp((s) => s.removeTable);
  const previewTable = useApp((s) => s.previewTable);

  return (
    <li data-testid="table-item" className="group border-b border-rule">
      <div className="flex items-baseline gap-1 px-3 pt-2">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-baseline gap-1.5 text-left"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          <span aria-hidden className="w-2 font-mono text-[11px] text-faint">
            {open ? '−' : '+'}
          </span>
          <span className="truncate font-mono text-[13px] font-semibold" title={table.source}>
            {table.name}
          </span>
        </button>
        <button
          type="button"
          className="text-[12px] text-accent underline decoration-1 underline-offset-2 hover:text-ink"
          onClick={() => void previewTable(table.name)}
        >
          Preview
        </button>
        <button
          type="button"
          className="pl-1.5 text-faint hover:text-danger"
          aria-label={`Remove table ${table.name}`}
          onClick={() => void removeTable(table.name)}
        >
          ✕
        </button>
      </div>
      <p className="px-3 pb-2 pl-[1.625rem] font-mono text-[11px] text-muted">
        {table.rowCount.toLocaleString('en-US')} {table.rowCount === 1 ? 'row' : 'rows'} ·{' '}
        {table.columns.length} {table.columns.length === 1 ? 'column' : 'columns'}
      </p>
      {open && (
        <ul className="pb-2 pl-[1.625rem]">
          {table.columns.map((column) => (
            <li key={column.name} className="flex items-baseline justify-between gap-3 pr-3 leading-[1.35rem]">
              <span className="truncate font-mono text-[12px]" title={column.name}>
                {column.name}
              </span>
              <span className="shrink-0 font-mono text-[10.5px] text-faint lowercase">{column.type}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function TablesTab() {
  const tables = useApp((s) => s.tables);
  const loads = useApp((s) => s.loads);
  const loadSample = useApp((s) => s.loadSample);

  return (
    <>
      <ul className="flex flex-1 flex-col overflow-y-auto">
        {tables.map((table) => (
          <TableEntry key={table.name} table={table} />
        ))}
        {loads.map((load) => (
          <LoadRow key={load.id} load={load} />
        ))}
        {tables.length === 0 && loads.length === 0 && (
          <li className="px-3 py-3 text-[13px] text-muted">
            No tables yet. Drop CSV, TSV, JSON, Parquet or Excel (.xlsx) files anywhere on the page.
          </li>
        )}
      </ul>
      <div className="border-t border-ink px-3 py-2.5">
        <h2 className="label">Sample datasets</h2>
        <ul className="mt-1.5">
          {SAMPLES.map((sample) => {
            const loaded = sample.tables.every((t) =>
              tables.some((x) => x.name === t.name && x.source === sample.name),
            );
            return (
              <li key={sample.id} className="flex items-baseline justify-between gap-2 py-0.5 text-[13px]">
                <span className="truncate" title={sample.description}>
                  {sample.name}
                </span>
                {loaded ? (
                  <span className="font-mono text-[11px] text-faint">Loaded</span>
                ) : (
                  <button
                    type="button"
                    className="text-[12px] text-accent underline decoration-1 underline-offset-2 hover:text-ink"
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

/** On phones it fills the screen, and is hidden while the query is showing. */
export function Sidebar({ onFiles, hiddenOnPhone }: { onFiles: (files: File[]) => void; hiddenOnPhone: boolean }) {
  const [tab, setTab] = useState<'tables' | 'queries'>('tables');
  const tabClass = (active: boolean) =>
    `label -mb-px border-b-2 px-0.5 py-2.5 ${
      active ? 'border-accent !text-ink' : 'border-transparent hover:!text-ink'
    }`;

  return (
    <aside className={`flex w-72 shrink-0 flex-col border-r border-rule bg-panel compact:w-full compact:border-r-0 ${
        hiddenOnPhone ? 'compact:hidden' : ''
      }`}>
      <div className="flex items-center justify-between border-b border-rule px-3">
        <div role="tablist" className="flex gap-4">
          <button type="button" role="tab" aria-selected={tab === 'tables'} className={tabClass(tab === 'tables')} onClick={() => setTab('tables')}>
            Tables
          </button>
          <button type="button" role="tab" aria-selected={tab === 'queries'} className={tabClass(tab === 'queries')} onClick={() => setTab('queries')}>
            Queries
          </button>
        </div>
        <FilePickerButton
          onFiles={onFiles}
          className="text-[12px] font-medium underline decoration-rule decoration-1 underline-offset-4 hover:decoration-ink"
        >
          + Add files
        </FilePickerButton>
      </div>
      {tab === 'queries' ? <QueriesPanel /> : <TablesTab />}
    </aside>
  );
}
