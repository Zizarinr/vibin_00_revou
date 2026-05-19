// Smoke test to verify Vitest + jsdom + fast-check are configured correctly
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

describe('Project setup', () => {
  it('vitest globals are available', () => {
    expect(true).toBe(true);
  });

  it('jsdom environment is active', () => {
    expect(typeof document).toBe('object');
    expect(typeof window).toBe('object');
  });

  it('fast-check is importable and functional', () => {
    fc.assert(
      fc.property(fc.integer(), (n) => {
        return typeof n === 'number';
      }),
    );
  });
});
