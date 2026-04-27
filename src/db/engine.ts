import * as duckdb from '@duckdb/duckdb-wasm';
import { type RecordBatch, Table } from 'apache-arrow';
import { type FileKind, quoteIdent, quoteLiteral } from '../lib/files';
import { withoutTrailingSemicolon } from '../lib/sql';

export interface ColumnInfo {
  name: string;
  type: string;
}

export interface TableInfo {
  name: string;
  columns: ColumnInfo[];
  rowCount: number;
  /** Where the table came from, e.g. the original file name. */
  source: string;
}

export type BootProgress = (fraction: number) => void;

interface Engine {
  db: duckdb.AsyncDuckDB;
  conn: duckdb.AsyncDuckDBConnection;
}

let enginePromise: Promise<Engine> | null = null;

/**
 * Starts DuckDB once and reuses it. The database runs in its own Web Worker,
 * so queries and file parsing never block the UI thread.
 *
 * The WebAssembly binaries are fetched from jsDelivr because they exceed
 * Cloudflare's per-asset size limit. Only code is downloaded; no data is sent.
 */
export function getEngine(onProgress?: BootProgress): Promise<Engine> {
  enginePromise ??= boot(onProgress).catch((error) => {
    enginePromise = null; // allow a retry
    throw error;
  });
  return enginePromise;
}

async function boot(onProgress?: BootProgress): Promise<Engine> {
  const bundle = await duckdb.selectBundle(duckdb.getJsDelivrBundles());

  // A worker script must be same-origin, so wrap the CDN script in a blob.
  const workerUrl = URL.createObjectURL(
    new Blob([`importScripts(${JSON.stringify(bundle.mainWorker)});`], {
      type: 'text/javascript',
    }),
  );
  try {
    const worker = new Worker(workerUrl);
    const db = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), worker);
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker, (p) => {
      if (p.bytesTotal > 0) onProgress?.(Math.min(1, p.bytesLoaded / p.bytesTotal));
    });
    const conn = await db.connect();
    return { db, conn };
  } finally {
    URL.revokeObjectURL(workerUrl);
  }
}

function readerFor(kind: FileKind, registeredName: string): string {
  const file = quoteLiteral(registeredName);
  switch (kind) {
    case 'csv':
      return `read_csv(${file})`;
    case 'json':
      return `read_json_auto(${file})`;
    case 'parquet':
      return `read_parquet(${file})`;
  }
}

let fileCounter = 0;

/**
 * Loads a local file into a table. The file is handed to the DuckDB worker as
 * a browser File handle and read there in chunks: it is never copied onto the
 * main thread and never leaves the device.
 */
export async function loadFile(file: File, kind: FileKind, tableName: string): Promise<TableInfo> {
  const { db, conn } = await getEngine();
  const extension = file.name.split('.').pop() ?? kind;
  const registeredName = `upload_${++fileCounter}.${extension}`;

  await db.registerFileHandle(
    registeredName,
    file,
    duckdb.DuckDBDataProtocol.BROWSER_FILEREADER,
    true,
  );
  try {
    await conn.query(
      `CREATE OR REPLACE TABLE ${quoteIdent(tableName)} AS SELECT * FROM ${readerFor(kind, registeredName)}`,
    );
  } finally {
    await db.dropFile(registeredName).catch(() => {});
  }
  return describeTable(tableName, file.name);
}

/**
 * Loads a Parquet file served by this site (a sample dataset) into a table,
 * reporting download progress as a fraction between 0 and 1.
 */
export async function loadRemoteParquet(
  url: string,
  tableName: string,
  source: string,
  onProgress?: (fraction: number) => void,
): Promise<TableInfo> {
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`Could not download ${url} (HTTP ${response.status})`);
  }
  const total = Number(response.headers.get('content-length')) || 0;
  const chunks: Uint8Array[] = [];
  let received = 0;
  const reader = response.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    if (total > 0) onProgress?.(Math.min(1, received / total));
  }
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }

  const { db, conn } = await getEngine();
  const registeredName = `sample_${++fileCounter}.parquet`;
  await db.registerFileBuffer(registeredName, bytes);
  try {
    await conn.query(
      `CREATE OR REPLACE TABLE ${quoteIdent(tableName)} AS SELECT * FROM read_parquet(${quoteLiteral(registeredName)})`,
    );
  } finally {
    await db.dropFile(registeredName).catch(() => {});
  }
  return describeTable(tableName, source);
}

export async function describeTable(tableName: string, source: string): Promise<TableInfo> {
  const { conn } = await getEngine();
  const described = await conn.query(`DESCRIBE ${quoteIdent(tableName)}`);
  const columns: ColumnInfo[] = described.toArray().map((row) => ({
    name: String(row.column_name),
    type: String(row.column_type),
  }));
  const counted = await conn.query(`SELECT count(*)::DOUBLE AS n FROM ${quoteIdent(tableName)}`);
  const rowCount = Number(counted.toArray()[0]?.n ?? 0);
  return { name: tableName, columns, rowCount, source };
}

/** Lists every table and view in the database, including ones created by queries. */
export async function listTables(known: TableInfo[] = []): Promise<TableInfo[]> {
  const { conn } = await getEngine();
  const result = await conn.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'main' ORDER BY table_name`,
  );
  const sources = new Map(known.map((t) => [t.name, t.source]));
  const order = new Map(known.map((t, i) => [t.name, i]));
  const names = result.toArray().map((row) => String(row.table_name));
  const tables = await Promise.all(
    names.map((name) => describeTable(name, sources.get(name) ?? 'Created by a query')),
  );
  // Keep the order tables were added in; new ones go last.
  return tables.sort(
    (a, b) => (order.get(a.name) ?? Infinity) - (order.get(b.name) ?? Infinity),
  );
}

/** Rows kept in memory for display. Larger results are cut off; exports re-run the query. */
export const MAX_RESULT_ROWS = 100_000;

export interface QueryResult {
  table: Table;
  /** True if the query produced more than MAX_RESULT_ROWS rows. */
  truncated: boolean;
  elapsedMs: number;
}

/** Runs SQL and streams the result back, stopping once the display limit is reached. */
export async function runQuery(sql: string, maxRows = MAX_RESULT_ROWS): Promise<QueryResult> {
  const { conn } = await getEngine();
  const started = performance.now();
  const reader = await conn.send(sql, true);
  const batches: RecordBatch[] = [];
  let rows = 0;
  let truncated = false;
  for await (const batch of reader) {
    batches.push(batch);
    rows += batch.numRows;
    if (rows > maxRows) {
      truncated = true;
      await conn.cancelSent().catch(() => {});
      break;
    }
  }
  const elapsedMs = performance.now() - started;
  const full = new Table(reader.schema, batches);
  return { table: truncated ? full.slice(0, maxRows) : full, truncated, elapsedMs };
}

export type ExportFormat = 'csv' | 'parquet';

/**
 * Re-runs a query and writes its full result (not just the rows on screen)
 * to a file inside the database worker, then hands back the bytes.
 */
export async function exportQuery(sql: string, format: ExportFormat): Promise<Uint8Array> {
  const { db, conn } = await getEngine();
  const fileName = `export_${++fileCounter}.${format}`;
  const inner = withoutTrailingSemicolon(sql);
  const options = format === 'csv' ? 'FORMAT csv, HEADER' : 'FORMAT parquet';
  try {
    await conn.query(`COPY (\n${inner}\n) TO ${quoteLiteral(fileName)} (${options})`);
    return await db.copyFileToBuffer(fileName);
  } finally {
    await db.dropFile(fileName).catch(() => {});
  }
}

/**
 * Checks that SQL is exactly one read-only SELECT statement, using DuckDB's
 * own parser rather than pattern matching: `json_serialize_sql` refuses
 * anything that isn't a SELECT (INSERT, DROP, COPY, PRAGMA...).
 * Used to vet AI-written SQL before it is offered to the user.
 */
export async function checkReadOnly(sql: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  const { conn } = await getEngine();
  try {
    const statement = await conn.prepare('SELECT json_serialize_sql(?::VARCHAR) AS parsed');
    const result = await statement.query(sql);
    await statement.close();
    const parsed = JSON.parse(String(result.toArray()[0].parsed)) as {
      error: boolean;
      error_message?: string;
      statements?: unknown[];
    };
    if (parsed.error) return { ok: false, reason: parsed.error_message ?? 'It could not be parsed.' };
    if (parsed.statements?.length !== 1) return { ok: false, reason: 'It contains more than one statement.' };
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: friendlyError(error) };
  }
}

/** Asks DuckDB to stop the query that is currently running. */
export async function cancelQuery(): Promise<void> {
  const { conn } = await getEngine();
  await conn.cancelSent().catch(() => {});
}

export async function dropTable(tableName: string): Promise<void> {
  const { conn } = await getEngine();
  // The name may belong to a view if a query created it.
  await conn
    .query(`DROP TABLE IF EXISTS ${quoteIdent(tableName)}`)
    .catch(() => conn.query(`DROP VIEW IF EXISTS ${quoteIdent(tableName)}`));
}

export function errorMessage(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).trim() || 'Unknown error';
}

/** Shortens DuckDB's verbose error text to its first line. */
export function friendlyError(error: unknown): string {
  return errorMessage(error).split('\n')[0].trim();
}
