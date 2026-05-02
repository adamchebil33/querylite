import { APP_TAGLINE } from '../config';
import { SAMPLES } from '../samples';
import { useApp } from '../state/store';
import { FilePickerButton } from './DropZone';

/** First thing a visitor sees: one click to a working demo, no file needed. */
export function Welcome({ onFiles }: { onFiles: (files: File[]) => void }) {
  const loadSample = useApp((s) => s.loadSample);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-3xl flex-col items-center px-6 py-10 text-center">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          A real analytics database, running in this tab
        </h2>
        <p className="mt-3 max-w-xl text-slate-600 dark:text-slate-400">{APP_TAGLINE}</p>

        <h3 className="mt-8 text-xs font-semibold tracking-wide text-slate-500 uppercase">
          Try a sample dataset
        </h3>
        <div className="mt-3 grid w-full gap-3 sm:grid-cols-2">
          {SAMPLES.map((sample) => (
            <button
              key={sample.id}
              type="button"
              data-testid={`sample-${sample.id}`}
              onClick={() => void loadSample(sample.id)}
              className="group rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-indigo-400 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-500"
            >
              <span className="flex items-baseline justify-between gap-2">
                <span className="font-semibold group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                  {sample.name}
                </span>
                <span className="shrink-0 text-xs text-slate-500">
                  {sample.rows} · {sample.download}
                </span>
              </span>
              <span className="mt-1 block text-sm text-slate-600 dark:text-slate-400">
                {sample.description}
              </span>
              <span className="mt-2 block text-xs text-slate-400">Source: {sample.source}</span>
            </button>
          ))}
        </div>

        <p className="mt-8 text-sm text-slate-600 dark:text-slate-400">
          Or drag and drop your own CSV, TSV, JSON or Parquet files anywhere on this page.
        </p>
        <FilePickerButton
          onFiles={onFiles}
          testId="welcome-file-input"
          className="mt-3 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          Choose files
        </FilePickerButton>
        <p className="mt-3 text-xs text-slate-500">
          Your files are read on this device and never uploaded.
        </p>
        <a href="/bench" className="mt-6 text-xs text-indigo-600 hover:underline dark:text-indigo-400">
          How fast is it on your device? Run the benchmark
        </a>
      </div>
    </div>
  );
}
