import { useState } from 'react';
import { APP_NAME } from '../config';
import { friendlyError } from '../db/engine';
import { RUNS_PER_QUERY, runBenchmark, toMarkdown, type BenchReport } from './benchmark';

const formatMs = (value: number) => (value < 10 ? value.toFixed(1) : Math.round(value).toLocaleString('en-US'));

/** /bench: times typical queries on 2.9M rows in the visitor's own browser. */
export function BenchPage() {
  const [progress, setProgress] = useState<{ step: string; fraction: number } | null>(null);
  const [report, setReport] = useState<BenchReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const running = progress !== null;

  const start = async () => {
    setError(null);
    setReport(null);
    setProgress({ step: 'Starting', fraction: 0 });
    try {
      setReport(await runBenchmark((step, fraction) => setProgress({ step, fraction })));
    } catch (problem) {
      setError(friendlyError(problem));
    } finally {
      setProgress(null);
    }
  };

  const copy = async () => {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(toMarkdown(report));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Could not copy. Select the text in the box below instead.');
    }
  };

  return (
    <div className="min-h-full bg-paper text-ink">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <a href="/" className="link text-sm">
          ← Back to {APP_NAME}
        </a>
        <h1 className="mt-6 font-serif text-[40px] leading-tight tracking-tight">Benchmark</h1>
        <p className="mt-3 max-w-2xl leading-relaxed text-muted">
          Times typical analytics queries over 2.9 million NYC taxi trips, running entirely in this
          browser tab. Each query runs once to warm up, then {RUNS_PER_QUERY} more times; the median
          is reported. Results depend on your device, so they are labelled with it.
        </p>

        <button
          type="button"
          onClick={() => void start()}
          disabled={running}
          className="btn btn-primary mt-6 !px-4 !py-2 !text-sm"
        >
          {running ? 'Running…' : report ? 'Run again' : 'Run benchmark'}
        </button>

        {progress && (
          <div className="mt-6" role="status">
            <div className="h-0.5 bg-rule">
              <div
                className="h-full bg-accent transition-[width]"
                style={{ width: `${Math.round(progress.fraction * 100)}%` }}
              />
            </div>
            <p className="mt-2 font-mono text-xs text-muted">{progress.step}</p>
          </div>
        )}

        {error && (
          <p role="alert" className="mt-6 border-l-2 border-danger bg-danger-wash p-3 text-sm">
            {error}
          </p>
        )}

        {report && (
          <section className="mt-8" data-testid="bench-report">
            <p className="font-mono text-xs text-muted">
              Measured on {report.device}, {report.measuredAt}, DuckDB {report.duckdbVersion}{' '}
              (WebAssembly, single thread).
            </p>
            <table className="mt-3 w-full border-collapse text-sm">
              <thead>
                <tr className="label border-y border-ink text-left">
                  <th className="py-2 pr-3 font-normal">
                    Query over {report.rows.toLocaleString('en-US')} rows
                  </th>
                  <th className="py-2 pl-3 text-right font-normal">Median</th>
                  <th className="py-2 pl-3 text-right font-normal">Fastest</th>
                </tr>
              </thead>
              <tbody>
                {report.queries.map((query) => (
                  <tr key={query.name} className="border-b border-rule">
                    <td className="py-2 pr-3" title={query.sql.replace(/\s+/g, ' ')}>
                      {query.name}
                    </td>
                    <td className="py-2 pl-3 text-right font-mono tabular-nums">
                      {formatMs(query.medianMs)} ms
                    </td>
                    <td className="py-2 pl-3 text-right font-mono text-muted tabular-nums">
                      {formatMs(query.minMs)} ms
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-muted">
              <li>
                Download and load {report.rows.toLocaleString('en-US')} rows (18 MB Parquet):{' '}
                <strong>{(report.loadMs / 1000).toFixed(1)} s</strong> (includes your network speed)
              </li>
              <li>
                Parse a {report.csv.megabytes.toFixed(0)} MB CSV with{' '}
                {report.csv.rows.toLocaleString('en-US')} rows:{' '}
                <strong>{(report.csv.parseMs / 1000).toFixed(1)} s</strong>
              </li>
            </ul>

            <div className="mt-6 flex items-center gap-3">
              <button
                type="button"
                onClick={() => void copy()}
                className="btn"
              >
                {copied ? 'Copied' : 'Copy as Markdown'}
              </button>
              <span className="text-xs text-muted">Hover a query name to see its SQL.</span>
            </div>
            <textarea
              readOnly
              aria-label="Benchmark results as Markdown"
              value={toMarkdown(report)}
              rows={report.queries.length + 8}
              className="mt-3 w-full border border-rule bg-panel p-3 font-mono text-xs"
            />
          </section>
        )}
      </div>
    </div>
  );
}
