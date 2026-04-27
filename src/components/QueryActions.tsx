import { useEffect, useRef, useState } from 'react';
import { encodeShare } from '../lib/share';
import { tablesMentioned } from '../lib/sql';
import { SAMPLES } from '../samples';
import { useLibrary } from '../state/library';
import { useApp } from '../state/store';

const buttonClass =
  'rounded-md border border-slate-300 px-2.5 py-1.5 text-sm font-medium hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800';

/** Builds a link holding the SQL and the sample datasets it reads. Never any data. */
export function shareUrl(sql: string, tables: { name: string; source: string }[]): string {
  const mentioned = new Set(
    tablesMentioned(
      sql,
      tables.map((t) => t.name),
    ),
  );
  const samples = SAMPLES.filter((sample) =>
    sample.tables.some(
      (t) => mentioned.has(t.name) && tables.some((x) => x.name === t.name && x.source === sample.name),
    ),
  ).map((sample) => sample.id);
  return `${location.origin}${location.pathname}${encodeShare({ sql, samples })}`;
}

function SaveButton({ sql }: { sql: string }) {
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const save = useLibrary((s) => s.save);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (naming) input.current?.focus();
  }, [naming]);

  if (!naming) {
    return (
      <button type="button" className={buttonClass} disabled={!sql} onClick={() => setNaming(true)}>
        Save
      </button>
    );
  }
  return (
    <form
      className="flex items-center gap-1"
      onSubmit={(event) => {
        event.preventDefault();
        if (name.trim()) save(name.trim(), sql);
        setNaming(false);
        setName('');
      }}
    >
      <input
        ref={input}
        value={name}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => event.key === 'Escape' && setNaming(false)}
        placeholder="Name this query"
        aria-label="Name for the saved query"
        maxLength={60}
        className="w-40 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
      />
      <button type="submit" className={buttonClass} disabled={!name.trim()}>
        Save
      </button>
    </form>
  );
}

function ShareButton({ sql }: { sql: string }) {
  const tables = useApp((s) => s.tables);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const url = shareUrl(sql, tables);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be refused; show the link so it can be copied by hand.
      setLink(url);
    }
  };

  return (
    <span className="relative">
      <button
        type="button"
        className={buttonClass}
        disabled={!sql}
        title="Copy a link to this query. The link holds the SQL only, never your data."
        onClick={() => void share()}
      >
        {copied ? 'Link copied' : 'Share'}
      </button>
      {link && (
        <span className="absolute top-full left-0 z-30 mt-1 flex w-80 items-center gap-1 rounded-lg border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-900">
          <input
            readOnly
            value={link}
            aria-label="Share link"
            onFocus={(event) => event.target.select()}
            className="min-w-0 flex-1 rounded border border-slate-300 bg-transparent px-2 py-1 text-xs dark:border-slate-700"
          />
          <button type="button" className="px-1 text-slate-400" aria-label="Close" onClick={() => setLink(null)}>
            ✕
          </button>
        </span>
      )}
    </span>
  );
}

function ExplainButton({ sql }: { sql: string }) {
  const explain = useApp((s) => s.explainSql);
  const busy = useApp((s) => s.ai.busy === 'explain');
  return (
    <button
      type="button"
      className={buttonClass}
      disabled={!sql || busy}
      title="Ask AI to explain this query in plain English. Only the SQL and your column names are sent."
      onClick={() => void explain()}
    >
      {busy ? 'Explaining…' : 'Explain'}
    </button>
  );
}

export function QueryActions() {
  const sql = useApp((s) => s.sql.trim());
  return (
    <>
      <ExplainButton sql={sql} />
      <SaveButton sql={sql} />
      <ShareButton sql={sql} />
    </>
  );
}
