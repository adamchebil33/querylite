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
      className="flex shrink-0 items-baseline gap-5 overflow-x-auto border-b border-rule px-3 py-2"
    >
      <span className="label shrink-0">Examples</span>
      {questions.map((question, index) => {
        const active = sql.trim() === question.sql.trim();
        return (
          <button
            key={question.label}
            type="button"
            onClick={() => {
              setSql(question.sql);
              void run(question.sql);
            }}
            className={`group flex shrink-0 items-baseline gap-1.5 text-[13px] ${
              active ? 'text-ink' : 'text-muted hover:text-ink'
            }`}
          >
            <span aria-hidden className={`font-mono text-[11px] ${active ? 'text-accent' : 'text-faint'}`}>
              {String(index + 1).padStart(2, '0')}
            </span>
            <span
              className={`underline decoration-1 underline-offset-4 ${
                active ? 'decoration-accent' : 'decoration-rule group-hover:decoration-ink'
              }`}
            >
              {question.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
