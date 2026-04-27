import { useEffect, useRef, useState } from 'react';

function LockIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className="h-3.5 w-3.5 fill-current">
      <path d="M8 1a3.5 3.5 0 0 0-3.500 3.500V6H4a1.500 1.500 0 0 0-1.500 1.500v5A1.500 1.500 0 0 0 4 14h8a1.500 1.500 0 0 0 1.500-1.500v-5A1.500 1.500 0 0 0 12 6h-.5V4.500A3.500 3.500 0 0 0 8 1zm2 5H6V4.500a2 2 0 1 1 4 0V6z" />
    </svg>
  );
}

/** Header badge that opens a short, checkable explanation of the privacy design. */
export function PrivacyBadge() {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === 'Escape' : !root.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 dark:hover:bg-emerald-900"
      >
        <LockIcon />
        Nothing is uploaded
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="How your data stays private"
          className="absolute top-full right-0 z-40 mt-2 w-96 max-w-[90vw] rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-xl dark:border-slate-700 dark:bg-slate-900"
        >
          <h2 className="font-semibold">Your data stays on this device</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-slate-600 dark:text-slate-300">
            <li>
              Files you add are read by a database (DuckDB) running inside this browser tab. They
              are never sent to a server.
            </li>
            <li>
              The page only downloads things: its own code, the database engine, and the sample
              datasets if you ask for them.
            </li>
            <li>
              Share links contain the SQL text and the name of a sample dataset. They never contain
              your data.
            </li>
            <li>
              The optional AI helper receives your question, the SQL in the editor, and the names
              and types of your tables and columns. It never receives rows, values or file contents.
            </li>
            <li>Query history and saved queries are kept in this browser only.</li>
          </ul>
          <p className="mt-3 text-xs text-slate-500">
            Check it yourself: open your browser's developer tools, go to the Network tab, and load
            a file. No request carries its contents.
          </p>
        </div>
      )}
    </div>
  );
}
