import { useMemo, useState } from 'react';
import { MAX_RESULT_ROWS } from '../db/engine';
import { parseSqlError } from '../lib/errors';
import { formatCount, formatDuration } from '../lib/format';
import { useApp } from '../state/store';
import { AiIcon } from './AiIcon';
import { ChartPanel, defaultChart } from './ChartPanel';
import { ExportButtons } from './ExportButtons';
import { ResultTable } from './ResultTable';
import { Elapsed } from './Sidebar';

export function ResultSummary() {
  const query = useApp((s) => s.query);
  if (query.status === 'running') {
    return (
      <span className="font-mono text-[12px] text-muted">
        Running… <Elapsed since={query.startedAt} />
      </span>
    );
  }
  if (query.status !== 'done') return null;
  return (
    <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
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
    <span data-testid="result-summary" className="font-mono text-[12px] text-muted">
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
        className="max-w-3xl border-l-2 border-danger bg-danger-wash px-4 py-3 text-sm"
      >
        <p className="font-semibold text-danger">{error.title}</p>
        <p className="mt-1 whitespace-pre-wrap">{error.message}</p>
        {error.context && (
          <pre className="mt-3 overflow-x-auto border border-rule bg-panel p-2 font-mono text-[12.5px] text-ink">
            {error.context}
          </pre>
        )}
        {error.hint && <p className="mt-3 text-muted">{error.hint}</p>}
        <button
          type="button"
          disabled={fixing}
          onClick={() => void fixError()}
          title="Sends your SQL, the error text (with values removed) and your column names. Never your data."
          className="btn mt-3"
        >
          <AiIcon />
          {fixing ? 'Asking AI…' : 'Fix with AI'}
        </button>
      </div>
    </div>
  );
}

export function Results() {
  const query = useApp((s) => s.query);
  const isEmpty = useApp((s) => s.tables.length === 0 && s.loads.length === 0);
  const sortBy = useApp((s) => s.sortBy);

  if (query.status === 'error') return <QueryError message={query.message} />;
  if (query.status === 'running') return null;
  if (query.status === 'idle') {
    return (
      <p className="p-4 font-mono text-[12px] text-faint">
        {isEmpty
          ? 'No data yet. Drop files anywhere on the page, or load a sample dataset from the sidebar.'
          : 'Results will appear here.'}
      </p>
    );
  }
  const { table } = query.result;
  if (table.schema.fields.length === 0 || table.numRows === 0) {
    return <p className="p-4 font-mono text-[12px] text-muted">Query ran successfully and returned no rows.</p>;
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
            className="btn absolute top-2 right-4 z-30"
          >
            Show chart
          </button>
        )}
      </div>
      {chart && showChart && (
        <div className="relative h-1/2 min-h-0 shrink-0 border-t border-rule lg:h-auto lg:w-[46%] lg:border-t-0 lg:border-l">
          <ChartPanel table={table} initial={chart} />
          <button
            type="button"
            aria-label="Hide chart"
            title="Hide chart"
            onClick={() => setShowChart(false)}
            className="absolute top-2 right-2 px-1.5 text-faint hover:text-ink"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
