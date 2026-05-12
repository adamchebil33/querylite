import { describe, expect, it } from 'vitest';
import { pageFor } from './router';

describe('pageFor', () => {
  it('maps paths to pages', () => {
    expect(pageFor('/')).toBe('landing');
    expect(pageFor('/app')).toBe('app');
    expect(pageFor('/app/')).toBe('app');
    expect(pageFor('/bench')).toBe('bench');
    expect(pageFor('/anything-else')).toBe('landing');
  });
});
