import { useMemo } from 'react';
import { MAX_RESULT_ROWS } from '../db/engine';
import { parseSqlError } from '../lib/errors';
import { formatCount, formatDuration } from '../lib/format';
import { useApp } from '../state/store';
import { ResultTable } from './ResultTable';
import { Elapsed } from './Sidebar';

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
      </div>
    </div>
  );
}

export function Results() {
  const query = useApp((s) => s.query);
  const sortBy = useApp((s) => s.sortBy);

  if (query.status === 'error') return <QueryError message={query.message} />;
  if (query.status === 'running') return null;
  if (query.status === 'idle') {
    return <p className="p-4 text-sm text-slate-500">Results will appear here.</p>;
  }
  const { table } = query.result;
  if (table.schema.fields.length === 0 || table.numRows === 0) {
    return <p className="p-4 text-sm text-slate-500">Query ran successfully and returned no rows.</p>;
  }
  return (
    <ResultTable
      // A new result starts scrolled to the top with fresh column widths.
      key={query.result.elapsedMs}
      result={query.result}
      sort={query.sort}
      sortedByDatabase={query.sortedByDatabase}
      onSort={(column) => void sortBy(column)}
    />
  );
}
