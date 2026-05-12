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

const itemClass = 'w-full px-3 py-1.5 text-left hover:bg-wash';

/** Saved queries and recent history. Clicking one puts it back in the editor. */
export function QueriesPanel() {
  const { history, saved, clearHistory, remove } = useLibrary();
  const setSql = useApp((s) => s.setSql);

  return (
    <div className="flex flex-1 flex-col overflow-y-auto text-[13px]">
      <section>
        <h3 className="label px-3 pt-3">Saved</h3>
        {saved.length === 0 ? (
          <p className="px-3 pt-1 text-xs text-muted">
            Use the Save button next to Run to keep a query here.
          </p>
        ) : (
          <ul className="mt-1" data-testid="saved-queries">
            {saved.map((query) => (
              <li key={query.name} className="flex items-center border-b border-rule">
                <button
                  type="button"
                  className={`${itemClass} min-w-0 flex-1`}
                  title={query.sql}
                  onClick={() => setSql(query.sql)}
                >
                  <span className="block truncate font-medium">{query.name}</span>
                  <span className="block truncate font-mono text-[11px] text-muted">
                    {firstLine(query.sql)}
                  </span>
                </button>
                <button
                  type="button"
                  className="px-2 text-faint hover:text-danger"
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

      <section className="mt-4">
        <div className="flex items-baseline justify-between px-3">
          <h3 className="label">History</h3>
          {history.length > 0 && (
            <button type="button" className="text-xs text-muted underline hover:text-danger" onClick={clearHistory}>
              Clear
            </button>
          )}
        </div>
        {history.length === 0 ? (
          <p className="px-3 pt-1 text-xs text-muted">Queries you run will be listed here.</p>
        ) : (
          <ul className="mt-1" data-testid="query-history">
            {history.map((entry) => (
              <li key={entry.at} className="border-b border-rule">
                <button type="button" className={itemClass} title={entry.sql} onClick={() => setSql(entry.sql)}>
                  <span className="block truncate font-mono text-[12px]">{firstLine(entry.sql)}</span>
                  <span className="block font-mono text-[11px] text-faint">
                    {timeAgo(entry.at)}
                    {!entry.ok && <span className="text-danger"> · failed</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <p className="mt-auto px-3 py-2 font-mono text-[11px] text-faint">Stored in this browser only.</p>
    </div>
  );
}
