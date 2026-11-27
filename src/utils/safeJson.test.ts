import { describe, expect, it } from 'vitest';
import { safeJsonParse } from './safeJson';

describe('safeJsonParse', () => {
  it('parses valid JSON', () => {
    expect(safeJsonParse('{"enabled":true}', { enabled: false })).toEqual({ enabled: true });
  });

  it('returns the fallback for malformed or empty input', () => {
    expect(safeJsonParse('{bad json', { enabled: false })).toEqual({ enabled: false });
    expect(safeJsonParse('', { enabled: false })).toEqual({ enabled: false });
    expect(safeJsonParse(null, { enabled: false })).toEqual({ enabled: false });
  });

  it('uses the fallback for JSON null', () => {
    expect(safeJsonParse('null', 'fallback')).toBe('fallback');
  });
});
