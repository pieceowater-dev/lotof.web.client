import { describe, expect, it } from 'vitest';
import {
  fieldsForOrder,
  formatCustomFieldValue,
  missingRequiredFields,
  parseCustomFields,
  serializeCustomFields,
} from '@/utils/orderCustomFields';
import type { MenuOrderField } from '@/api/menu/orderfield/list';

const field = (over: Partial<MenuOrderField>): MenuOrderField => ({
  id: 'f1',
  label: 'Serial',
  dataType: 'TEXT',
  isRequired: false,
  options: [],
  viewOrder: 0,
  isActive: true,
  ...over,
});

describe('parseCustomFields', () => {
  it('returns {} for empty, invalid or non-object input', () => {
    expect(parseCustomFields('')).toEqual({});
    expect(parseCustomFields(null)).toEqual({});
    expect(parseCustomFields('nope')).toEqual({});
    expect(parseCustomFields('["a"]')).toEqual({});
  });
  it('keeps only non-empty string values', () => {
    expect(parseCustomFields('{"a":"x","b":"","c":1}')).toEqual({ a: 'x' });
  });
});

describe('serializeCustomFields', () => {
  it('trims and drops blanks', () => {
    expect(serializeCustomFields({ a: ' x ', b: '  ', c: '' })).toBe('{"a":"x"}');
  });
  it('round-trips with parse', () => {
    const json = serializeCustomFields({ a: 'x', b: 'y' });
    expect(parseCustomFields(json)).toEqual({ a: 'x', b: 'y' });
  });
});

describe('fieldsForOrder', () => {
  it('hides inactive fields unless the order has a value for them, sorted by viewOrder', () => {
    const fields = [
      field({ id: 'a', viewOrder: 2 }),
      field({ id: 'b', viewOrder: 1, isActive: false }),
      field({ id: 'c', viewOrder: 0, isActive: false }),
    ];
    expect(fieldsForOrder(fields, { b: 'kept' }).map((f) => f.id)).toEqual(['b', 'a']);
  });
});

describe('missingRequiredFields', () => {
  it('reports active required fields with no value', () => {
    const fields = [
      field({ id: 'a', isRequired: true }),
      field({ id: 'b', isRequired: true, isActive: false }),
      field({ id: 'c', isRequired: false }),
    ];
    expect(missingRequiredFields(fields, {}).map((f) => f.id)).toEqual(['a']);
    expect(missingRequiredFields(fields, { a: '  ' }).map((f) => f.id)).toEqual(['a']);
    expect(missingRequiredFields(fields, { a: 'ok' })).toEqual([]);
  });
});

describe('formatCustomFieldValue', () => {
  const labels = { yes: 'Yes', no: 'No' };
  it('formats booleans and passes text through', () => {
    expect(formatCustomFieldValue(field({ dataType: 'BOOLEAN' }), 'true', labels)).toBe('Yes');
    expect(formatCustomFieldValue(field({ dataType: 'BOOLEAN' }), 'false', labels)).toBe('No');
    expect(formatCustomFieldValue(field({}), 'abc', labels)).toBe('abc');
    expect(formatCustomFieldValue(field({}), undefined, labels)).toBe('');
  });
  it('falls back to the raw value for an unparsable date', () => {
    expect(formatCustomFieldValue(field({ dataType: 'DATE' }), 'not-a-date', labels)).toBe('not-a-date');
  });
});

describe('buildCustomFieldsTable', () => {
  const labels = { yes: 'Yes', no: 'No' };
  it('renders rows for filled fields and escapes tenant-typed text', async () => {
    const { buildCustomFieldsTable } = await import('@/utils/documentVariableSubstitution');
    const fields = [field({ id: 'a', label: 'Model <b>' }), field({ id: 'b', label: 'Empty', viewOrder: 1 })];
    const html = buildCustomFieldsTable(fields, JSON.stringify({ a: '<script>x</script>' }), 'none', labels);
    expect(html).toContain('Model &lt;b&gt;');
    expect(html).toContain('&lt;script&gt;x&lt;/script&gt;');
    expect(html).not.toContain('Empty');
  });
  it('falls back to the empty label when nothing is filled', async () => {
    const { buildCustomFieldsTable } = await import('@/utils/documentVariableSubstitution');
    expect(buildCustomFieldsTable([field({})], '{}', 'none', labels)).toBe('<p>none</p>');
  });
});
