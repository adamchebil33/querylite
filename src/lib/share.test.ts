import { describe, expect, it } from 'vitest';
import { decodeShare, encodeShare } from './share';

const known = ['taxi', 'emissions'];

describe('share links', () => {
  it('round-trips SQL with awkward characters', () => {
    const sql = `SELECT "a b", 'x&y=z#1' AS s, 100 % 7 -- note\nFROM trips WHERE tip > 1 + 2;`;
    const hash = encodeShare({ sql, samples: ['taxi'] });
    expect(hash.startsWith('#data=taxi&sql=')).toBe(true);
    expect(decodeShare(hash, known)).toEqual({ sql, samples: ['taxi'] });
  });

  it('carries several samples and ignores unknown ones', () => {
    const hash = encodeShare({ sql: 'SELECT 1', samples: ['taxi', 'emissions'] });
    expect(decodeShare(hash, known)?.samples).toEqual(['taxi', 'emissions']);
    expect(decodeShare('#data=taxi,evil,taxi&sql=SELECT+1', known)).toEqual({
      sql: 'SELECT 1',
      samples: ['taxi'],
    });
  });

  it('contains nothing but the SQL and sample names', () => {
    const hash = encodeShare({ sql: 'SELECT 1', samples: [] });
    expect(hash).toBe('#sql=SELECT+1');
  });

  it('returns null for fragments that are not share links', () => {
    expect(decodeShare('', known)).toBeNull();
    expect(decodeShare('#section', known)).toBeNull();
    expect(decodeShare('#sql=', known)).toBeNull();
  });
});
