import { MAX_RESULT_ROWS, type QueryResult } from '../db/engine';
import { formatCell, formatCount, formatDuration, isNumeric } from '../lib/format';
import { useApp } from '../state/store';
import { Elapsed } from './Sidebar';

/** Rows drawn until the virtualized table lands. */
const VISIBLE_ROWS = 200;

function ResultTable({ result }: { result: QueryResult }) {
  const { table } = result;
  const fields = table.schema.fields;
  const columns = fields.map((_, i) => table.getChildAt(i)!);
  const shown = Math.min(table.numRows, VISIBLE_ROWS);

  return (
    <div className="h-full overflow-auto">
      <table data-testid="result-table" className="min-w-full border-collapse text-sm">
        <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800">
          <tr>
            {fields.map((field, c) => (
              <th
                key={c}
                className={`border-b border-slate-200 px-3 py-1.5 font-semibold whitespace-nowrap dark:border-slate-700 ${isNumeric(field.type) ? 'text-right' : 'text-left'}`}
              >
                {field.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: shown }, (_, r) => (
            <tr key={r} className="odd:bg-white even:bg-slate-50 dark:odd:bg-slate-900 dark:even:bg-slate-900/50">
              {fields.map((field, c) => {
                const text = formatCell(columns[c].get(r), field.type);
                return (
                  <td
                    key={c}
                    className={`max-w-md truncate border-b border-slate-100 px-3 py-1 font-mono text-[13px] whitespace-nowrap dark:border-slate-800 ${isNumeric(field.type) ? 'text-right tabular-nums' : ''}`}
                  >
                    {text === null ? <span className="text-slate-400 italic">NULL</span> : text}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

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
  return (
    <span data-testid="result-summary" className="text-sm text-slate-500">
      {truncated
        ? `First ${MAX_RESULT_ROWS.toLocaleString('en-US')} rows`
        : formatCount(table.numRows, 'row')}{' '}
      · {formatDuration(elapsedMs)}
    </span>
  );
}

export function Results() {
  const query = useApp((s) => s.query);

  if (query.status === 'error') {
    return (
      <div className="p-4">
        <pre
          role="alert"
          data-testid="query-error"
          className="overflow-auto rounded-lg border border-red-300 bg-red-50 p-3 text-sm whitespace-pre-wrap text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
        >
          {query.message}
        </pre>
      </div>
    );
  }
  if (query.status === 'done') {
    if (query.result.table.schema.fields.length === 0 || query.result.table.numRows === 0) {
      return <p className="p-4 text-sm text-slate-500">Query ran successfully and returned no rows.</p>;
    }
    return <ResultTable result={query.result} />;
  }
  if (query.status === 'running') return null;
  return <p className="p-4 text-sm text-slate-500">Results will appear here.</p>;
}
