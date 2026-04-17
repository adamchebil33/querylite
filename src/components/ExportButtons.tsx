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
    <span className="flex items-center gap-1.5">
      {error && (
        <span role="alert" className="max-w-64 truncate text-xs text-red-600" title={error}>
          {error}
        </span>
      )}
      <span className="text-xs text-slate-500">Export</span>
      {(['csv', 'parquet'] as const).map((format) => (
        <button
          key={format}
          type="button"
          disabled={busy !== null}
          onClick={() => void save(format)}
          title={`Download the full result as ${format === 'csv' ? 'CSV' : 'Parquet'}`}
          className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          {busy === format ? 'Saving…' : format === 'csv' ? 'CSV' : 'Parquet'}
        </button>
      ))}
    </span>
  );
}
