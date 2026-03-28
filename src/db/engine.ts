import * as duckdb from '@duckdb/duckdb-wasm';
import { type FileKind, quoteIdent, quoteLiteral } from '../lib/files';

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

export async function dropTable(tableName: string): Promise<void> {
  const { conn } = await getEngine();
  await conn.query(`DROP TABLE IF EXISTS ${quoteIdent(tableName)}`);
}

/** Shortens DuckDB's verbose error text to the part a user can act on. */
export function friendlyError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.split('\n').find((line) => line.trim().length > 0)?.trim() ?? 'Unknown error';
}
