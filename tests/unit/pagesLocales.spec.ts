import { describe, expect, it } from 'vitest';
import ru from '../../locales/ru.json';
import en from '../../locales/en.json';
import kk from '../../locales/kk.json';

type Tree = { [k: string]: string | Tree };
function leaves(d: Tree, pre = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(d)) {
    if (typeof v === 'string') out[pre + k] = v;
    else Object.assign(out, leaves(v, pre + k + '.'));
  }
  return out;
}
const placeholders = (s: string) => [...s.matchAll(/\{[a-zA-Z0-9]+\}/g)].map(m => m[0]).sort().join(',');

// The whole Pages interface exists in all three languages, with the same variables in each string.
describe('lota Pages locales', () => {
  const r = leaves((ru as any).pages);
  for (const [name, loc] of [['en', en], ['kk', kk]] as const) {
    const l = leaves((loc as any).pages);
    it(`${name} has every key of ru`, () => {
      expect(Object.keys(r).filter(k => !(k in l))).toEqual([]);
      expect(Object.keys(l).filter(k => !(k in r))).toEqual([]);
    });
    it(`${name} keeps the placeholders of ru`, () => {
      const bad = Object.keys(r).filter(k => k in l && placeholders(r[k]) !== placeholders(l[k]));
      expect(bad).toEqual([]);
    });
    it(`${name} app tile strings exist`, () => {
      expect((loc as any).app.pages).toBeTruthy();
      expect((loc as any).app.pagesDesc).toBeTruthy();
    });
  }
});
