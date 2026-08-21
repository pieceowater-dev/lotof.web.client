import type { MenuOrder } from '@/api/menu/order/list';
import type { MenuOrderItem } from '@/api/menu/order/items';
import type { MenuOrderMember } from '@/api/menu/order/members';
import { smartOrderNumber } from '@/utils/orderNumber';
import { formatDisplayPhoneUniversal } from '@/utils/phone';

// Order customerName/phone/deliveryAddress and item names are free text a
// customer or staff member typed in, not app-controlled strings -- same
// unescaped-HTML-injection risk components/Card.vue's openPrintDialog once
// had (see its escapeHtml comment), so every one of those goes through this
// before landing in the printable HTML document.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatMoney(n: number): string {
  return n.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function itemUnitPrice(i: MenuOrderItem): number {
  return i.priceAtPurchase + (i.modifiers || []).reduce((sum, m) => sum + m.priceAtPurchase, 0);
}

function buildItemsTable(items: MenuOrderItem[], emptyLabel: string, headers: { name: string; qty: string; price: string; sum: string }): string {
  if (!items.length) return `<p>${escapeHtml(emptyLabel)}</p>`;
  const rows = items
    .map((i, idx) => {
      const unit = itemUnitPrice(i);
      return `<tr>
        <td style="padding:4px 8px;border-bottom:1px solid #ddd">${idx + 1}</td>
        <td style="padding:4px 8px;border-bottom:1px solid #ddd">${escapeHtml(i.name)}</td>
        <td style="padding:4px 8px;border-bottom:1px solid #ddd;text-align:right">${i.quantity}</td>
        <td style="padding:4px 8px;border-bottom:1px solid #ddd;text-align:right">${formatMoney(unit)}</td>
        <td style="padding:4px 8px;border-bottom:1px solid #ddd;text-align:right">${formatMoney(unit * i.quantity)}</td>
      </tr>`;
    })
    .join('');
  return `<table style="width:100%;border-collapse:collapse;font-size:inherit">
    <thead><tr>
      <th style="padding:4px 8px;border-bottom:2px solid #000;text-align:left">#</th>
      <th style="padding:4px 8px;border-bottom:2px solid #000;text-align:left">${escapeHtml(headers.name)}</th>
      <th style="padding:4px 8px;border-bottom:2px solid #000;text-align:right">${escapeHtml(headers.qty)}</th>
      <th style="padding:4px 8px;border-bottom:2px solid #000;text-align:right">${escapeHtml(headers.price)}</th>
      <th style="padding:4px 8px;border-bottom:2px solid #000;text-align:right">${escapeHtml(headers.sum)}</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

export type BuildMenuDocVariablesInput = {
  order: MenuOrder;
  items: MenuOrderItem[];
  members: MenuOrderMember[];
  memberDisplayName: (userId: string) => string;
  guestLabel: string;
  noneLabel: string;
  itemsTableHeaders: { name: string; qty: string; price: string; sum: string };
};

// Builds the {{VARIABLE}} -> value map for one order, entirely from data the
// order card already has loaded (order/items/members, plus hub-resolved
// member names) -- no extra network calls at print time.
export function buildMenuDocVariables(input: BuildMenuDocVariablesInput): Record<string, string> {
  const { order, items, members, memberDisplayName, guestLabel, noneLabel, itemsTableHeaders } = input;
  const amountDue = order.totalAmount - order.discountAmount - order.paidAmount;
  const employeeNames = members.map((m) => memberDisplayName(m.userId)).filter(Boolean);

  return {
    TODAY_DATE: new Date().toLocaleDateString('ru-RU'),
    ORDER_NUMBER: smartOrderNumber(order),
    ORDER_TOTAL_AMOUNT: formatMoney(order.totalAmount),
    DISCOUNT_AMOUNT: formatMoney(order.discountAmount),
    PAID_AMOUNT: formatMoney(order.paidAmount),
    AMOUNT_DUE: formatMoney(amountDue),
    ORDER_ITEMS: buildItemsTable(items, noneLabel, itemsTableHeaders),
    CLIENT_NAME: escapeHtml(order.customerName || guestLabel),
    CLIENT_PHONE: escapeHtml(order.phone ? formatDisplayPhoneUniversal(order.phone) : ''),
    CLIENT_ADDRESS: escapeHtml(order.deliveryAddress || ''),
    EMPLOYEE_NAME: escapeHtml(employeeNames.length ? employeeNames.join(', ') : noneLabel),
  };
}

const VARIABLE_TOKEN_RE = /\{\{\s*([A-Z_]+)\s*\}\}/g;

// Unknown tokens (typos, or a variable removed from the registry after a
// template was authored) are left as-is rather than replaced with an empty
// string, so a broken placeholder stays visible/debuggable in the printed
// output instead of silently vanishing.
export function substituteMenuDocVariables(templateHtml: string, variables: Record<string, string>): string {
  return templateHtml.replace(VARIABLE_TOKEN_RE, (match, key) =>
    Object.prototype.hasOwnProperty.call(variables, key) ? variables[key] : match
  );
}
