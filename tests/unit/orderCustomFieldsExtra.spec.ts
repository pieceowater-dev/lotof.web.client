import { describe, it, expect } from 'vitest';
import { parseMulti, serializeMulti, defaultValuesFor, warrantyCarryOver, formatCustomFieldValue, missingRequiredFields } from '@/utils/orderCustomFields';
import type { MenuOrderField } from '@/api/menu/orderfield/list';

const f = (o: Partial<MenuOrderField>): MenuOrderField => ({ id: 'a', label: 'L', dataType: 'TEXT', isRequired: false, options: [], viewOrder: 0, isActive: true, ...o });

describe('custom field extras', () => {
  it('round-trips multi-choice values', () => {
    expect(parseMulti(serializeMulti(['x', 'y']))).toEqual(['x', 'y']);
    expect(serializeMulti([])).toBe('');
    expect(parseMulti('not json')).toEqual([]);
  });
  it('collects defaults of active non-heading fields', () => {
    const d = defaultValuesFor([f({ id: '1', defaultValue: 'x' }), f({ id: '2', defaultValue: 'y', isActive: false }), f({ id: '3', dataType: 'HEADING', defaultValue: 'z' })]);
    expect(d).toEqual({ '1': 'x' });
  });
  it('carries over only opted-in fields into a warranty', () => {
    const fields = [f({ id: '1' }), f({ id: '2', copyToWarranty: false })];
    expect(JSON.parse(warrantyCarryOver(fields, JSON.stringify({ '1': 'a', '2': 'b' })))).toEqual({ '1': 'a' });
  });
  it('formats multi-choice and ignores headings', () => {
    const labels = { yes: 'y', no: 'n' };
    expect(formatCustomFieldValue(f({ dataType: 'MULTISELECT' }), '["a","b"]', labels)).toBe('a, b');
    expect(formatCustomFieldValue(f({ dataType: 'HEADING' }), 'x', labels)).toBe('');
  });
  it('never requires a heading', () => {
    expect(missingRequiredFields([f({ dataType: 'HEADING', isRequired: true })], {})).toEqual([]);
  });
});
