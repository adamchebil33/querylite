import { describe, expect, it } from 'vitest';
import {
  allowedTypes,
  formatTick,
  tickFormatter,
  suggestChart,
  thin,
  type ChartColumn,
  type DataProbe,
} from './chart';

const col = (name: string, kind: ChartColumn['kind']): ChartColumn => ({ name, kind });

function probe(unique: number[] = [], maxAbs: Record<number, number> = {}): DataProbe {
  return {
    isUnique: (column) => unique.includes(column),
    maxAbs: (column) => maxAbs[column] ?? 100,
  };
}

describe('suggestChart', () => {
  it('draws a line over time', () => {
    const columns = [col('day', 'time'), col('trips', 'number')];
    expect(suggestChart(columns, 31, probe([0]))).toEqual({ type: 'line', x: 0, y: [1] });
  });

  it('puts series of similar size on one line chart and leaves out mismatched ones', () => {
    const columns = [
      col('year', 'time'),
      col('coal', 'number'),
      col('oil', 'number'),
      col('population', 'number'),
    ];
    const spec = suggestChart(columns, 70, probe([0], { 1: 15_000, 2: 4000, 3: 8e9 }));
    expect(spec).toEqual({ type: 'line', x: 0, y: [1, 2] });
  });

  it('draws one bar per label', () => {
    const columns = [col('zone', 'text'), col('borough', 'text'), col('trips', 'number')];
    expect(suggestChart(columns, 10, probe([0]))).toEqual({ type: 'bar', x: 0, y: [2] });
  });

  it('prefers a scatter when many labels carry two measures', () => {
    const columns = [col('gdp', 'number'), col('co2', 'number'), col('country', 'text')];
    expect(suggestChart(columns, 160, probe([2]))).toEqual({ type: 'scatter', x: 0, y: [1] });
  });

  it('treats a distinct numeric first column as the key', () => {
    const hours = [col('hour', 'number'), col('trips', 'number')];
    expect(suggestChart(hours, 24, probe([0]))).toEqual({ type: 'bar', x: 0, y: [1] });
    const years = [col('year', 'number'), col('co2', 'number')];
    expect(suggestChart(years, 170, probe([0]))).toEqual({ type: 'line', x: 0, y: [1] });
  });

  it('scatters two measures when the first column repeats', () => {
    const columns = [col('distance', 'number'), col('fare', 'number')];
    expect(suggestChart(columns, 500, probe([]))).toEqual({ type: 'scatter', x: 0, y: [1] });
  });

  it('returns null when there is nothing to chart', () => {
    expect(suggestChart([col('n', 'number')], 1, probe([0]))).toBeNull();
    expect(suggestChart([col('n', 'number')], 50, probe([0]))).toBeNull();
    expect(suggestChart([col('a', 'text'), col('b', 'text')], 50, probe([0]))).toBeNull();
  });
});

describe('tickFormatter', () => {
  it('uses one style per axis', () => {
    const small = tickFormatter(2025);
    expect(small(1950)).toBe('1950');
    const large = tickFormatter(16_000);
    expect(large(8000)).toBe('8K');
    expect(large(16_000)).toBe('16K');
    expect(large(0)).toBe('0');
  });
});

describe('helpers', () => {
  it('limits chart types by axis kind', () => {
    expect(allowedTypes('text')).toEqual(['bar']);
    expect(allowedTypes('time')).toEqual(['line', 'bar']);
    expect(allowedTypes('number')).toEqual(['bar', 'line', 'scatter']);
  });

  it('thins rows evenly', () => {
    expect(thin(3, 10)).toEqual([0, 1, 2]);
    expect(thin(10, 5)).toEqual([0, 2, 4, 6, 8]);
    expect(thin(100_000, 5000)).toHaveLength(5000);
  });

  it('formats axis ticks compactly', () => {
    expect(formatTick(950)).toBe('950');
    expect(formatTick(0.25)).toBe('0.25');
    expect(formatTick(8000)).toBe('8K');
    expect(formatTick(25_000)).toBe('25K');
    expect(formatTick(2_500_000)).toBe('2.5M');
    expect(formatTick(-3_200_000_000)).toBe('-3.2B');
  });
});
