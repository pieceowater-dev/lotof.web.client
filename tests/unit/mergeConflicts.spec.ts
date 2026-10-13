import { describe, it, expect } from 'vitest';
import { previewMerge } from '@/utils/mergeConflicts';

const row = (over: any): any => ({ client: { id: 'x', clientType: 'INDIVIDUAL' }, contacts: [], tags: [], ...over });

describe('merge preview', () => {
  it('counts new and repeated contact details, ignoring phone formatting', () => {
    const p = row({ contacts: [{ type: 'phone', value: '+7 777 111-22-33' }, { type: 'email', value: 'A@b.kz' }] });
    const o = row({ contacts: [{ type: 'phone', value: '87771112233'.replace(/^8/, '7') }, { type: 'email', value: 'a@b.kz' }, { type: 'phone', value: '+7 701 000 00 00' }] });
    expect(previewMerge(p, [o])).toMatchObject({ newContacts: 1, sameContacts: 2, conflicts: [] });
  });

  it('reports different birth dates and BINs but not empty ones', () => {
    const p = row({ individual: { birthDate: '1990-01-01T00:00:00Z' } });
    const same = row({ individual: { birthDate: '1990-01-01' } });
    const diff = row({ individual: { birthDate: '1991-02-02' } });
    const blank = row({ individual: {} });
    expect(previewMerge(p, [same, blank]).conflicts).toEqual([]);
    expect(previewMerge(p, [diff]).conflicts).toEqual([{ field: 'birthDate', kept: '1990-01-01', other: '1991-02-02' }]);
    const legalP = row({ legalEntity: { binIin: '111' } });
    expect(previewMerge(legalP, [row({ legalEntity: { binIin: '222' } })]).conflicts[0].field).toBe('binIin');
  });
});
