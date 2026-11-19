import { APP_NAME, REPO_URL } from '../config';
import { APP_PATH, navigate } from '../lib/router';
import { SAMPLES } from '../samples';
import { useApp } from '../state/store';
import { FilePickerButton } from './DropZone';
import { PrivacyBadge } from './PrivacyBadge';
import { ThemeToggle, Wordmark } from './ThemeToggle';

/**
 * Figures from the /bench page, measured in Chrome 158 on a 4-thread Linux
 * laptop on 2026-11-19 (DuckDB v1.5.4). Update them from a fresh run if the engine changes.
 */
const MEASURED = [
  { value: '24 ms', label: 'to join and group 2.87 million rows' },
  { value: '2.2 ms', label: 'to count 2.87 million rows' },
  { value: '0.5 s', label: 'to parse a 59 MB CSV with a million rows' },
];

const HOW_IT_WORKS = [
  {
    title: 'The database runs in your tab',
    text: 'DuckDB, a real analytics database, is compiled to WebAssembly and runs in a background thread. The page stays responsive while it chews through millions of rows.',
  },
  {
    title: 'Nothing is uploaded',
    text: 'Your files are read where they are. A security policy makes the browser refuse to send anything to any other site, and you can watch the Network tab to check.',
  },
  {
    title: 'Ask in SQL or in plain English',
    text: 'Write SQL with autocomplete, or describe what you want and let AI draft the query. The AI only ever sees your column names, never your data.',
  },
];

function openSample(id: string) {
  void useApp.getState().loadSample(id);
  navigate(APP_PATH);
}

/** The front page: what the product is, proof that it works, and one click into it. */
export function Landing({ onFiles }: { onFiles: (files: File[]) => void }) {
  return (
    <div className="h-full overflow-y-auto bg-paper text-ink">
      <header className="mx-auto flex max-w-5xl items-center gap-4 px-6 py-4">
        <Wordmark name={APP_NAME} />
        <div className="ml-auto flex items-center gap-5">
          <PrivacyBadge />
          <ThemeToggle />
          <button type="button" className="btn" onClick={() => navigate(APP_PATH)}>
            Open the editor
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 pb-20">
        <section className="border-t border-ink pt-14">
          <h1 className="font-serif text-[44px] leading-[1.08] tracking-tight sm:text-[60px]">
            Query millions of rows
            <br />
            <span className="italic">without uploading one.</span>
          </h1>
          <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-muted">
            Drop in a CSV, Parquet, JSON or Excel file and ask questions in SQL. The database runs
            inside this tab, so your data never leaves your computer.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="btn btn-primary !px-4 !py-2 !text-[14px]"
              onClick={() => openSample(SAMPLES[0].id)}
            >
              Try it on 2.9 million taxi trips
            </button>
            <FilePickerButton onFiles={onFiles} testId="landing-file-input" className="btn !px-4 !py-2 !text-[14px]">
              Choose your own files
            </FilePickerButton>
            <span className="text-[13px] text-muted">or drop files anywhere on this page</span>
          </div>
        </section>

        <figure className="mt-14 border border-ink">
          <img
            src="/media/workspace-light.png"
            alt="The editor showing a query over 2.9 million taxi trips with a results table and a bar chart"
            width={1380}
            height={820}
            className="block h-auto w-full dark:hidden"
          />
          <img
            src="/media/workspace-dark.png"
            alt=""
            aria-hidden
            width={1380}
            height={820}
            className="hidden h-auto w-full dark:block"
          />
        </figure>

        <section className="mt-16">
          <h2 className="label">Measured, not estimated</h2>
          <dl className="mt-2 grid border-t border-ink sm:grid-cols-3">
            {MEASURED.map((item) => (
              <div key={item.label} className="border-b border-rule py-5 sm:border-b-0 sm:border-l sm:px-5 sm:first:border-l-0 sm:first:pl-0">
                <dt className="font-serif text-[40px] leading-none">{item.value}</dt>
                <dd className="mt-2 text-[14px] text-muted">{item.label}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 border-t border-rule pt-3 font-mono text-[11px] text-faint">
            Chrome on a 4-thread Linux laptop.{' '}
            <a href="/bench" className="link">
              Run the benchmark on your device
            </a>
          </p>
        </section>

        <section className="mt-16">
          <h2 className="label">Try a sample dataset</h2>
          <ul className="mt-2 border-t border-ink">
            {SAMPLES.map((sample, index) => (
              <li key={sample.id} className="border-b border-rule">
                <button
                  type="button"
                  data-testid={`sample-${sample.id}`}
                  onClick={() => openSample(sample.id)}
                  className="group grid w-full grid-cols-[2rem_1fr_auto] items-baseline gap-x-3 px-1 py-4 text-left hover:bg-wash"
                >
                  <span className="font-mono text-[11px] text-faint">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span>
                    <span className="text-[17px] font-semibold">{sample.name}</span>
                    <span className="mt-0.5 block text-[14px] text-muted">{sample.description}</span>
                    <span className="mt-1 block font-mono text-[11px] text-faint">
                      Source: {sample.source}
                    </span>
                  </span>
                  <span className="text-right font-mono text-[12px] text-muted">
                    {sample.rows} · {sample.download}
                    <span className="mt-1 block text-accent group-hover:text-ink">Load →</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-16">
          <h2 className="label">How it works</h2>
          <ol className="mt-2 grid gap-x-8 border-t border-ink sm:grid-cols-3">
            {HOW_IT_WORKS.map((step, index) => (
              <li key={step.title} className="pt-5">
                <span className="font-mono text-[11px] text-faint">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h3 className="mt-1 text-[17px] font-semibold">{step.title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-muted">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <footer className="mt-20 flex flex-wrap items-baseline gap-x-6 gap-y-2 border-t border-ink pt-4 font-mono text-[11px] text-faint">
          <span>{APP_NAME.toLowerCase()}</span>
          <a href="/bench" className="hover:text-ink">
            Benchmark
          </a>
          <a href={REPO_URL} rel="noreferrer" className="hover:text-ink">
            Source on GitHub
          </a>
          {SAMPLES.map((sample) => (
            <a key={sample.id} href={sample.sourceUrl} rel="noreferrer" className="hover:text-ink">
              Data: {sample.source}
            </a>
          ))}
        </footer>
      </main>
    </div>
  );
}
