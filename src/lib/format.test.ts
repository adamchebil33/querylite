import {
  Bool,
  DateDay,
  Decimal,
  Float64,
  Int32,
  Int64,
  TimestampMicrosecond,
  Utf8,
} from 'apache-arrow';
import { describe, expect, it } from 'vitest';
import {
  formatCell,
  formatCount,
  formatDecimal,
  formatDuration,
  isNumeric,
  sortKey,
  typeLabel,
} from './format';

describe('formatDecimal', () => {
  it('restores the decimal point', () => {
    expect(formatDecimal(150n, 2)).toBe('1.50');
    expect(formatDecimal(5n, 2)).toBe('0.05');
    expect(formatDecimal(-5n, 2)).toBe('-0.05');
    expect(formatDecimal(-12345n, 3)).toBe('-12.345');
    expect(formatDecimal(42n, 0)).toBe('42');
  });
});

describe('formatCell', () => {
  it('returns null for SQL NULL', () => {
    expect(formatCell(null, new Utf8())).toBeNull();
  });

  it('formats scalars', () => {
    expect(formatCell('hello', new Utf8())).toBe('hello');
    expect(formatCell(1.5, new Float64())).toBe('1.5');
    expect(formatCell(9007199254740993n, new Int64())).toBe('9007199254740993');
    expect(formatCell(true, new Bool())).toBe('true');
  });

  it('formats decimals from Arrow words, including negatives', () => {
    expect(formatCell(new Uint32Array([150, 0, 0, 0]), new Decimal(2, 10))).toBe('1.50');
    const minus150 = new Uint32Array([0xffffff6a, 0xffffffff, 0xffffffff, 0xffffffff]);
    expect(formatCell(minus150, new Decimal(2, 10))).toBe('-1.50');
  });

  it('formats dates and timestamps in UTC', () => {
    const ms = Date.UTC(2025, 0, 3, 4, 5, 6);
    expect(formatCell(ms, new DateDay())).toBe('2025-01-03');
    expect(formatCell(ms, new TimestampMicrosecond())).toBe('2025-01-03 04:05:06');
    expect(formatCell(ms + 7, new TimestampMicrosecond())).toBe('2025-01-03 04:05:06.007');
  });
});

describe('sortKey and typeLabel', () => {
  it('makes decimals comparable', () => {
    expect(sortKey(new Uint32Array([150, 0, 0, 0]), new Decimal(2, 10))).toBe(150n);
    expect(sortKey(null, new Decimal(2, 10))).toBeNull();
    expect(sortKey('b', new Utf8())).toBe('b');
  });

  it('names types the SQL way', () => {
    expect(typeLabel(new Int32())).toBe('integer');
    expect(typeLabel(new Int64())).toBe('bigint');
    expect(typeLabel(new Float64())).toBe('double');
    expect(typeLabel(new Decimal(2, 10))).toBe('decimal(10,2)');
    expect(typeLabel(new Utf8())).toBe('text');
    expect(typeLabel(new TimestampMicrosecond())).toBe('timestamp');
  });
});

describe('helpers', () => {
  it('detects numeric types', () => {
    expect(isNumeric(new Int64())).toBe(true);
    expect(isNumeric(new Decimal(2, 10))).toBe(true);
    expect(isNumeric(new Utf8())).toBe(false);
  });

  it('formats durations and counts', () => {
    expect(formatDuration(0.2)).toBe('1 ms');
    expect(formatDuration(84)).toBe('84 ms');
    expect(formatDuration(1234)).toBe('1.23 s');
    expect(formatCount(1, 'row')).toBe('1 row');
    expect(formatCount(1048576, 'row')).toBe('1,048,576 rows');
  });
});
