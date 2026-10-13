import { describe, it, expect } from 'vitest';
import { parseLooseDate } from '@/utils/formatDate';

describe('loose dates', () => {
  it('reads RFC3339', () => {
    expect(parseLooseDate('2026-10-08T10:56:14Z')?.toISOString()).toBe('2026-10-08T10:56:14.000Z');
  });
  it("reads Go's debug format", () => {
    expect(parseLooseDate('2026-10-08 10:56:14.97892 +0000 +0000')?.toISOString()).toBe('2026-10-08T10:56:14.978Z');
    expect(parseLooseDate('2026-10-08 10:56:14 +0500 +05')?.toISOString()).toBe('2026-10-08T05:56:14.000Z');
  });
  it('gives null for junk and empty', () => {
    expect(parseLooseDate('later')).toBeNull();
    expect(parseLooseDate(undefined)).toBeNull();
  });
});
