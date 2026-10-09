import { describe, expect, it } from 'vitest';
import { warrantyInfo } from '@/utils/warranty';

const completed = (closedAt: string) => ({ status: 'COMPLETED', closedAt });
const now = new Date('2026-10-10T12:00:00Z');

describe('warrantyInfo', () => {
  it('is none without a warranty period', () => {
    expect(warrantyInfo(0, completed('2026-10-01T00:00:00Z'), now).state).toBe('none');
    expect(warrantyInfo(-3, completed('2026-10-01T00:00:00Z'), now).state).toBe('none');
  });
  it('is pending until the order is completed', () => {
    expect(warrantyInfo(30, { status: 'IN_PREPARATION', closedAt: null }, now)).toEqual({ state: 'pending', endsAt: null, daysLeft: 0 });
    expect(warrantyInfo(30, { status: 'CANCELLED', closedAt: '2026-10-01T00:00:00Z' }, now).state).toBe('pending');
  });
  it('is active with the remaining whole days rounded up', () => {
    const info = warrantyInfo(30, completed('2026-10-01T12:00:00Z'), now);
    expect(info.state).toBe('active');
    expect(info.daysLeft).toBe(21);
    expect(info.endsAt?.toISOString()).toBe('2026-10-31T12:00:00.000Z');
  });
  it('is expired once the end date has passed', () => {
    const info = warrantyInfo(7, completed('2026-09-01T00:00:00Z'), now);
    expect(info.state).toBe('expired');
    expect(info.daysLeft).toBe(0);
  });
  it('treats an unparsable close date as pending', () => {
    expect(warrantyInfo(7, completed('garbage'), now).state).toBe('pending');
  });
});

describe('buildWarrantyTable', () => {
  const headers = { item: 'Item', until: 'Until', days: 'days' };
  const line = (name: string, warrantyDays: number) => ({
    id: name, orderId: 'o', menuItemId: 'm', name, priceAtPurchase: 1, quantity: 1, warrantyDays, modifiers: [],
  });

  it('lists only lines with a warranty and escapes names', async () => {
    const { buildWarrantyTable } = await import('@/utils/documentVariableSubstitution');
    const html = buildWarrantyTable([line('<b>Screen</b>', 30), line('Glue', 0)], { status: 'NEW', closedAt: null }, 'none', headers);
    expect(html).toContain('&lt;b&gt;Screen&lt;/b&gt;');
    expect(html).not.toContain('Glue');
    expect(html).toContain('30 days');
  });
  it('shows the end date once completed', async () => {
    const { buildWarrantyTable } = await import('@/utils/documentVariableSubstitution');
    const html = buildWarrantyTable([line('Screen', 10)], { status: 'COMPLETED', closedAt: '2026-10-01T00:00:00Z' }, 'none', headers);
    expect(html).toContain('11.10.2026');
  });
  it('falls back to the empty label without warranty lines', async () => {
    const { buildWarrantyTable } = await import('@/utils/documentVariableSubstitution');
    expect(buildWarrantyTable([line('Glue', 0)], { status: 'NEW', closedAt: null }, 'none', headers)).toBe('<p>none</p>');
  });
});
