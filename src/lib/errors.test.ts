import { describe, expect, it } from 'vitest';
import { parseSqlError } from './errors';

describe('parseSqlError', () => {
  it('parses JSON parser errors', () => {
    const raw = JSON.stringify({
      exception_type: 'Parser',
      exception_message: 'syntax error at or near "SELEC"\n\nLINE 1: SELEC 1\n        ^',
      error_subtype: 'SYNTAX_ERROR',
    });
    expect(parseSqlError(raw)).toEqual({
      title: 'Syntax error',
      message: 'syntax error at or near "SELEC"',
      context: 'LINE 1: SELEC 1\n        ^',
      hint: undefined,
    });
  });

  it('parses text errors and lists loaded tables when DuckDB has no suggestion', () => {
    const raw =
      'Catalog Error: Table with name ordrs does not exist!\nDid you mean "orders"?\n\nLINE 1: SELECT * FROM ordrs\n                      ^';
    const error = parseSqlError(raw, ['orders', 'customers']);
    expect(error.title).toBe('Unknown table or function');
    expect(error.message).toBe('Table with name ordrs does not exist!\nDid you mean "orders"?');
    expect(error.context).toBe('LINE 1: SELECT * FROM ordrs\n                      ^');
    expect(error.hint).toBeUndefined();
    expect(
      parseSqlError('Catalog Error: Table with name xyz does not exist!', ['orders', 'customers'])
        .hint,
    ).toBe('Loaded tables: orders, customers.');
  });

  it('drops misleading suggestions when no tables are loaded', () => {
    const raw =
      'Catalog Error: Table with name ordrs does not exist!\nDid you mean "pragma_database_list"?\n\nLINE 1: SELECT * FROM ordrs\n                      ^';
    const error = parseSqlError(raw);
    expect(error.message).toBe('Table with name ordrs does not exist!');
    expect(error.hint).toBe('No tables are loaded yet. Drop a file onto the page first.');
  });

  it('keeps errors without a context line intact', () => {
    const raw =
      'Binder Error: Referenced column "amont" not found in FROM clause!\nCandidate bindings: "amount"';
    const error = parseSqlError(raw, ['orders']);
    expect(error.title).toBe('Problem with a column or expression');
    expect(error.message).toBe(
      'Referenced column "amont" not found in FROM clause!\nCandidate bindings: "amount"',
    );
    expect(error.context).toBeUndefined();
  });

  it('falls back gracefully on unknown shapes', () => {
    expect(parseSqlError('something odd happened')).toMatchObject({
      title: 'Query failed',
      message: 'something odd happened',
    });
    expect(parseSqlError('{not json')).toMatchObject({ title: 'Query failed', message: '{not json' });
    expect(parseSqlError('Foo Bar Error: x').title).toBe('Foo Bar error');
  });
});
