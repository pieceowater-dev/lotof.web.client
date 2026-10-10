import { describe, expect, it } from 'vitest';
import { serviceCenterOrderFields, serviceCenterTemplates } from '@/config/serviceCenterPreset';
import { MENU_DOC_VARIABLES } from '@/utils/menuDocVariables';

const LOCALES = ['ru', 'en', 'kk'] as const;

// Every {{TOKEN}} in a preset template must be a real variable spelling in
// that locale, otherwise printing leaves a raw "{{...}}" in the document.
function knownTokens(locale: (typeof LOCALES)[number]): Set<string> {
  return new Set(MENU_DOC_VARIABLES.map((v) => v.localTokens[locale]));
}

describe('service center preset', () => {
  it('offers the same order fields in every language, with the key ones required', () => {
    const ru = serviceCenterOrderFields('ru');
    expect(ru.filter((f) => f.isRequired)).toHaveLength(2);
    for (const l of LOCALES) {
      const fields = serviceCenterOrderFields(l);
      expect(fields).toHaveLength(ru.length);
      expect(fields.map((f) => f.isRequired)).toEqual(ru.map((f) => f.isRequired));
      expect(fields.every((f) => f.label.trim().length > 0 && f.dataType === 'TEXT')).toBe(true);
    }
  });

  it.each(LOCALES)('builds three documents in %s using only known variables', (locale) => {
    const templates = serviceCenterTemplates(locale);
    expect(templates).toHaveLength(3);
    const known = knownTokens(locale);
    for (const tpl of templates) {
      expect(tpl.name.trim()).not.toBe('');
      const tokens = [...tpl.content.matchAll(/\{\{([^}]+)\}\}/g)].map((m) => m[1]);
      expect(tokens.length).toBeGreaterThan(0);
      for (const token of tokens) expect(known.has(token), `${tpl.name}: unknown token ${token}`).toBe(true);
    }
  });

  it('the completed-work act splits works from parts and shows the warranty', () => {
    const avr = serviceCenterTemplates('en')[0].content;
    for (const token of ['ORDER_WORKS', 'ORDER_MATERIALS', 'ORDER_WORKS_TOTAL', 'ORDER_MATERIALS_TOTAL', 'ORDER_WARRANTY', 'CUSTOM_FIELDS']) {
      expect(avr).toContain(`{{${token}}}`);
    }
  });

  it('falls back to Russian for an unknown locale', () => {
    expect(serviceCenterTemplates('xx' as any)[0].name).toBe(serviceCenterTemplates('ru')[0].name);
    expect(serviceCenterOrderFields('xx' as any)[0].label).toBe(serviceCenterOrderFields('ru')[0].label);
  });
});
