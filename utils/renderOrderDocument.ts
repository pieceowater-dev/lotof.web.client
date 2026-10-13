import { buildCustomFieldsTable, buildMenuDocVariables, buildWarrantyTable, buildSocialLinksQrBlock, expandQrTokens, substituteMenuDocVariables } from '@/utils/documentVariableSubstitution';
import { MENU_DOC_VARIABLES_BY_KEY } from '@/utils/menuDocVariables';
import { smartOrderNumber } from '@/utils/orderNumber';
import { phoneDigitsForLink } from '@/utils/phoneLinks';
import { applyCustomDocVariables, parseCustomDocVariables } from '@/utils/customDocVariables';
import type { MenuOrder } from '@/api/menu/order/list';
import type { MenuOrderItem } from '@/api/menu/order/items';
import type { MenuOrderMember } from '@/api/menu/order/members';
import type { MenuDocumentTemplate } from '@/api/menu/documenttemplate/list';
import type { MenuBrandSettings } from '@/api/menu/brandsettings/get';
import type { MenuBranch } from '@/api/menu/branch/list';
import type { MenuOrderField } from '@/api/menu/orderfield/list';

export type RenderOrderDocumentInput = {
  template: MenuDocumentTemplate;
  order: MenuOrder;
  items: MenuOrderItem[];
  members: MenuOrderMember[];
  memberDisplayName: (userId: string) => string;
  brand: MenuBrandSettings | null;
  branch?: MenuBranch;
  orderFields: MenuOrderField[];
  nsSlug: string;
  origin: string;
  t: (key: string) => string;
};

/** Fills a document template with one order's data and returns the finished HTML. */
export async function renderOrderDocument(i: RenderOrderDocumentInput): Promise<string> {
  const { t, order, template } = i;
  const noneLabel = t('menu.docVarNoneLabel') || '—';
  const yesNo = { yes: t('menu.yes') || 'Yes', no: t('menu.no') || 'No' };
  const digits = phoneDigitsForLink(order.phone);
  const variables = buildMenuDocVariables({
    orderLink: digits ? `${i.origin}/to/${i.nsSlug}/menu/${smartOrderNumber(order)}-${digits}` : '',
    order,
    items: i.items,
    members: i.members,
    memberDisplayName: i.memberDisplayName,
    guestLabel: t('menu.guestCustomer') || 'Guest',
    noneLabel,
    itemsTableHeaders: {
      name: t('menu.name') || 'Name',
      qty: t('menu.quantity') || 'Qty',
      price: t('menu.price') || 'Price',
      sum: t('menu.total') || 'Total',
    },
    brand: i.brand,
    branch: i.branch,
    customFieldsBlock: buildCustomFieldsTable(i.orderFields, order.customFields, noneLabel, yesNo),
    warrantyBlock: buildWarrantyTable(i.items, order, noneLabel, {
      item: t('menu.name') || 'Name',
      until: t('menu.warrantyUntil') || 'Warranty until',
      days: t('menu.warrantyDaysShort') || 'days',
    }),
  });
  // QR generation is async and only worth doing if the template references it;
  // every locale's token spelling is checked, not just the UI language's.
  const socialTokens = Object.values(MENU_DOC_VARIABLES_BY_KEY.SOCIAL_LINKS_QR.localTokens);
  if (socialTokens.some((token) => template.content.includes(`{{${token}}}`))) {
    variables.SOCIAL_LINKS_QR = await buildSocialLinksQrBlock(i.brand?.socialLinks, noneLabel);
  }
  const linkTokens = new Set(Object.values(MENU_DOC_VARIABLES_BY_KEY.ORDER_LINK.localTokens));
  const content = await expandQrTokens(template.content, (name) => (linkTokens.has(name) ? variables.ORDER_LINK : undefined));
  return applyCustomDocVariables(substituteMenuDocVariables(content, variables), parseCustomDocVariables(i.brand?.orderRules));
}
