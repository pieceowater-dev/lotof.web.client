import { describe, it, expect } from 'vitest';
import { rewriteLegacyMediaHosts } from '@/utils/legacyMedia';

describe('rewriteLegacyMediaHosts', () => {
  it('turns lota.kz media URLs into origin-relative paths, deeply', () => {
    const out = rewriteLegacyMediaHosts({
      logo: 'https://lota.kz/api-plans/media/plans/ns/a.jpeg',
      list: [{ photo: 'http://www.lota.kz/api-menu/media/x.png' }],
    });
    expect(out.logo).toBe('/api-plans/media/plans/ns/a.jpeg');
    expect(out.list[0].photo).toBe('/api-menu/media/x.png');
  });
  it('leaves everything else alone', () => {
    const v = { a: 'https://lota.tools/api-plans/media/a.webp', b: 'https://lota.kz/other', c: 5, d: null };
    expect(rewriteLegacyMediaHosts({ ...v })).toEqual(v);
  });
});
