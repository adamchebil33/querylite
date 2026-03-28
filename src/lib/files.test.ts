import { describe, expect, it } from 'vitest';
import { fileKind, formatBytes, quoteIdent, quoteLiteral, tableNameFor } from './files';

describe('fileKind', () => {
  it('maps extensions to readers', () => {
    expect(fileKind('a.csv')).toBe('csv');
    expect(fileKind('a.TSV')).toBe('csv');
    expect(fileKind('a.ndjson')).toBe('json');
    expect(fileKind('trips.2025.parquet')).toBe('parquet');
  });

  it('rejects unsupported files', () => {
    expect(fileKind('photo.png')).toBeNull();
    expect(fileKind('noextension')).toBeNull();
  });
});

describe('tableNameFor', () => {
  it('produces identifiers that need no quoting', () => {
    expect(tableNameFor('Sales Report (2025).csv')).toBe('sales_report_2025');
    expect(tableNameFor('données.csv')).toBe('donnees');
    expect(tableNameFor('2025-orders.csv')).toBe('t_2025_orders');
    expect(tableNameFor('???.csv')).toBe('data');
  });

  it('avoids names that are already taken', () => {
    expect(tableNameFor('orders.csv', ['orders'])).toBe('orders_2');
    expect(tableNameFor('orders.csv', ['orders', 'ORDERS_2'])).toBe('orders_3');
  });
});

describe('quoting', () => {
  it('escapes quotes', () => {
    expect(quoteIdent('we"ird')).toBe('"we""ird"');
    expect(quoteLiteral("it's.csv")).toBe("'it''s.csv'");
  });
});

describe('formatBytes', () => {
  it('formats sizes', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(25 * 1024 * 1024)).toBe('25 MB');
  });
});
