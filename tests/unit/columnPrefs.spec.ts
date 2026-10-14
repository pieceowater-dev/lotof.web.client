import { describe, expect, it } from 'vitest';
import { parseHidden, visibleColumns, toggleHidden } from '@/utils/columnPrefs';

const all = [{ key: 'name' }, { key: 'sku' }, { key: 'cost' }];

describe('column preferences', () => {
  it('reads stored keys and shrugs off junk', () => {
    expect(parseHidden('["sku","cost"]')).toEqual(['sku', 'cost']);
    expect(parseHidden('not json')).toEqual([]);
    expect(parseHidden('{"a":1}')).toEqual([]);
    expect(parseHidden('[1,"x"]')).toEqual(['x']);
    expect(parseHidden(null)).toEqual([]);
  });
  it('hides what is switched off but never a locked column', () => {
    expect(visibleColumns(all, ['sku', 'name'], ['name']).map((c) => c.key)).toEqual(['name', 'cost']);
  });
  it('a column added later is visible by default', () => {
    expect(visibleColumns([...all, { key: 'new' }], ['sku']).map((c) => c.key)).toEqual(['name', 'cost', 'new']);
  });
  it('toggling flips a column and ignores locked ones', () => {
    expect(toggleHidden([], 'sku')).toEqual(['sku']);
    expect(toggleHidden(['sku'], 'sku')).toEqual([]);
    expect(toggleHidden([], 'name', ['name'])).toEqual([]);
  });
});
