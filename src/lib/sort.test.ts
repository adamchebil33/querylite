import { describe, expect, it } from 'vitest';
import { nextSort, sortedSql, sortOrder } from './sort';

describe('nextSort', () => {
  it('cycles ascending, descending, none', () => {
    const asc = nextSort(null, 2);
    expect(asc).toEqual({ column: 2, direction: 'asc' });
    const desc = nextSort(asc, 2);
    expect(desc).toEqual({ column: 2, direction: 'desc' });
    expect(nextSort(desc, 2)).toBeNull();
  });

  it('starts ascending on a different column', () => {
    expect(nextSort({ column: 2, direction: 'desc' }, 0)).toEqual({ column: 0, direction: 'asc' });
  });
});

describe('sortOrder', () => {
  it('sorts numbers numerically, not as text', () => {
    expect([...sortOrder([10, 9, 100, 1], 'asc')]).toEqual([3, 1, 0, 2]);
    expect([...sortOrder([10, 9, 100, 1], 'desc')]).toEqual([2, 0, 1, 3]);
  });

  it('sorts strings and bigints', () => {
    expect([...sortOrder(['pear', 'apple', 'fig'], 'asc')]).toEqual([1, 2, 0]);
    expect([...sortOrder([3n, 9007199254740993n, -1n], 'desc')]).toEqual([1, 0, 2]);
  });

  it('puts NULLs last in both directions', () => {
    expect([...sortOrder([null, 2, undefined, 1, NaN], 'asc')]).toEqual([3, 1, 0, 2, 4]);
    expect([...sortOrder([null, 2, undefined, 1, NaN], 'desc')]).toEqual([1, 3, 0, 2, 4]);
  });

  it('keeps equal keys in their original order', () => {
    expect([...sortOrder([1, 1, 0, 1], 'asc')]).toEqual([2, 0, 1, 3]);
    expect([...sortOrder([1, 1, 0, 1], 'desc')]).toEqual([0, 1, 3, 2]);
  });
});

describe('sortedSql', () => {
  it('wraps the query and strips trailing semicolons', () => {
    expect(sortedSql('SELECT * FROM t;  ', '"a b"', 'desc')).toBe(
      'SELECT * FROM (\nSELECT * FROM t\n) ORDER BY "a b" DESC NULLS LAST',
    );
  });
});
