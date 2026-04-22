import { withoutTrailingSemicolon } from './sql';

export type SortDirection = 'asc' | 'desc';

export interface SortSpec {
  /** Index of the column in the result. */
  column: number;
  direction: SortDirection;
}

/** Clicking a header cycles: ascending, descending, back to the original order. */
export function nextSort(current: SortSpec | null, column: number): SortSpec | null {
  if (!current || current.column !== column) return { column, direction: 'asc' };
  if (current.direction === 'asc') return { column, direction: 'desc' };
  return null;
}

function compare(a: unknown, b: unknown): number {
  if (typeof a === 'string' && typeof b === 'string') return a < b ? -1 : a > b ? 1 : 0;
  // Numbers, bigints and booleans compare correctly with the built-in operators,
  // including a bigint against a number.
  const x = a as number;
  const y = b as number;
  return x < y ? -1 : x > y ? 1 : 0;
}

/**
 * Returns row indices ordered by the given sort keys. NULLs always go last,
 * and equal keys keep their original order.
 */
export function sortOrder(keys: ArrayLike<unknown>, direction: SortDirection): Int32Array {
  const order = Int32Array.from({ length: keys.length }, (_, i) => i);
  const sign = direction === 'asc' ? 1 : -1;
  order.sort((i, j) => {
    const a = keys[i];
    const b = keys[j];
    const aNull = a === null || a === undefined || (typeof a === 'number' && Number.isNaN(a));
    const bNull = b === null || b === undefined || (typeof b === 'number' && Number.isNaN(b));
    if (aNull || bNull) return aNull === bNull ? i - j : aNull ? 1 : -1;
    return sign * compare(a, b) || i - j;
  });
  return order;
}

/** Wraps a query so the database sorts its full result by one column. */
export function sortedSql(sql: string, quotedColumn: string, direction: SortDirection): string {
  const inner = withoutTrailingSemicolon(sql);
  return `SELECT * FROM (\n${inner}\n) ORDER BY ${quotedColumn} ${direction.toUpperCase()} NULLS LAST`;
}
