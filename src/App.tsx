import { useCallback, useEffect, useMemo, useState } from 'react';
import { AiNotice, AskBar } from './components/AskBar';
import { ExampleChips } from './components/ExampleChips';
import { PrivacyBadge } from './components/PrivacyBadge';
import { QueryActions } from './components/QueryActions';
import { Results, ResultSummary } from './components/Results';
import { Sidebar } from './components/Sidebar';
import { SqlEditor, type SqlSchema } from './components/SqlEditor';
import { ThemeToggle, Wordmark } from './components/ThemeToggle';
import { APP_NAME } from './config';
import { useApp } from './state/store';

function EngineBadge() {
  const engine = useApp((s) => s.engine);
  const startEngine = useApp((s) => s.startEngine);
  if (engine.state === 'ready') {
    return (
      <span data-testid="engine-status" className="flex items-center gap-1.5 font-mono text-[11px] text-muted">
        <span className="h-1.5 w-1.5 bg-ok" aria-hidden />
        <span className="compact:sr-only">Engine ready</span>
      </span>
    );
  }
  if (engine.state === 'error') {
    return (
      <span data-testid="engine-status" className="font-mono text-[11px] text-danger">
        Engine failed to start: {engine.message}{' '}
        <button type="button" className="underline" onClick={startEngine}>
          Retry
        </button>
      </span>
    );
  }
  return (
    <span data-testid="engine-status" className="font-mono text-[11px] text-muted">
      <span className="compact:sr-only">Starting engine… </span>
      {Math.round(engine.progress * 100)}%
    </span>
  );
}

/** On phones it scrolls as one page, and is hidden while the data panel is showing. */
function Workspace({ hiddenOnPhone }: { hiddenOnPhone: boolean }) {
  const sql = useApp((s) => s.sql);
  const setSql = useApp((s) => s.setSql);
  const run = useApp((s) => s.run);
  const tables = useApp((s) => s.tables);
  const running = useApp((s) => s.query.status === 'running');
  const hasResult = useApp((s) => s.query.status === 'done');
  const cancel = useApp((s) => s.cancel);

  const schema = useMemo<SqlSchema>(
    () => Object.fromEntries(tables.map((t) => [t.name, t.columns.map((c) => c.name)])),
    [tables],
  );
  const onRun = useCallback(() => void run(), [run]);

  return (
    <section
      className={`flex min-w-0 flex-1 flex-col compact:overflow-y-auto ${hiddenOnPhone ? 'compact:hidden' : ''}`}
    >
      <AskBar />
      <div className="h-48 shrink-0 border-b border-rule compact:h-40">
        <SqlEditor value={sql} onChange={setSql} onRun={onRun} schema={schema} />
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-rule px-3 py-2">
        {running ? (
          <button type="button" onClick={cancel} className="btn">
            Cancel
          </button>
        ) : (
          <button type="button" disabled={sql.trim() === ''} onClick={onRun} className="btn btn-primary">
            Run
            <kbd aria-hidden className="font-mono text-[11px] font-normal opacity-60 compact:hidden">
              Ctrl ↵
            </kbd>
          </button>
        )}
        <QueryActions />
        <div className="ml-auto compact:ml-0">
          <ResultSummary />
        </div>
      </div>
      <AiNotice />
      <ExampleChips />
      <div className={`min-h-0 flex-1 ${hasResult ? 'compact:h-[40rem] compact:flex-none' : 'compact:flex-none'}`}>
        <Results />
      </div>
    </section>
  );
}

type PhoneView = 'data' | 'query';

/** Phones have no room for both columns, so these buttons switch between them. */
function PhoneViewSwitch({ view, onChange }: { view: PhoneView; onChange: (view: PhoneView) => void }) {
  return (
    <div role="group" aria-label="View" className="hidden shrink-0 border-b border-rule bg-panel compact:flex">
      {(['data', 'query'] as const).map((id) => (
        <button
          key={id}
          type="button"
          aria-pressed={view === id}
          onClick={() => onChange(id)}
          className={`label flex-1 border-b-2 py-2.5 ${view === id ? 'border-accent !text-ink' : 'border-transparent'}`}
        >
          {id === 'data' ? 'Data' : 'Query'}
        </button>
      ))}
    </div>
  );
}

export function App({ onFiles }: { onFiles: (files: File[]) => void }) {
  const [view, setView] = useState<PhoneView>(() => (useApp.getState().sql.trim() ? 'query' : 'data'));
  // Previewing a table, opening a saved query or running anything brings the query into view.
  useEffect(
    () =>
      useApp.subscribe((now, before) => {
        if (now.sql !== before.sql || now.query !== before.query) setView('query');
      }),
    [],
  );

  return (
    <div className="flex h-full flex-col bg-paper text-ink">
      <header className="flex shrink-0 items-center gap-4 border-b border-ink px-4 py-2 compact:gap-2">
        <h1>
          <Wordmark name={APP_NAME} />
        </h1>
        <div className="ml-auto flex min-w-0 items-center gap-4 compact:gap-2.5">
          <EngineBadge />
          <PrivacyBadge />
          <ThemeToggle />
        </div>
      </header>
      <PhoneViewSwitch view={view} onChange={setView} />
      <div className="flex min-h-0 flex-1">
        <Sidebar onFiles={onFiles} hiddenOnPhone={view !== 'data'} />
        <Workspace hiddenOnPhone={view !== 'query'} />
      </div>
    </div>
  );
}
