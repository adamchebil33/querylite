import { useMemo, useState } from 'react';
import { MAX_RESULT_ROWS } from '../db/engine';
import { parseSqlError } from '../lib/errors';
import { formatCount, formatDuration } from '../lib/format';
import { useApp } from '../state/store';
import { ChartPanel, defaultChart } from './ChartPanel';
import { ExportButtons } from './ExportButtons';
import { ResultTable } from './ResultTable';
import { Elapsed } from './Sidebar';
import { Welcome } from './Welcome';

export function ResultSummary() {
  const query = useApp((s) => s.query);
  if (query.status === 'running') {
    return (
      <span className="text-sm text-slate-500">
        Running… <Elapsed since={query.startedAt} />
      </span>
    );
  }
  if (query.status !== 'done') return null;
  return (
    <span className="flex items-center gap-4">
      <ExportButtons sql={query.sql} />
      <ResultSummaryText />
    </span>
  );
}

function ResultSummaryText() {
  const query = useApp((s) => s.query);
  if (query.status !== 'done') return null;
  const { table, truncated, elapsedMs } = query.result;
  const limit = MAX_RESULT_ROWS.toLocaleString('en-US');
  return (
    <span data-testid="result-summary" className="text-sm text-slate-500">
      {truncated ? (
        <span title={`Only the first ${limit} rows are shown. Add a LIMIT or aggregate to narrow the result.`}>
          First {limit} rows
        </span>
      ) : (
        formatCount(table.numRows, 'row')
      )}{' '}
      · {formatDuration(elapsedMs)}
      {query.scannedRows > 0 && ` over ${formatCount(query.scannedRows, 'row')}`}
      {query.sort && query.result.truncated && !query.sortedByDatabase && ' · sorted within shown rows'}
    </span>
  );
}

function QueryError({ message }: { message: string }) {
  const tables = useApp((s) => s.tables);
  const fixError = useApp((s) => s.fixError);
  const fixing = useApp((s) => s.ai.busy === 'fix');
  const error = useMemo(
    () =>
      parseSqlError(
        message,
        tables.map((t) => t.name),
      ),
    [message, tables],
  );
  return (
    <div className="p-4">
      <div
        role="alert"
        data-testid="query-error"
        className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm dark:border-red-900 dark:bg-red-950/40"
      >
        <p className="font-semibold text-red-800 dark:text-red-200">{error.title}</p>
        <p className="mt-1 whitespace-pre-wrap text-red-800 dark:text-red-200">{error.message}</p>
        {error.context && (
          <pre className="mt-3 overflow-x-auto rounded-md bg-white/70 p-2 font-mono text-[13px] text-slate-800 dark:bg-slate-950/60 dark:text-slate-200">
            {error.context}
          </pre>
        )}
        {error.hint && <p className="mt-3 text-slate-600 dark:text-slate-400">{error.hint}</p>}
        <button
          type="button"
          disabled={fixing}
          onClick={() => void fixError()}
          title="Sends your SQL, the error text (with values removed) and your column names. Never your data."
          className="mt-3 rounded-md border border-indigo-300 bg-white px-2.5 py-1 text-sm font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50 dark:border-indigo-800 dark:bg-transparent dark:text-indigo-300 dark:hover:bg-indigo-950"
        >
          {fixing ? 'Asking AI…' : 'Fix with AI'}
        </button>
      </div>
    </div>
  );
}

export function Results({ onFiles }: { onFiles: (files: File[]) => void }) {
  const query = useApp((s) => s.query);
  const isEmpty = useApp((s) => s.tables.length === 0 && s.loads.length === 0);
  const sortBy = useApp((s) => s.sortBy);

  if (query.status === 'error') return <QueryError message={query.message} />;
  if (query.status === 'running') return null;
  if (query.status === 'idle') {
    return isEmpty ? (
      <Welcome onFiles={onFiles} />
    ) : (
      <p className="p-4 text-sm text-slate-500">Results will appear here.</p>
    );
  }
  const { table } = query.result;
  if (table.schema.fields.length === 0 || table.numRows === 0) {
    return <p className="p-4 text-sm text-slate-500">Query ran successfully and returned no rows.</p>;
  }
  return (
    // A new result starts scrolled to the top with fresh column widths and a fresh chart.
    <ResultView
      key={query.result.elapsedMs}
      result={query.result}
      sort={query.sort}
      sortedByDatabase={query.sortedByDatabase}
      onSort={(column) => void sortBy(column)}
    />
  );
}

function ResultView(props: Parameters<typeof ResultTable>[0]) {
  const { table } = props.result;
  const chart = useMemo(() => defaultChart(table), [table]);
  const [showChart, setShowChart] = useState(true);

  return (
    <div className="flex h-full flex-col lg:flex-row">
      <div className="relative min-h-0 min-w-0 flex-1">
        <ResultTable {...props} />
        {chart && !showChart && (
          <button
            type="button"
            onClick={() => setShowChart(true)}
            className="absolute top-2 right-4 z-30 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium shadow-sm hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
          >
            Show chart
          </button>
        )}
      </div>
      {chart && showChart && (
        <div className="relative h-1/2 min-h-0 shrink-0 border-t border-slate-200 lg:h-auto lg:w-[46%] lg:border-t-0 lg:border-l dark:border-slate-800">
          <ChartPanel table={table} initial={chart} />
          <button
            type="button"
            aria-label="Hide chart"
            title="Hide chart"
            onClick={() => setShowChart(false)}
            className="absolute top-2 right-2 rounded px-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
