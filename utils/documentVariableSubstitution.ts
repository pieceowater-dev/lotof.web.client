import type { MenuOrder } from '@/api/menu/order/list';
import type { MenuOrderItem } from '@/api/menu/order/items';
import type { MenuOrderMember } from '@/api/menu/order/members';
import type { MenuBrandSettings } from '@/api/menu/brandsettings/get';
import type { MenuBranch } from '@/api/menu/branch/list';
import { smartOrderNumber } from '@/utils/orderNumber';
import { formatDisplayPhoneUniversal } from '@/utils/phone';
import { MENU_DOC_VARIABLES } from '@/utils/menuDocVariables';
import { parseSocialLinks, socialLabel } from '@/utils/social';
import type { MenuOrderField } from '@/api/menu/orderfield/list';
import { warrantyInfo } from '@/utils/warranty';
import { splitLabour } from '@/utils/labour';
import { fieldsForOrder, formatCustomFieldValue, parseCustomFields } from '@/utils/orderCustomFields';

// Order customerName/phone/deliveryAddress and item names are free text a
// customer or staff member typed in, not app-controlled strings -- same
// unescaped-HTML-injection risk components/ui/Card.vue's openPrintDialog once
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
  // Fixed column widths so several item tables in one document (works, parts,
  // everything) line up with each other.
  return `<table style="width:100%;border-collapse:collapse;font-size:inherit;table-layout:fixed">
    <colgroup><col style="width:6%"><col><col style="width:12%"><col style="width:18%"><col style="width:18%"></colgroup>
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

// CUSTOM_FIELDS: the order's custom field values as a two-column table
// (field name | value), skipping fields with no value. Names and values are
// tenant/staff-typed free text, so both go through escapeHtml.
export function buildCustomFieldsTable(
  fields: MenuOrderField[],
  customFieldsJson: string | null | undefined,
  emptyLabel: string,
  labels: { yes: string; no: string }
): string {
  const values = parseCustomFields(customFieldsJson);
  const rows = fieldsForOrder(fields, values)
    .map((f) => ({ label: f.label, text: formatCustomFieldValue(f, values[f.id], labels) }))
    .filter((r) => r.text !== '')
    .map(
      (r) => `<tr>
        <td style="padding:4px 8px;border-bottom:1px solid #ddd;width:40%">${escapeHtml(r.label)}</td>
        <td style="padding:4px 8px;border-bottom:1px solid #ddd">${escapeHtml(r.text)}</td>
      </tr>`
    )
    .join('');
  if (!rows) return `<p>${escapeHtml(emptyLabel)}</p>`;
  return `<table style="width:100%;border-collapse:collapse;font-size:inherit"><tbody>${rows}</tbody></table>`;
}

// ORDER_WARRANTY: a table of the order's lines that carry a warranty with the
// date each one ends (or its length, until the order is completed).
export function buildWarrantyTable(
  items: MenuOrderItem[],
  order: Pick<MenuOrder, 'status' | 'closedAt'>,
  emptyLabel: string,
  headers: { item: string; until: string; days: string }
): string {
  const rows = items
    .filter((i) => (i.warrantyDays ?? 0) > 0)
    .map((i) => {
      const info = warrantyInfo(i.warrantyDays ?? 0, order);
      const until = info.endsAt ? info.endsAt.toLocaleDateString('ru-RU') : `${i.warrantyDays} ${headers.days}`;
      return `<tr>
        <td style="padding:4px 8px;border-bottom:1px solid #ddd">${escapeHtml(i.name)}</td>
        <td style="padding:4px 8px;border-bottom:1px solid #ddd;text-align:right">${escapeHtml(until)}</td>
      </tr>`;
    })
    .join('');
  if (!rows) return `<p>${escapeHtml(emptyLabel)}</p>`;
  return `<table style="width:100%;border-collapse:collapse;font-size:inherit">
    <thead><tr>
      <th style="padding:4px 8px;border-bottom:2px solid #000;text-align:left">${escapeHtml(headers.item)}</th>
      <th style="padding:4px 8px;border-bottom:2px solid #000;text-align:right">${escapeHtml(headers.until)}</th>
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
  brand: MenuBrandSettings | null;
  branch: MenuBranch | null | undefined;
  // Pre-rendered CUSTOM_FIELDS table; see buildCustomFieldsTable.
  customFieldsBlock?: string;
  // Pre-rendered ORDER_WARRANTY table; see buildWarrantyTable.
  warrantyBlock?: string;
};

// Builds the {{VARIABLE}} -> value map for one order, entirely from data the
// order card already has loaded (order/items/members, brand settings, the
// order's branch, plus hub-resolved member names) -- no extra network calls
// at print time. SOCIAL_LINKS_QR is a separate async step (see
// buildSocialLinksQrBlock) since QR generation can't happen synchronously.
export function buildMenuDocVariables(input: BuildMenuDocVariablesInput): Record<string, string> {
  const { order, items, members, memberDisplayName, guestLabel, noneLabel, itemsTableHeaders, brand, branch, customFieldsBlock, warrantyBlock } = input;
  const amountDue = order.totalAmount - order.discountAmount - order.paidAmount;
  const labour = splitLabour(items);
  const employeeNames = members.map((m) => memberDisplayName(m.userId)).filter(Boolean);

  return {
    TODAY_DATE: new Date().toLocaleDateString('ru-RU'),
    ORDER_NUMBER: smartOrderNumber(order),
    ORDER_TOTAL_AMOUNT: formatMoney(order.totalAmount),
    DISCOUNT_AMOUNT: formatMoney(order.discountAmount),
    PAID_AMOUNT: formatMoney(order.paidAmount),
    AMOUNT_DUE: formatMoney(amountDue),
    ORDER_ITEMS: buildItemsTable(items, noneLabel, itemsTableHeaders),
    ORDER_WORKS: buildItemsTable(labour.works, noneLabel, itemsTableHeaders),
    ORDER_MATERIALS: buildItemsTable(labour.materials, noneLabel, itemsTableHeaders),
    ORDER_WORKS_TOTAL: formatMoney(labour.worksTotal),
    ORDER_MATERIALS_TOTAL: formatMoney(labour.materialsTotal),
    CUSTOM_FIELDS: customFieldsBlock ?? `<p>${escapeHtml(noneLabel)}</p>`,
    ORDER_WARRANTY: warrantyBlock ?? `<p>${escapeHtml(noneLabel)}</p>`,
    CLIENT_NAME: escapeHtml(order.customerName || guestLabel),
    CLIENT_PHONE: escapeHtml(order.phone ? formatDisplayPhoneUniversal(order.phone) : ''),
    CLIENT_ADDRESS: escapeHtml(order.deliveryAddress || ''),
    EMPLOYEE_NAME: escapeHtml(employeeNames.length ? employeeNames.join(', ') : noneLabel),
    BRAND_NAME: escapeHtml(brand?.name || noneLabel),
    BRANCH_NAME: escapeHtml(branch?.name || noneLabel),
    BRANCH_ADDRESS: escapeHtml(branch?.address || noneLabel),
    BRANCH_PHONE: escapeHtml(branch?.phone ? formatDisplayPhoneUniversal(branch.phone) : noneLabel),
  };
}

// SOCIAL_LINKS_QR renders each of the brand's configured social links (see
// utils/social.ts) as a small scannable QR code with its platform label --
// generated client-side via the `qrcode` package (already a dependency,
// same one components/menu/settings/TableQrSection.vue uses for table QR
// codes), so there's no server-side QR service involved. Kept separate from
// buildMenuDocVariables because QRCode.toDataURL is inherently async;
// callers merge this in before calling substituteMenuDocVariables.
export async function buildSocialLinksQrBlock(socialLinksJson: string | null | undefined, noneLabel: string): Promise<string> {
  const links = parseSocialLinks(socialLinksJson);
  if (!links.length) return `<p>${escapeHtml(noneLabel)}</p>`;

  const QRCode = (await import('qrcode')).default;
  const cells = await Promise.all(
    links.map(async (l) => {
      const dataUrl = await QRCode.toDataURL(l.link, { width: 96, margin: 1 });
      const label = escapeHtml(socialLabel(l.name));
      return `<div style="display:inline-block;text-align:center;margin:0 12px 12px 0">
        <img src="${dataUrl}" alt="${label}" style="width:96px;height:96px" />
        <div style="font-size:11px;margin-top:4px">${label}</div>
      </div>`;
    })
  );
  return `<div>${cells.join('')}</div>`;
}

// Cyrillic range covers Russian; the extra chars are the Kazakh-only
// letters (Ә Ғ Қ Ң Ө Ұ Ү Һ І) used in this registry's kk token spellings
// (see menuDocVariables.ts) that fall outside plain А-Я.
const VARIABLE_TOKEN_RE = /\{\{\s*([A-ZА-ЯЁӘҒҚҢӨҰҮҺІ_]+)\s*\}\}/g;

// A template's {{TOKEN}} may be spelled in any of the three locales'
// token forms, independent of both the author's locale (when they inserted
// it) and the printing user's current locale -- so every spelling maps to
// the same computed value here, not just whichever locale is active now.
function expandTokenSpellings(variables: Record<string, string>): Record<string, string> {
  const expanded: Record<string, string> = { ...variables };
  for (const v of MENU_DOC_VARIABLES) {
    const value = variables[v.key];
    if (value === undefined) continue;
    for (const spelling of Object.values(v.localTokens)) {
      expanded[spelling] = value;
    }
  }
  return expanded;
}

// Unknown tokens (typos, or a variable removed from the registry after a
// template was authored) are left as-is rather than replaced with an empty
// string, so a broken placeholder stays visible/debuggable in the printed
// output instead of silently vanishing.
export function substituteMenuDocVariables(templateHtml: string, variables: Record<string, string>): string {
  const expanded = expandTokenSpellings(variables);
  return templateHtml.replace(VARIABLE_TOKEN_RE, (match, key) =>
    Object.prototype.hasOwnProperty.call(expanded, key) ? expanded[key] : match
  );
}
