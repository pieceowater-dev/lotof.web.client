import { describe, expect, it } from 'vitest';
import { serviceCenterTemplates } from '@/config/serviceCenterPreset';
import {
  buildCustomFieldsTable,
  buildMenuDocVariables,
  buildWarrantyTable,
  substituteMenuDocVariables,
} from '@/utils/documentVariableSubstitution';
import type { MenuOrder } from '@/api/menu/order/list';
import type { MenuOrderItem } from '@/api/menu/order/items';
import type { MenuOrderField } from '@/api/menu/orderfield/list';

const order = {
  id: 'o1', number: 7, createdAt: '2026-10-10T08:00:00Z', type: 'pickup', status: 'COMPLETED', phone: '+77001234567',
  customerName: 'Иван <b>Петров</b>', totalAmount: 30000, discountAmount: 1000, paidAmount: 10000,
  closedAt: '2026-10-11T08:00:00Z', customFields: '{"f1":"iPhone 14","f2":"SN-123"}',
} as unknown as MenuOrder;

const items = [
  { id: 'i1', orderId: 'o1', menuItemId: 'm1', name: 'Замена экрана', priceAtPurchase: 5000, quantity: 1, itemKind: 'WORK', workPayPercent: 30, warrantyDays: 90, modifiers: [] },
  { id: 'i2', orderId: 'o1', menuItemId: 'm2', name: 'Экран', priceAtPurchase: 25000, quantity: 1, itemKind: 'MATERIAL', costPriceAtPurchase: 11000, warrantyDays: 90, modifiers: [] },
] as unknown as MenuOrderItem[];

const fields = [
  { id: 'f1', label: 'Устройство, модель', dataType: 'TEXT', isRequired: true, options: [], viewOrder: 0, isActive: true },
  { id: 'f2', label: 'Серийный номер / IMEI', dataType: 'TEXT', isRequired: false, options: [], viewOrder: 1, isActive: true },
] as MenuOrderField[];

function render(locale: 'ru' | 'en' | 'kk', templateIndex: number): string {
  const labels = { yes: 'Да', no: 'Нет' };
  const vars = buildMenuDocVariables({
    order, items, members: [], memberDisplayName: () => '', guestLabel: 'Гость', noneLabel: '—',
    itemsTableHeaders: { name: 'Название', qty: 'Кол-во', price: 'Цена', sum: 'Сумма' },
    brand: { name: 'Сервис Плюс' } as any, branch: { name: 'Главный', address: 'Абая 1', phone: '+77011112233' } as any,
    customFieldsBlock: buildCustomFieldsTable(fields, order.customFields, '—', labels),
    warrantyBlock: buildWarrantyTable(items, order, '—', { item: 'Позиция', until: 'До', days: 'дн.' }),
  });
  return substituteMenuDocVariables(serviceCenterTemplates(locale)[templateIndex].content, vars);
}

describe('service center documents render with real order data', () => {
  it.each(['ru', 'en', 'kk'] as const)('leaves no unresolved {{variables}} in %s', (locale) => {
    for (let i = 0; i < 3; i++) expect(render(locale, i)).not.toMatch(/\{\{[^}]+\}\}/);
  });

  it('the completed-work act lists works and parts separately with totals', () => {
    // ru-RU groups thousands with a non-breaking space; compare as plain spaces.
    const html = render('ru', 0).replace(/[\u00a0\u202f]/g, ' ');
    expect(html).toContain('Замена экрана');
    expect(html).toContain('Экран');
    expect(html).toContain('Устройство, модель');
    expect(html).toContain('iPhone 14');
    expect(html).toContain('SN-123');
    expect(html).toContain('5 000'); // works total
    expect(html).toContain('25 000'); // parts total
    expect(html).toContain('Сервис Плюс');
    expect(html).toContain('Абая 1');
  });

  it('escapes customer-typed text', () => {
    const html = render('ru', 1);
    expect(html).toContain('Иван &lt;b&gt;Петров&lt;/b&gt;');
    expect(html).not.toContain('<b>Петров</b>');
  });

  it('shows the warranty end date once the order is completed', () => {
    expect(render('ru', 0)).toContain('09.01.2027'); // 2026-10-11 + 90 days
  });
});
