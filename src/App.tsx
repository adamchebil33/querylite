import { useCallback, useEffect, useMemo } from 'react';
import { AiNotice, AskBar } from './components/AskBar';
import { DropZone } from './components/DropZone';
import { ExampleChips } from './components/ExampleChips';
import { PrivacyBadge } from './components/PrivacyBadge';
import { QueryActions } from './components/QueryActions';
import { Results, ResultSummary } from './components/Results';
import { Sidebar } from './components/Sidebar';
import { SqlEditor, type SqlSchema } from './components/SqlEditor';
import { APP_NAME, APP_TAGLINE } from './config';
import { useApp } from './state/store';
import { useTheme } from './state/theme';

function EngineBadge() {
  const engine = useApp((s) => s.engine);
  const startEngine = useApp((s) => s.startEngine);
  if (engine.state === 'ready') {
    return (
      <span data-testid="engine-status" className="text-xs text-emerald-600 dark:text-emerald-400">
        ● Engine ready
      </span>
    );
  }
  if (engine.state === 'error') {
    return (
      <span data-testid="engine-status" className="text-xs text-red-600">
        Engine failed to start: {engine.message}{' '}
        <button type="button" className="underline" onClick={startEngine}>
          Retry
        </button>
      </span>
    );
  }
  return (
    <span data-testid="engine-status" className="text-xs text-slate-500">
      Starting engine… {Math.round(engine.progress * 100)}%
    </span>
  );
}

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      className="rounded-md p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100"
    >
      <svg viewBox="0 0 16 16" aria-hidden className="h-4 w-4 fill-current">
        {theme === 'dark' ? (
          <path d="M8 11.500a3.500 3.500 0 1 0 0-7 3.500 3.500 0 0 0 0 7zM8 0l1 2.500H7L8 0zm0 16l-1-2.500h2L8 16zM0 8l2.500-1v2L0 8zm16 0l-2.500 1V7L16 8zM2.300 2.300l2.500 1-1.400 1.400-1.100-2.400zm11.400 11.400l-2.500-1 1.400-1.400 1.100 2.400zm0-11.400l-1.100 2.400-1.400-1.400 2.500-1zM2.300 13.700l1.100-2.400 1.400 1.400-2.500 1z" />
        ) : (
          <path d="M6 .5a7.500 7.500 0 1 0 9.500 9.500A6 6 0 0 1 6 .5z" />
        )}
      </svg>
    </button>
  );
}

function Workspace({ onFiles }: { onFiles: (files: File[]) => void }) {
  const sql = useApp((s) => s.sql);
  const setSql = useApp((s) => s.setSql);
  const run = useApp((s) => s.run);
  const tables = useApp((s) => s.tables);
  const running = useApp((s) => s.query.status === 'running');
  const cancel = useApp((s) => s.cancel);
  const dark = useTheme((s) => s.theme === 'dark');

  const schema = useMemo<SqlSchema>(
    () => Object.fromEntries(tables.map((t) => [t.name, t.columns.map((c) => c.name)])),
    [tables],
  );
  const onRun = useCallback(() => void run(), [run]);

  return (
    <section className="flex min-w-0 flex-1 flex-col">
      <AskBar />
      <div className="h-48 shrink-0 border-b border-slate-200 bg-white dark:border-slate-800">
        <SqlEditor value={sql} onChange={setSql} onRun={onRun} schema={schema} dark={dark} />
      </div>
      <div className="flex shrink-0 items-center gap-3 border-b border-slate-200 px-3 py-2 dark:border-slate-800">
        {running ? (
          <button
            type="button"
            onClick={cancel}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
        ) : (
          <button
            type="button"
            disabled={sql.trim() === ''}
            onClick={onRun}
            className="flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg viewBox="0 0 12 12" aria-hidden className="h-3 w-3 fill-current">
              <path d="M3 1.500l7 4.500-7 4.500z" />
            </svg>
            Run
          </button>
        )}
        <kbd className="hidden text-xs text-slate-400 xl:inline">Ctrl/Cmd + Enter</kbd>
        <QueryActions />
        <div className="ml-auto">
          <ResultSummary />
        </div>
      </div>
      <AiNotice />
      <ExampleChips />
      <div className="min-h-0 flex-1">
        <Results onFiles={onFiles} />
      </div>
    </section>
  );
}

export function App() {
  const startEngine = useApp((s) => s.startEngine);
  const addFiles = useApp((s) => s.addFiles);

  useEffect(() => {
    startEngine();
    // A share link carries its query in the URL fragment.
    void useApp.getState().openSharedLink(location.hash);
  }, [startEngine]);

  const onFiles = useCallback((files: File[]) => void addFiles(files), [addFiles]);

  return (
    <DropZone onFiles={onFiles}>
      <div className="flex h-full flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <header className="flex shrink-0 items-center gap-3 border-b border-slate-200 px-4 py-2.5 dark:border-slate-800">
          <img src="/favicon.svg" alt="" className="h-6 w-6" />
          <h1 className="text-lg font-semibold">{APP_NAME}</h1>
          <p className="hidden truncate text-sm text-slate-500 lg:block">{APP_TAGLINE}</p>
          <div className="ml-auto flex shrink-0 items-center gap-3">
            <EngineBadge />
            <PrivacyBadge />
            <ThemeToggle />
          </div>
        </header>
        <div className="flex min-h-0 flex-1">
          <Sidebar onFiles={onFiles} />
          <Workspace onFiles={onFiles} />
        </div>
      </div>
    </DropZone>
  );
}
