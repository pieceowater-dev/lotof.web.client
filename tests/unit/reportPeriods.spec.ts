import { describe, expect, it } from 'vitest';
import { presetRange, presetOf, isoDay } from '@/utils/reportPeriods';

const now = new Date(2026, 9, 14, 15, 30); // 14 Oct 2026, local

describe('report period presets', () => {
  it('today is one day', () => {
    expect(presetRange('today', now)).toEqual({ from: '2026-10-14', to: '2026-10-14' });
  });
  it('week is the last seven days including today', () => {
    expect(presetRange('week', now)).toEqual({ from: '2026-10-08', to: '2026-10-14' });
  });
  it('month runs from the first of the month to today', () => {
    expect(presetRange('month', now)).toEqual({ from: '2026-10-01', to: '2026-10-14' });
  });
  it('previous month is whole, also across a year boundary', () => {
    expect(presetRange('prevMonth', now)).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    expect(presetRange('prevMonth', new Date(2026, 0, 5))).toEqual({ from: '2025-12-01', to: '2025-12-31' });
  });
  it('all time starts at a fixed early day', () => {
    expect(presetRange('all', now)).toEqual({ from: '2020-01-01', to: '2026-10-14' });
  });
  it('presetOf recognises what presetRange produced and nothing else', () => {
    for (const k of ['today', 'week', 'month', 'prevMonth', 'all'] as const) {
      const r = presetRange(k, now);
      expect(presetOf(r.from, r.to, now)).toBe(k);
    }
    expect(presetOf('2026-10-02', '2026-10-09', now)).toBe('');
  });
  it('isoDay pads month and day', () => {
    expect(isoDay(new Date(2026, 0, 3))).toBe('2026-01-03');
  });
});
