import { describe, expect, it } from 'vitest';
import { tablesMentioned } from './sql';

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
