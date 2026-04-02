import { useCallback, useEffect, useMemo } from 'react';
import { DropZone } from './components/DropZone';
import { Results, ResultSummary } from './components/Results';
import { Sidebar } from './components/Sidebar';
import { SqlEditor, type SqlSchema } from './components/SqlEditor';
import { APP_NAME, APP_TAGLINE } from './config';
import { useApp } from './state/store';

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

function Workspace() {
  const sql = useApp((s) => s.sql);
  const setSql = useApp((s) => s.setSql);
  const run = useApp((s) => s.run);
  const tables = useApp((s) => s.tables);
  const running = useApp((s) => s.query.status === 'running');

  const schema = useMemo<SqlSchema>(
    () => Object.fromEntries(tables.map((t) => [t.name, t.columns.map((c) => c.name)])),
    [tables],
  );
  const onRun = useCallback(() => void run(), [run]);

  return (
    <section className="flex min-w-0 flex-1 flex-col">
      <div className="h-56 shrink-0 border-b border-slate-200 bg-white dark:border-slate-800">
        <SqlEditor value={sql} onChange={setSql} onRun={onRun} schema={schema} />
      </div>
      <div className="flex shrink-0 items-center gap-3 border-b border-slate-200 px-3 py-2 dark:border-slate-800">
        <button
          type="button"
          disabled={running || sql.trim() === ''}
          onClick={onRun}
          className="flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <svg viewBox="0 0 12 12" aria-hidden className="h-3 w-3 fill-current">
            <path d="M3 1.500l7 4.500-7 4.500z" />
          </svg>
          Run
        </button>
        <kbd className="text-xs text-slate-400">Ctrl/Cmd + Enter</kbd>
        <div className="ml-auto">
          <ResultSummary />
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <Results />
      </div>
    </section>
  );
}

export function App() {
  const startEngine = useApp((s) => s.startEngine);
  const addFiles = useApp((s) => s.addFiles);

  useEffect(() => {
    startEngine();
  }, [startEngine]);

  const onFiles = useCallback((files: File[]) => void addFiles(files), [addFiles]);

  return (
    <DropZone onFiles={onFiles}>
      <div className="flex h-full flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <header className="flex shrink-0 items-center gap-3 border-b border-slate-200 px-4 py-2.5 dark:border-slate-800">
          <img src="/favicon.svg" alt="" className="h-6 w-6" />
          <h1 className="text-lg font-semibold">{APP_NAME}</h1>
          <p className="hidden truncate text-sm text-slate-500 lg:block">{APP_TAGLINE}</p>
          <div className="ml-auto shrink-0">
            <EngineBadge />
          </div>
        </header>
        <div className="flex min-h-0 flex-1">
          <Sidebar onFiles={onFiles} />
          <Workspace />
        </div>
      </div>
    </DropZone>
  );
}
