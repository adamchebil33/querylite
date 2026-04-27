import { useState } from 'react';
import { useApp } from '../state/store';

function Sparkle() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className="h-4 w-4 shrink-0 fill-indigo-500">
      <path d="M8 1l1.600 4.400L14 7l-4.400 1.600L8 13l-1.600-4.400L2 7l4.400-1.600L8 1zm5 9l.7 1.800 1.800.7-1.800.7L13 15l-.7-1.800-1.800-.7 1.800-.7L13 10z" />
    </svg>
  );
}

/** "Ask in plain English": the AI writes SQL into the editor; the user reviews and runs it. */
export function AskBar() {
  const [question, setQuestion] = useState('');
  const ask = useApp((s) => s.askAi);
  const busy = useApp((s) => s.ai.busy === 'generate');
  const hasTables = useApp((s) => s.tables.length > 0);

  return (
    <form
      className="flex shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900"
      onSubmit={(event) => {
        event.preventDefault();
        void ask(question);
      }}
    >
      <Sparkle />
      <input
        value={question}
        onChange={(event) => setQuestion(event.target.value)}
        disabled={!hasTables}
        maxLength={500}
        aria-label="Ask a question in plain English"
        placeholder={
          hasTables
            ? 'Ask in plain English, e.g. "top 5 pickup zones by average tip"'
            : 'Load a dataset to ask questions in plain English'
        }
        className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400 disabled:cursor-not-allowed"
      />
      <span
        className="hidden shrink-0 text-xs text-slate-500 lg:inline"
        title="The AI receives your question plus the names and types of your tables and columns. It never receives rows, values or file contents."
      >
        Only column names are sent to AI
      </span>
      <button
        type="submit"
        disabled={!hasTables || busy || question.trim() === ''}
        className="shrink-0 rounded-md border border-indigo-300 px-2.5 py-1 text-sm font-medium text-indigo-700 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-950"
      >
        {busy ? 'Writing…' : 'Write SQL'}
      </button>
    </form>
  );
}

/** Shows what the AI did or why it couldn't, and explanations of queries. */
export function AiNotice() {
  const ai = useApp((s) => s.ai);
  const dismiss = useApp((s) => s.dismissAi);
  const text = ai.explanation ?? ai.notice?.text;
  if (!text) return null;
  const isError = !ai.explanation && ai.notice?.tone === 'error';

  return (
    <div
      role={isError ? 'alert' : 'status'}
      data-testid="ai-notice"
      className={`flex shrink-0 items-start gap-2 border-b px-3 py-2 text-sm ${
        isError
          ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200'
          : 'border-indigo-200 bg-indigo-50 text-indigo-950 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-100'
      }`}
    >
      {!isError && <Sparkle />}
      <p className="min-w-0 flex-1 whitespace-pre-wrap">
        {ai.explanation && <span className="font-semibold">What this query does: </span>}
        {text}
      </p>
      <button type="button" aria-label="Dismiss" className="px-1 opacity-60 hover:opacity-100" onClick={dismiss}>
        ✕
      </button>
    </div>
  );
}
