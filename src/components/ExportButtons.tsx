import { useState } from 'react';
import { APP_NAME } from '../config';
import { exportQuery, friendlyError, type ExportFormat } from '../db/engine';

const MIME: Record<ExportFormat, string> = {
  csv: 'text/csv',
  parquet: 'application/vnd.apache.parquet',
};

function download(bytes: Uint8Array, fileName: string, type: string) {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Saves the full result of a query (not just the rows on screen) as a file. */
export function ExportButtons({ sql }: { sql: string }) {
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  const [error, setError] = useState<string | null>(null);

  const save = async (format: ExportFormat) => {
    setBusy(format);
    setError(null);
    try {
      const bytes = await exportQuery(sql, format);
      download(bytes, `${APP_NAME.toLowerCase()}-result.${format}`, MIME[format]);
    } catch (problem) {
      setError(`Export failed: ${friendlyError(problem)}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <span className="flex items-baseline gap-2.5">
      {error && (
        <span role="alert" className="max-w-64 truncate text-xs text-danger" title={error}>
          {error}
        </span>
      )}
      <span className="label">Export</span>
      {(['csv', 'parquet'] as const).map((format) => (
        <button
          key={format}
          type="button"
          disabled={busy !== null}
          onClick={() => void save(format)}
          title={`Download the full result as ${format === 'csv' ? 'CSV' : 'Parquet'}`}
          className="font-mono text-[12px] text-ink underline decoration-rule decoration-1 underline-offset-4 hover:decoration-ink disabled:opacity-50"
        >
          {busy === format ? 'Saving…' : format === 'csv' ? 'CSV' : 'Parquet'}
        </button>
      ))}
    </span>
  );
}
