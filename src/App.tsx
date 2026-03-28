import { useCallback, useEffect } from 'react';
import { DropZone, FilePickerButton } from './components/DropZone';
import { TableList } from './components/TableList';
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

export function App() {
  const startEngine = useApp((s) => s.startEngine);
  const addFiles = useApp((s) => s.addFiles);
  const isEmpty = useApp((s) => s.tables.length === 0 && s.loads.length === 0);

  useEffect(() => {
    startEngine();
  }, [startEngine]);

  const onFiles = useCallback((files: File[]) => void addFiles(files), [addFiles]);

  return (
    <DropZone onFiles={onFiles}>
      <div className="flex h-full flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <header className="flex items-center gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <img src="/favicon.svg" alt="" className="h-6 w-6" />
          <h1 className="text-lg font-semibold">{APP_NAME}</h1>
          <div className="ml-auto">
            <EngineBadge />
          </div>
        </header>
        <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 p-6">
          {isEmpty && <p className="text-center text-slate-600 dark:text-slate-400">{APP_TAGLINE}</p>}
          <div className="rounded-2xl border-2 border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
            <p className="font-medium">Drag and drop CSV, TSV, JSON or Parquet files</p>
            <p className="mt-1 text-sm text-slate-500">
              Each file becomes a table. Files are read on your device and never uploaded.
            </p>
            <FilePickerButton
              onFiles={onFiles}
              className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
            >
              Choose files
            </FilePickerButton>
          </div>
          <TableList />
        </main>
      </div>
    </DropZone>
  );
}
