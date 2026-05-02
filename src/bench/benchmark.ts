import { getEngine, loadRemoteParquet } from '../db/engine';

export interface BenchQuery {
  name: string;
  sql: string;
}

/** Typical analytics queries over the NYC taxi sample (2.9M trips, 265 zones). */
export const BENCH_QUERIES: BenchQuery[] = [
  { name: 'Count all rows', sql: 'SELECT count(*) FROM bench_trips' },
  {
    name: 'Filter and aggregate',
    sql: 'SELECT avg(fare), avg(tip) FROM bench_trips WHERE distance_miles > 5 AND passengers >= 2',
  },
  {
    name: 'Group by hour (24 groups)',
    sql: 'SELECT hour(pickup_at) AS hour, count(*), avg(fare) FROM bench_trips GROUP BY hour ORDER BY hour',
  },
  {
    name: 'Group by route (tens of thousands of groups)',
    sql: `SELECT pickup_zone_id, dropoff_zone_id, count(*) AS trips
          FROM bench_trips GROUP BY ALL ORDER BY trips DESC LIMIT 10`,
  },
  {
    name: 'Join to zones and group by borough',
    sql: `SELECT z.borough, count(*) AS trips, sum(t.fare) AS revenue
          FROM bench_trips t JOIN bench_zones z ON z.zone_id = t.pickup_zone_id
          GROUP BY z.borough ORDER BY trips DESC`,
  },
  {
    name: 'Median and 95th percentile per payment type',
    sql: `SELECT payment_type, median(fare), quantile_cont(fare, 0.95)
          FROM bench_trips GROUP BY payment_type`,
  },
  {
    name: 'Top 100 by tip (sort)',
    sql: 'SELECT * FROM bench_trips ORDER BY tip DESC LIMIT 100',
  },
  {
    name: 'Daily totals with 7-day moving average (window)',
    sql: `SELECT day, trips, avg(trips) OVER (ORDER BY day ROWS 6 PRECEDING) AS moving_avg
          FROM (SELECT pickup_at::DATE AS day, count(*) AS trips FROM bench_trips GROUP BY day)
          ORDER BY day`,
  },
];

export const RUNS_PER_QUERY = 5;

export interface QueryTiming {
  name: string;
  sql: string;
  medianMs: number;
  minMs: number;
}

export interface BenchReport {
  rows: number;
  /** Download plus load of the 18 MB Parquet sample into memory. */
  loadMs: number;
  queries: QueryTiming[];
  csv: { rows: number; megabytes: number; parseMs: number };
  duckdbVersion: string;
  device: string;
  measuredAt: string;
}

export type BenchProgress = (step: string, fraction: number) => void;

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** Browser, operating system and hardware, as far as the browser reveals them. */
export function describeDevice(nav: {
  userAgent: string;
  hardwareConcurrency?: number;
  deviceMemory?: number;
}): string {
  const ua = nav.userAgent;
  const browser =
    /(Edg|OPR|Firefox|Chrome|Version)\/(\d+)/.exec(ua)?.slice(1, 3) ?? ['Unknown browser', ''];
  const names: Record<string, string> = { Edg: 'Edge', OPR: 'Opera', Version: 'Safari' };
  const os =
    /Windows NT/.test(ua) ? 'Windows'
    : /Android/.test(ua) ? 'Android'
    : /iPhone|iPad/.test(ua) ? 'iOS'
    : /Mac OS X/.test(ua) ? 'macOS'
    : /Linux/.test(ua) ? 'Linux'
    : 'Unknown OS';
  const parts = [`${names[browser[0]] ?? browser[0]} ${browser[1]}`.trim(), os];
  if (nav.hardwareConcurrency) parts.push(`${nav.hardwareConcurrency} CPU threads`);
  // Browsers cap this figure at 8 to limit fingerprinting.
  if (nav.deviceMemory) parts.push(`${nav.deviceMemory >= 8 ? '8+' : nav.deviceMemory} GB RAM`);
  return parts.join(', ');
}

const ms = (value: number) => (value < 10 ? value.toFixed(1) : String(Math.round(value)));

/** A Markdown table of the results, ready to paste into a README or CV notes. */
export function toMarkdown(report: BenchReport): string {
  const rows = report.rows.toLocaleString('en-US');
  return [
    `Measured on ${report.device}, ${report.measuredAt}, DuckDB ${report.duckdbVersion} (WebAssembly, single thread).`,
    '',
    `| Query over ${rows} rows | Median | Fastest |`,
    '| --- | ---: | ---: |',
    ...report.queries.map((q) => `| ${q.name} | ${ms(q.medianMs)} ms | ${ms(q.minMs)} ms |`),
    '',
    `- Download and load ${rows} rows (18 MB Parquet): ${(report.loadMs / 1000).toFixed(1)} s`,
    `- Parse a ${report.csv.megabytes.toFixed(0)} MB CSV with ${report.csv.rows.toLocaleString('en-US')} rows: ${(report.csv.parseMs / 1000).toFixed(1)} s`,
  ].join('\n');
}

/**
 * Runs the whole benchmark inside the visitor's browser. Each query runs
 * once to warm up and then RUNS_PER_QUERY times; the median is reported.
 */
export async function runBenchmark(onProgress: BenchProgress): Promise<BenchReport> {
  onProgress('Starting the database engine', 0);
  const { db, conn } = await getEngine();
  const totalSteps = BENCH_QUERIES.length + 2;

  const loadStart = performance.now();
  await loadRemoteParquet('/samples/zones.parquet', 'bench_zones', 'benchmark');
  const trips = await loadRemoteParquet('/samples/trips.parquet', 'bench_trips', 'benchmark', (f) =>
    onProgress('Downloading and loading 2.9M rows', f / totalSteps),
  );
  const loadMs = performance.now() - loadStart;

  const queries: QueryTiming[] = [];
  for (const [index, query] of BENCH_QUERIES.entries()) {
    onProgress(query.name, (index + 1) / totalSteps);
    await conn.query(query.sql); // warm-up
    const timings: number[] = [];
    for (let run = 0; run < RUNS_PER_QUERY; run++) {
      const start = performance.now();
      await conn.query(query.sql);
      timings.push(performance.now() - start);
    }
    queries.push({ ...query, medianMs: median(timings), minMs: Math.min(...timings) });
  }

  // CSV parsing: write a million rows out as CSV inside the worker, then time reading it back.
  onProgress('Parsing a 1M-row CSV', (totalSteps - 1) / totalSteps);
  const csvRows = Math.min(1_000_000, trips.rowCount);
  await conn.query(
    `COPY (SELECT * FROM bench_trips LIMIT ${csvRows}) TO 'bench.csv' (FORMAT csv, HEADER)`,
  );
  const [file] = await db.globFiles('bench.csv');
  const parseStart = performance.now();
  await conn.query(`CREATE OR REPLACE TABLE bench_csv AS SELECT * FROM read_csv('bench.csv')`);
  const parseMs = performance.now() - parseStart;

  const version = await conn.query('SELECT version() AS v');
  await conn.query('DROP TABLE IF EXISTS bench_csv; DROP TABLE IF EXISTS bench_trips; DROP TABLE IF EXISTS bench_zones');
  await db.dropFile('bench.csv').catch(() => {});
  onProgress('Done', 1);

  return {
    rows: trips.rowCount,
    loadMs,
    queries,
    csv: { rows: csvRows, megabytes: (file?.fileSize ?? 0) / 1_000_000, parseMs },
    duckdbVersion: String(version.toArray()[0].v),
    device: describeDevice(navigator as Navigator & { deviceMemory?: number }),
    measuredAt: new Date().toISOString().slice(0, 10),
  };
}
