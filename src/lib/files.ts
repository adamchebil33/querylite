export type FileKind = 'csv' | 'json' | 'parquet' | 'excel';

const EXTENSIONS: Record<string, FileKind> = {
  csv: 'csv',
  tsv: 'csv',
  txt: 'csv',
  json: 'json',
  jsonl: 'json',
  ndjson: 'json',
  parquet: 'parquet',
  xlsx: 'excel',
};

export const ACCEPTED_EXTENSIONS = Object.keys(EXTENSIONS).map((ext) => `.${ext}`);

/** Detects how a file should be read from its extension, or null if unsupported. */
export function fileKind(fileName: string): FileKind | null {
  const ext = fileName.toLowerCase().split('.').pop() ?? '';
  return EXTENSIONS[ext] ?? null;
}

/**
 * Turns a file name into a SQL-friendly table name that needs no quoting:
 * "Sales Report (2025).csv" -> "sales_report_2025". Appends _2, _3... if taken.
 */
export function tableNameFor(fileName: string, taken: Iterable<string> = []): string {
  const stem = fileName.replace(/\.[^.]+$/, '');
  let base = stem
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!base) base = 'data';
  if (/^[0-9]/.test(base)) base = `t_${base}`;

  const used = new Set([...taken].map((name) => name.toLowerCase()));
  if (!used.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}_${n}`;
    if (!used.has(candidate)) return candidate;
  }
}

/** Quotes an identifier for use in SQL. */
export function quoteIdent(name: string): string {
  return `"${name.replaceAll('"', '""')}"`;
}

/** Quotes a string literal for use in SQL. */
export function quoteLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value >= 10 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}
