import { describe, expect, it } from 'vitest';
import { describeDevice, median, toMarkdown, type BenchReport } from './benchmark';

describe('median', () => {
  it('handles odd and even counts', () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
});

describe('describeDevice', () => {
  it('names the browser, system and hardware', () => {
    expect(
      describeDevice({
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
        hardwareConcurrency: 10,
        deviceMemory: 8,
      }),
    ).toBe('Chrome 142, macOS, 10 CPU threads, 8+ GB RAM');
    expect(
      describeDevice({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0',
        hardwareConcurrency: 8,
      }),
    ).toBe('Firefox 140, Windows, 8 CPU threads');
    expect(
      describeDevice({
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
      }),
    ).toBe('Safari 18, macOS');
  });
});

describe('toMarkdown', () => {
  it('produces a table with the device and date', () => {
    const report: BenchReport = {
      rows: 2_869_937,
      loadMs: 2140,
      queries: [
        { name: 'Count all rows', sql: '', medianMs: 1.24, minMs: 0.9 },
        { name: 'Group by hour', sql: '', medianMs: 41.6, minMs: 39.2 },
      ],
      csv: { rows: 1_000_000, megabytes: 58.2, parseMs: 1930 },
      duckdbVersion: 'v1.5.2',
      device: 'Chrome 142, macOS, 10 CPU threads',
      measuredAt: '2026-04-30',
    };
    expect(toMarkdown(report)).toBe(
      [
        'Measured on Chrome 142, macOS, 10 CPU threads, 2026-04-30, DuckDB v1.5.2 (WebAssembly, single thread).',
        '',
        '| Query over 2,869,937 rows | Median | Fastest |',
        '| --- | ---: | ---: |',
        '| Count all rows | 1.2 ms | 0.9 ms |',
        '| Group by hour | 42 ms | 39 ms |',
        '',
        '- Download and load 2,869,937 rows (18 MB Parquet): 2.1 s',
        '- Parse a 58 MB CSV with 1,000,000 rows: 1.9 s',
      ].join('\n'),
    );
  });
});
