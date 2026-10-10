import { describe, expect, it } from 'vitest';
import {
  ORDER_STATUS_KEYS,
  MAX_STATUS_LABEL_LENGTH,
  defaultStatusLabel,
  parseStatusLabels,
  serializeStatusLabels,
  statusLabelFor,
} from '@/utils/orderStatusLabels';
import { orderStatusPreset, STATUS_PRESET_TYPES } from '@/config/orderStatusPresets';

const noT = () => ''; // no translation available -> the English fallback shows

describe('parseStatusLabels', () => {
  it('returns {} for empty, invalid or non-object input', () => {
    expect(parseStatusLabels('')).toEqual({});
    expect(parseStatusLabels(null)).toEqual({});
    expect(parseStatusLabels('nope')).toEqual({});
    expect(parseStatusLabels('["a"]')).toEqual({});
  });
  it('keeps only known statuses with non-empty text', () => {
    expect(parseStatusLabels('{"READY":" Готов к выдаче ","NEW":"","SHIPPED":"x","COMPLETED":1}')).toEqual({ READY: 'Готов к выдаче' });
  });
});

describe('serializeStatusLabels', () => {
  it('trims, drops blanks and unknown keys, and caps the length', () => {
    const long = 'x'.repeat(MAX_STATUS_LABEL_LENGTH + 10);
    const parsed = JSON.parse(serializeStatusLabels({ NEW: '  A ', READY: '   ', COMPLETED: long, BOGUS: 'z' } as any));
    expect(parsed).toEqual({ NEW: 'A', COMPLETED: 'x'.repeat(MAX_STATUS_LABEL_LENGTH) });
  });
  it('round-trips with parse', () => {
    const json = serializeStatusLabels({ IN_PREPARATION: 'В ремонте' });
    expect(parseStatusLabels(json)).toEqual({ IN_PREPARATION: 'В ремонте' });
  });
});

describe('statusLabelFor', () => {
  it('prefers the business name over the default', () => {
    expect(statusLabelFor('IN_PREPARATION', { IN_PREPARATION: 'In repair' }, noT)).toBe('In repair');
  });
  it('falls back to the translated default, then to the English fallback', () => {
    expect(statusLabelFor('READY', {}, (k) => (k === 'menu.statusReady' ? 'Готов' : ''))).toBe('Готов');
    expect(statusLabelFor('READY', undefined, noT)).toBe('Ready');
  });
  it('shows an unknown status as-is', () => {
    expect(statusLabelFor('WEIRD', {}, noT)).toBe('WEIRD');
    expect(defaultStatusLabel('WEIRD', noT)).toBe('WEIRD');
  });
});

describe('status presets', () => {
  it('only rename known statuses, in every language', () => {
    for (const type of STATUS_PRESET_TYPES) {
      for (const loc of ['ru', 'kk', 'en']) {
        const preset = orderStatusPreset(type, loc);
        expect(Object.keys(preset).length).toBeGreaterThan(0);
        for (const [k, v] of Object.entries(preset)) {
          expect((ORDER_STATUS_KEYS as readonly string[]).includes(k)).toBe(true);
          expect((v as string).trim().length).toBeGreaterThan(0);
          expect((v as string).length).toBeLessThanOrEqual(MAX_STATUS_LABEL_LENGTH);
        }
      }
    }
  });
  it('the service center calls its stages by repair names', () => {
    expect(orderStatusPreset('service_center', 'ru')).toMatchObject({ ACCEPTED: 'Диагностика', IN_PREPARATION: 'В ремонте' });
    expect(orderStatusPreset('service_center', 'en').IN_PREPARATION).toBe('In repair');
  });
  it('types without a preset keep the neutral defaults', () => {
    expect(orderStatusPreset('other', 'ru')).toEqual({});
    expect(orderStatusPreset(undefined, 'ru')).toEqual({});
  });
  it('returns a copy, so callers cannot mutate the preset', () => {
    const a = orderStatusPreset('retail', 'ru');
    a.NEW = 'mutated';
    expect(orderStatusPreset('retail', 'ru').NEW).toBeUndefined();
  });
});
