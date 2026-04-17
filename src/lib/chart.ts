export type ColumnKind = 'number' | 'time' | 'text' | 'other';
export type ChartType = 'bar' | 'line' | 'scatter';

export interface ChartColumn {
  name: string;
  kind: ColumnKind;
}

export interface ChartSpec {
  type: ChartType;
  /** Column index for the horizontal axis (or the category, for bars). */
  x: number;
  /** Column indices plotted as values. Lines may have several; bars and scatters use the first. */
  y: number[];
}

/** Facts about the data that the column types alone can't tell us. */
export interface DataProbe {
  /** True if no value in the column repeats. */
  isUnique(column: number): boolean;
  /** Largest absolute value in a numeric column. */
  maxAbs(column: number): number;
}

/** Most bars a chart shows before it becomes unreadable. */
export const MAX_BARS = 30;
/** Most points drawn for lines and scatters; larger results are thinned evenly. */
export const MAX_POINTS = 5000;
/** Most lines on one chart (the palette has eight validated colors). */
export const MAX_SERIES = 8;

/**
 * Value columns that can share one axis with the first one: a series a
 * dozen times smaller would be a flat line, so it is left out by default.
 */
function comparable(values: number[], probe: DataProbe): number[] {
  if (values.length === 0) return [];
  const reference = probe.maxAbs(values[0]);
  return values
    .filter((column) => {
      const max = probe.maxAbs(column);
      if (reference === 0 || max === 0) return column === values[0];
      const ratio = max / reference;
      return ratio <= 5 && ratio >= 1 / 5;
    })
    .slice(0, MAX_SERIES);
}

/**
 * Picks a sensible default chart for a query result, or null if the result
 * isn't chartable (a single row, or no numeric column).
 *
 * - a date or timestamp column plus numbers: line over time
 * - a label column plus numbers: bars, one per label
 * - numbers only: bars or a line if the first column is a distinct key
 *   (hour, year...), otherwise a scatter of the first two columns
 */
export function suggestChart(
  columns: ChartColumn[],
  rowCount: number,
  probe: DataProbe,
): ChartSpec | null {
  if (rowCount < 2) return null;
  const indices = columns.map((_, i) => i);
  const numbers = indices.filter((i) => columns[i].kind === 'number');
  const times = indices.filter((i) => columns[i].kind === 'time');
  const texts = indices.filter((i) => columns[i].kind === 'text');
  if (numbers.length === 0) return null;

  if (times.length > 0) {
    return { type: 'line', x: times[0], y: comparable(numbers, probe) };
  }

  if (texts.length > 0) {
    const label = texts[0];
    const oneBarPerLabel = probe.isUnique(label);
    // Many labels with two measures reads better as one dot per label.
    if (numbers.length >= 2 && (!oneBarPerLabel || rowCount > MAX_BARS)) {
      return { type: 'scatter', x: numbers[0], y: [numbers[1]] };
    }
    return { type: 'bar', x: label, y: [numbers[0]] };
  }

  if (numbers.length < 2) return null;
  const [key, ...values] = numbers;
  if (!probe.isUnique(key)) return { type: 'scatter', x: key, y: [values[0]] };
  if (rowCount <= MAX_BARS) return { type: 'bar', x: key, y: [values[0]] };
  return { type: 'line', x: key, y: comparable(values, probe) };
}

/** Which chart types make sense for a given horizontal-axis column. */
export function allowedTypes(xKind: ColumnKind): ChartType[] {
  if (xKind === 'text') return ['bar'];
  if (xKind === 'time') return ['line', 'bar'];
  return ['bar', 'line', 'scatter'];
}

/** Evenly spaced row indices, at most `limit` of them, always including the first row. */
export function thin(rowCount: number, limit: number): number[] {
  if (rowCount <= limit) return Array.from({ length: rowCount }, (_, i) => i);
  const step = rowCount / limit;
  return Array.from({ length: limit }, (_, i) => Math.floor(i * step));
}

/**
 * Axis label formatter with one style per axis: values are written in full
 * when the axis stays under 10,000 (so years read "1950"), and compactly
 * ("25K", "2.5M") when it goes beyond.
 */
export function tickFormatter(axisMax: number): (value: number) => string {
  if (Math.abs(axisMax) < 10_000) return (value) => String(Number(value.toPrecision(6)));
  return formatTick;
}

/** Compact number: 950 stays "950", 25000 becomes "25K", 2.5e6 "2.5M". */
export function formatTick(value: number): string {
  const abs = Math.abs(value);
  if (abs < 1000) return String(Number(value.toPrecision(6)));
  for (const [limit, suffix] of [
    [1e12, 'T'],
    [1e9, 'B'],
    [1e6, 'M'],
    [1e3, 'K'],
  ] as const) {
    if (abs >= limit) return `${Number((value / limit).toPrecision(3))}${suffix}`;
  }
  return String(value);
}
