export interface SampleQuestion {
  label: string;
  sql: string;
}

export interface SampleTable {
  name: string;
  /** Path of the Parquet file under public/. */
  file: string;
}

export interface SampleDataset {
  /** Stable identifier, also used in share links. */
  id: string;
  name: string;
  description: string;
  rows: string;
  download: string;
  source: string;
  sourceUrl: string;
  tables: SampleTable[];
  /** The first question runs automatically when the dataset loads. */
  questions: SampleQuestion[];
}

export const SAMPLES: SampleDataset[] = [
  {
    id: 'taxi',
    name: 'NYC taxi trips',
    description: 'Every yellow cab trip in New York City in January 2024, plus a zone lookup table to join against.',
    rows: '2.9M rows',
    download: '18 MB',
    source: 'NYC Taxi & Limousine Commission',
    sourceUrl: 'https://www.nyc.gov/site/tlc/about/tlc-trip-record-data.page',
    tables: [
      { name: 'trips', file: '/samples/trips.parquet' },
      { name: 'zones', file: '/samples/zones.parquet' },
    ],
    questions: [
      {
        label: 'Busiest hour of the day?',
        sql: `SELECT hour(pickup_at) AS hour, count(*) AS trips
FROM trips
GROUP BY hour
ORDER BY hour;`,
      },
      {
        label: 'Top 10 pickup zones',
        sql: `SELECT z.zone, z.borough, count(*) AS trips
FROM trips t
JOIN zones z ON z.zone_id = t.pickup_zone_id
GROUP BY z.zone, z.borough
ORDER BY trips DESC
LIMIT 10;`,
      },
      {
        label: 'Trips and revenue per day',
        sql: `SELECT pickup_at::DATE AS day, count(*) AS trips, sum(fare) AS revenue
FROM trips
GROUP BY day
ORDER BY day;`,
      },
      {
        label: 'Who tips more: card or cash?',
        sql: `SELECT payment_type,
       count(*) AS trips,
       round(avg(tip), 2) AS avg_tip,
       round(100 * sum(tip) / sum(fare), 1) AS tip_percent
FROM trips
WHERE fare > 0
GROUP BY payment_type
ORDER BY trips DESC;`,
      },
      {
        label: 'Does distance drive the fare?',
        sql: `SELECT round(distance_miles) AS miles,
       round(avg(fare), 2) AS avg_fare,
       count(*) AS trips
FROM trips
WHERE distance_miles < 30
GROUP BY miles
ORDER BY miles;`,
      },
    ],
  },
  {
    id: 'emissions',
    name: 'World CO₂ emissions',
    description: 'Yearly CO₂ emissions, population, GDP and energy use for every country since 1850.',
    rows: '39K rows',
    download: '0.8 MB',
    source: 'Our World in Data (CC BY 4.0)',
    sourceUrl: 'https://github.com/owid/co2-data',
    tables: [{ name: 'emissions', file: '/samples/emissions.parquet' }],
    questions: [
      {
        label: 'Biggest emitters in 2022?',
        sql: `SELECT country, round(co2) AS co2_million_tonnes
FROM emissions
WHERE year = 2022
ORDER BY co2 DESC
LIMIT 10;`,
      },
      {
        label: 'World emissions over time',
        sql: `SELECT year, round(sum(co2)) AS co2_million_tonnes
FROM emissions
GROUP BY year
ORDER BY year;`,
      },
      {
        label: 'Do richer countries emit more per person?',
        sql: `SELECT round(gdp / population) AS gdp_per_person,
       round(co2_per_capita, 2) AS co2_per_person,
       country
FROM emissions
WHERE year = 2022
  AND gdp IS NOT NULL
  AND population > 1000000;`,
      },
      {
        label: 'Coal vs oil vs gas since 1950',
        sql: `SELECT year,
       round(sum(coal_co2)) AS coal,
       round(sum(oil_co2)) AS oil,
       round(sum(gas_co2)) AS gas
FROM emissions
WHERE year >= 1950
GROUP BY year
ORDER BY year;`,
      },
    ],
  },
];

export const sampleById = (id: string) => SAMPLES.find((s) => s.id === id);
