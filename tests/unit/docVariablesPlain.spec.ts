import { describe, it, expect } from 'vitest';
import { buildMenuDocVariables, substituteMenuDocVariables } from '@/utils/documentVariableSubstitution';
import { MENU_DOC_VARIABLES } from '@/utils/menuDocVariables';

const order: any = {
  id: 'o1', number: 105, createdAt: '2026-10-14T09:00:00Z', displayNumber: 'A105', type: 'pickup', status: 'NEW', phone: '+77001112233',
  totalAmount: 12345.5, discountAmount: 345.5, paidAmount: 2000, customerName: 'Ann',
};

function vars() {
  return buildMenuDocVariables({
    order, items: [], members: [], memberDisplayName: () => '', guestLabel: 'Guest', noneLabel: '—',
    itemsTableHeaders: { name: 'Name', qty: 'Qty', price: 'Price', sum: 'Sum' }, brand: null, branch: null,
  } as any);
}

describe('plain 00.00 money variables', () => {
  it('give digits with two decimals and no locale separators', () => {
    const v = vars();
    expect(v.ORDER_TOTAL_AMOUNT_PLAIN).toBe('12345.50');
    // total 12345.5 - discount 345.5 - paid 2000 = 10000
    expect(v.AMOUNT_DUE_PLAIN).toBe('10000.00');
  });

  it('are available next to the formatted ones and are substituted in a template', () => {
    const html = substituteMenuDocVariables('<p>{{ORDER_TOTAL_AMOUNT_PLAIN}} | {{AMOUNT_DUE_PLAIN}}</p>', vars());
    expect(html).toBe('<p>12345.50 | 10000.00</p>');
  });

  it('are registered for the editor palette in every language', () => {
    for (const key of ['ORDER_TOTAL_AMOUNT_PLAIN', 'AMOUNT_DUE_PLAIN']) {
      const info = MENU_DOC_VARIABLES.find((x) => x.key === key);
      expect(info, key).toBeTruthy();
      expect(info!.localTokens.ru).toMatch(/_00$/);
      expect(info!.localTokens.kk).toMatch(/_00$/);
      expect(info!.localTokens.en).toBe(key);
    }
  });
});
