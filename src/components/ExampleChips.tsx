import { SAMPLES } from '../samples';
import { useApp } from '../state/store';

/** Clickable example questions for whichever sample datasets are loaded. */
export function ExampleChips() {
  const tables = useApp((s) => s.tables);
  const setSql = useApp((s) => s.setSql);
  const run = useApp((s) => s.run);
  const sql = useApp((s) => s.sql);

  const questions = SAMPLES.filter((sample) =>
    sample.tables.every((t) => tables.some((x) => x.name === t.name && x.source === sample.name)),
  ).flatMap((sample) => sample.questions);
  if (questions.length === 0) return null;

  return (
    <div
      data-testid="example-chips"
      className="flex shrink-0 items-center gap-2 overflow-x-auto border-b border-slate-200 px-3 py-2 dark:border-slate-800"
    >
      <span className="shrink-0 text-xs font-medium text-slate-500">Try:</span>
      {questions.map((question) => {
        const active = sql.trim() === question.sql.trim();
        return (
          <button
            key={question.label}
            type="button"
            onClick={() => {
              setSql(question.sql);
              void run(question.sql);
            }}
            className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition ${
              active
                ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                : 'border-slate-300 hover:border-indigo-400 hover:text-indigo-600 dark:border-slate-700 dark:hover:text-indigo-400'
            }`}
          >
            {question.label}
          </button>
        );
      })}
    </div>
  );
}
