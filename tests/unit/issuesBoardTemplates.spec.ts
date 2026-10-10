import { describe, expect, it } from 'vitest';
import { BOARD_TEMPLATES, boardTemplatePayload, repairsBoardName } from '@/config/issuesBoardTemplates';

describe('repairs board template', () => {
  it('is offered with the Menu integration on', () => {
    expect(BOARD_TEMPLATES.map((t) => t.id)).toContain('repairs');
    const payload = boardTemplatePayload('repairs', 'ru');
    expect(JSON.parse(payload.integrationFlags!)).toMatchObject({ menu: true });
    expect(payload.businessType).toBe('service_center');
    expect(payload.locale).toBe('ru');
  });

  it('has a repair pipeline with two terminal columns, localized', () => {
    for (const loc of ['ru', 'en', 'kk']) {
      const cols = JSON.parse(boardTemplatePayload('repairs', loc).statuses!) as { key: string; label: string; is_terminal: boolean }[];
      expect(cols.map((c) => c.key)).toEqual(['accepted', 'diagnostics', 'approval', 'waiting_part', 'repair', 'ready', 'handed_over', 'cancelled']);
      expect(cols.filter((c) => c.is_terminal).map((c) => c.key)).toEqual(['handed_over', 'cancelled']);
      expect(cols.every((c) => c.label.trim().length > 0)).toBe(true);
    }
    expect(JSON.parse(boardTemplatePayload('repairs', 'en').statuses!)[1].label).toBe('Diagnostics');
  });

  it('names the onboarding board per locale, falling back to Russian', () => {
    expect(repairsBoardName('en')).toBe('Repairs');
    expect(repairsBoardName('kk')).toBe('Жөндеу');
    expect(repairsBoardName('xx')).toBe('Ремонты');
  });

  it('keeps the basic template byte-for-byte unchanged', () => {
    expect(boardTemplatePayload('basic', 'ru')).toEqual({});
  });
});
