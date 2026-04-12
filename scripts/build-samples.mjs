// Builds the sample datasets in public/samples/ from their public sources.
// Run with: npm run build:samples
//
// Sources and licenses are credited in the README:
// - NYC Taxi & Limousine Commission trip records (public NYC open data)
// - Our World in Data, CO2 and greenhouse gas emissions (CC BY 4.0)
import { DuckDBInstance } from '@duckdb/node-api';
import { createWriteStream } from 'node:fs';
import { mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const root = path.join(import.meta.dirname, '..');
const cacheDir = path.join(root, '.cache', 'samples');
const outDir = path.join(root, 'public', 'samples');

const SOURCES = {
  trips: 'https://d37ci6vzurychx.cloudfront.net/trip-data/yellow_tripdata_2024-01.parquet',
  zones: 'https://d37ci6vzurychx.cloudfront.net/misc/taxi_zone_lookup.csv',
  emissions: 'https://owid-public.owid.io/data/co2/owid-co2-data.csv',
};

async function download(name) {
  const url = SOURCES[name];
  const file = path.join(cacheDir, path.basename(new URL(url).pathname));
  try {
    await stat(file);
    console.log(`cached      ${path.basename(file)}`);
  } catch {
    console.log(`downloading ${url}`);
    const response = await fetch(url);
    if (!response.ok || !response.body) throw new Error(`${url}: HTTP ${response.status}`);
    await pipeline(Readable.fromWeb(response.body), createWriteStream(file));
  }
  return file.replaceAll("'", "''");
}

await mkdir(cacheDir, { recursive: true });
await mkdir(outDir, { recursive: true });
const [trips, zones, emissions] = await Promise.all(Object.keys(SOURCES).map(download));

const db = await (await DuckDBInstance.create(':memory:')).connect();
const out = (name) => path.join(outDir, name).replaceAll("'", "''");
const PARQUET = '(FORMAT parquet, COMPRESSION zstd, COMPRESSION_LEVEL 19, ROW_GROUP_SIZE 500000)';

// Yellow taxi trips, January 2024: keep the columns that make good questions,
// drop obviously broken records, and store money as exact decimals.
// Pickup times are rounded to the minute and the drop-off time is replaced by
// a duration; together that keeps the file well under Cloudflare's 25 MiB asset limit.
await db.run(`
  COPY (
    SELECT
      date_trunc('minute', tpep_pickup_datetime)::TIMESTAMP_S AS pickup_at,
      round(epoch(tpep_dropoff_datetime - tpep_pickup_datetime) / 60)::USMALLINT AS duration_min,
      passenger_count::UTINYINT          AS passengers,
      trip_distance::DECIMAL(6,2)        AS distance_miles,
      PULocationID::USMALLINT            AS pickup_zone_id,
      DOLocationID::USMALLINT            AS dropoff_zone_id,
      CASE payment_type
        WHEN 1 THEN 'Credit card' WHEN 2 THEN 'Cash' WHEN 3 THEN 'No charge'
        WHEN 4 THEN 'Dispute' ELSE 'Unknown'
      END                                AS payment_type,
      fare_amount::DECIMAL(7,2)          AS fare,
      tip_amount::DECIMAL(7,2)           AS tip
    FROM read_parquet('${trips}')
    WHERE tpep_pickup_datetime >= TIMESTAMP '2024-01-01'
      AND tpep_pickup_datetime <  TIMESTAMP '2024-02-01'
      AND tpep_dropoff_datetime > tpep_pickup_datetime
      AND tpep_dropoff_datetime < tpep_pickup_datetime + INTERVAL 1 DAY
      AND trip_distance > 0 AND trip_distance < 200
      AND fare_amount >= 0 AND total_amount BETWEEN 0 AND 2000
    ORDER BY pickup_at
  ) TO '${out('trips.parquet')}' ${PARQUET}`);

await db.run(`
  COPY (
    SELECT
      LocationID::USMALLINT AS zone_id,
      Zone                  AS zone,
      Borough               AS borough,
      service_zone
    FROM read_csv('${zones}', nullstr = 'N/A')
    ORDER BY zone_id
  ) TO '${out('zones.parquet')}' ${PARQUET}`);

// Countries only (the source also contains continents and income groups).
await db.run(`
  COPY (
    SELECT
      country,
      iso_code,
      year::USMALLINT AS year,
      population::BIGINT AS population,
      gdp,
      co2,
      co2_per_capita,
      coal_co2,
      oil_co2,
      gas_co2,
      share_global_co2,
      cumulative_co2,
      primary_energy_consumption,
      energy_per_capita
    FROM read_csv('${emissions}')
    WHERE length(iso_code) = 3 AND year >= 1850
    ORDER BY country, year
  ) TO '${out('emissions.parquet')}' ${PARQUET}`);

for (const name of ['trips', 'zones', 'emissions']) {
  const file = path.join(outDir, `${name}.parquet`);
  const rows = await db.runAndReadAll(
    `SELECT count(*)::INTEGER FROM read_parquet('${file.replaceAll("'", "''")}')`,
  );
  const { size } = await stat(file);
  console.log(
    `${name.padEnd(10)} ${String(rows.getRows()[0][0]).padStart(9)} rows  ${(size / 1024 / 1024).toFixed(2)} MiB`,
  );
}
