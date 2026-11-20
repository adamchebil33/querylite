import { useState } from 'react';
import { useApp } from '../state/store';
import { AiIcon } from './AiIcon';

/** "Ask in plain English": the AI writes SQL into the editor; the user reviews and runs it. */
export function AskBar() {
  const [question, setQuestion] = useState('');
  const ask = useApp((s) => s.askAi);
  const busy = useApp((s) => s.ai.busy === 'generate');
  const hasTables = useApp((s) => s.tables.length > 0);

  return (
    <form
      className="flex shrink-0 items-center gap-3 border-b border-rule bg-panel px-3 py-1.5"
      onSubmit={(event) => {
        event.preventDefault();
        void ask(question);
      }}
    >
      <span className="label flex shrink-0 items-center gap-1.5" aria-hidden>
        <AiIcon />
        Ask
      </span>
      <input
        value={question}
        onChange={(event) => setQuestion(event.target.value)}
        disabled={!hasTables}
        maxLength={500}
        aria-label="Ask a question in plain English"
        placeholder={
          hasTables
            ? 'a question in plain English, e.g. top 5 pickup zones by average tip'
            : 'load a dataset to ask questions in plain English'
        }
        className="min-w-0 flex-1 bg-transparent py-1 text-sm outline-none placeholder:text-faint disabled:cursor-not-allowed"
      />
      <span
        className="hidden shrink-0 font-mono text-[11px] text-faint lg:inline"
        title="The AI receives your question plus the names and types of your tables and columns. It never receives rows, values or file contents."
      >
        Only column names are sent to AI
      </span>
      <button type="submit" disabled={!hasTables || busy || question.trim() === ''} className="btn shrink-0">
        <AiIcon />
        {busy ? 'Writing…' : 'Write SQL'}
      </button>
    </form>
  );
}

/** Shows what the AI did or why it couldn't, and explanations of queries. */
export function AiNotice() {
  const ai = useApp((s) => s.ai);
  const dismiss = useApp((s) => s.dismissAi);
  const run = useApp((s) => s.run);
  const editorSql = useApp((s) => s.sql);
  const text = ai.explanation ?? ai.notice?.text;
  if (!text) return null;
  const isError = !ai.explanation && ai.notice?.tone === 'error';

  return (
    <div
      role={isError ? 'alert' : 'status'}
      data-testid="ai-notice"
      className={`flex shrink-0 items-start gap-3 border-b border-rule border-l-2 px-3 py-2 text-sm ${
        isError ? 'border-l-danger bg-danger-wash' : 'border-l-accent bg-accent-wash'
      }`}
    >
      <span className="label mt-0.5 flex shrink-0 items-center gap-1.5">
        <AiIcon />
        AI
      </span>
      <p className="min-w-0 flex-1 whitespace-pre-wrap">
        {ai.explanation && <span className="font-semibold">What this query does: </span>}
        {text}
      </p>
      {!ai.explanation && ai.notice?.sql !== undefined && ai.notice.sql === editorSql && (
        <button
          type="button"
          className="btn shrink-0"
          onClick={() => {
            dismiss();
            void run();
          }}
        >
          Run it
        </button>
      )}
      <button type="button" aria-label="Dismiss" className="px-1 text-muted hover:text-ink" onClick={dismiss}>
        ✕
      </button>
    </div>
  );
}
