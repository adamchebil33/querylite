import { useLibrary } from '../state/library';
import { useApp } from '../state/store';

const firstLine = (sql: string) => sql.replace(/\s+/g, ' ').trim();

function timeAgo(at: number): string {
  const minutes = Math.floor((Date.now() - at) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(at).toLocaleDateString();
}

const itemClass =
  'w-full rounded-md px-2 py-1.5 text-left hover:bg-slate-100 dark:hover:bg-slate-800';

/** Saved queries and recent history. Clicking one puts it back in the editor. */
export function QueriesPanel() {
  const { history, saved, clearHistory, remove } = useLibrary();
  const setSql = useApp((s) => s.setSql);

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-3 pb-3 text-sm">
      <section>
        <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Saved</h3>
        {saved.length === 0 ? (
          <p className="mt-1 text-xs text-slate-500">
            Use the Save button next to Run to keep a query here.
          </p>
        ) : (
          <ul className="mt-1" data-testid="saved-queries">
            {saved.map((query) => (
              <li key={query.name} className="flex items-center gap-1">
                <button
                  type="button"
                  className={`${itemClass} min-w-0 flex-1`}
                  title={query.sql}
                  onClick={() => setSql(query.sql)}
                >
                  <span className="block truncate font-medium">{query.name}</span>
                  <span className="block truncate font-mono text-xs text-slate-500">
                    {firstLine(query.sql)}
                  </span>
                </button>
                <button
                  type="button"
                  className="px-1 text-slate-400 hover:text-red-600"
                  aria-label={`Delete saved query ${query.name}`}
                  onClick={() => remove(query.name)}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">History</h3>
          {history.length > 0 && (
            <button
              type="button"
              className="text-xs text-slate-500 hover:text-red-600"
              onClick={clearHistory}
            >
              Clear
            </button>
          )}
        </div>
        {history.length === 0 ? (
          <p className="mt-1 text-xs text-slate-500">Queries you run will be listed here.</p>
        ) : (
          <ul className="mt-1" data-testid="query-history">
            {history.map((entry) => (
              <li key={entry.at}>
                <button
                  type="button"
                  className={itemClass}
                  title={entry.sql}
                  onClick={() => setSql(entry.sql)}
                >
                  <span className="block truncate font-mono text-xs">{firstLine(entry.sql)}</span>
                  <span className="block text-[11px] text-slate-500">
                    {timeAgo(entry.at)}
                    {!entry.ok && <span className="text-red-600"> · failed</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <p className="mt-auto text-[11px] text-slate-400">Stored in this browser only.</p>
    </div>
  );
}
