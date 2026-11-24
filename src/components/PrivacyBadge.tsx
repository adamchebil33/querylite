import { useEffect, useRef, useState } from 'react';

function LockIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className="h-3 w-3 fill-current">
      <path d="M8 1a3.500 3.500 0 0 0-3.500 3.500V6H4a1.500 1.500 0 0 0-1.500 1.500v5A1.500 1.500 0 0 0 4 14h8a1.500 1.500 0 0 0 1.500-1.500v-5A1.500 1.500 0 0 0 12 6h-.5V4.500A3.500 3.500 0 0 0 8 1zm2 5H6V4.500a2 2 0 1 1 4 0V6z" />
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
        className="flex items-center gap-1.5 font-mono text-[11px] whitespace-nowrap text-ink underline decoration-rule decoration-1 underline-offset-4 hover:decoration-ink"
      >
        <LockIcon />
        Nothing is uploaded
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="How your data stays private"
          className="absolute top-full right-0 z-40 mt-2 w-[26rem] max-w-[90vw] compact:fixed compact:inset-x-3 compact:top-12 compact:mt-0 compact:max-h-[80vh] compact:w-auto compact:max-w-none compact:overflow-y-auto border border-ink bg-panel p-5 text-[13px] leading-relaxed"
        >
          <h2 className="font-serif text-xl">Your data stays on this device</h2>
          <ol className="mt-3 space-y-2.5">
            {[
              'Files you add are read by a database (DuckDB) running inside this browser tab. They are never sent to a server.',
              'The page only downloads things: its own code, the database engine, and the sample datasets if you ask for them.',
              'The optional AI helper receives your question, the SQL in the editor, and the names and types of your tables and columns. It never receives rows, values or file contents.',
              'Share links contain the SQL text and the name of a sample dataset. They never contain your data.',
              'Query history and saved queries are kept in this browser only.',
            ].map((text, index) => (
              <li key={index} className="grid grid-cols-[1.5rem_1fr] text-muted">
                <span className="font-mono text-[11px] leading-5 text-faint">{index + 1}</span>
                {text}
              </li>
            ))}
          </ol>
          <p className="mt-4 border-t border-rule pt-3 text-xs text-muted">
            Check it yourself: open your browser's developer tools, go to the Network tab, and load
            a file. No request carries its contents.
          </p>
        </div>
      )}
    </div>
  );
}
