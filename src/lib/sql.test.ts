import { describe, expect, it } from 'vitest';
import { tablesMentioned, withoutTrailingSemicolon } from './sql';

describe('tablesMentioned', () => {
  const tables = ['orders', 'customers', 'Sales 2025'];

  it('finds tables in joins regardless of case', () => {
    expect(
      tablesMentioned('SELECT count(*) FROM Orders JOIN customers USING (customer_id)', tables),
    ).toEqual(['orders', 'customers']);
  });

  it('matches whole words only', () => {
    expect(tablesMentioned('SELECT * FROM orders_archive', tables)).toEqual([]);
    expect(tablesMentioned('SELECT * FROM "orders"', tables)).toEqual(['orders']);
  });

  it('ignores names inside strings and comments', () => {
    expect(
      tablesMentioned("SELECT 'orders' AS label -- customers\nFROM /* orders */ customers", tables),
    ).toEqual(['customers']);
  });

  it('finds quoted names with spaces', () => {
    expect(tablesMentioned('SELECT * FROM "Sales 2025"', tables)).toEqual(['Sales 2025']);
  });
});

describe('withoutTrailingSemicolon', () => {
  it('removes trailing semicolons and what follows them', () => {
    expect(withoutTrailingSemicolon('SELECT 1;')).toBe('SELECT 1');
    expect(withoutTrailingSemicolon('SELECT 1 ;;  \n')).toBe('SELECT 1');
    expect(withoutTrailingSemicolon('SELECT 1; -- done')).toBe('SELECT 1');
    expect(withoutTrailingSemicolon('SELECT 1; /* done */ ')).toBe('SELECT 1');
  });

  it('leaves semicolons inside strings, names and comments alone', () => {
    expect(withoutTrailingSemicolon("SELECT ';' AS s")).toBe("SELECT ';' AS s");
    expect(withoutTrailingSemicolon('SELECT 1 AS "a;"')).toBe('SELECT 1 AS "a;"');
    expect(withoutTrailingSemicolon('SELECT 1 -- note; more')).toBe('SELECT 1 -- note; more');
    expect(withoutTrailingSemicolon("SELECT 'it''s; fine';")).toBe("SELECT 'it''s; fine'");
  });

  it('keeps earlier statements intact', () => {
    expect(withoutTrailingSemicolon('SELECT 1; SELECT 2;')).toBe('SELECT 1; SELECT 2');
    expect(withoutTrailingSemicolon('SELECT a - b / c FROM t')).toBe('SELECT a - b / c FROM t');
  });
});
