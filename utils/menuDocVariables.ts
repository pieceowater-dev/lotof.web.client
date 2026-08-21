// Registry of {{VARIABLE}} placeholders a Menu document template can use.
// Stored/matched in English (the DB and template markup only ever see the
// bare key), but the template editor's variable picker and any hint UI show
// the localized label — same EN-key/localized-label split as
// utils/orderType.ts's ORDER_TYPE_LABEL, just with more entries.
export type MenuDocVariableKey =
  | 'TODAY_DATE'
  | 'ORDER_NUMBER'
  | 'ORDER_TOTAL_AMOUNT'
  | 'DISCOUNT_AMOUNT'
  | 'PAID_AMOUNT'
  | 'AMOUNT_DUE'
  | 'ORDER_ITEMS'
  | 'CLIENT_NAME'
  | 'CLIENT_PHONE'
  | 'CLIENT_ADDRESS'
  | 'EMPLOYEE_NAME';

export type MenuDocVariableInfo = {
  key: MenuDocVariableKey;
  labelKey: string;
  fallback: string;
  group: 'order' | 'client' | 'staff';
};

export const MENU_DOC_VARIABLES: MenuDocVariableInfo[] = [
  { key: 'TODAY_DATE', labelKey: 'menu.docVarTodayDate', fallback: "Today's date", group: 'order' },
  { key: 'ORDER_NUMBER', labelKey: 'menu.docVarOrderNumber', fallback: 'Order number', group: 'order' },
  { key: 'ORDER_TOTAL_AMOUNT', labelKey: 'menu.docVarOrderTotal', fallback: 'Order total', group: 'order' },
  { key: 'DISCOUNT_AMOUNT', labelKey: 'menu.docVarDiscount', fallback: 'Discount', group: 'order' },
  { key: 'PAID_AMOUNT', labelKey: 'menu.docVarPaidAmount', fallback: 'Amount paid', group: 'order' },
  { key: 'AMOUNT_DUE', labelKey: 'menu.docVarAmountDue', fallback: 'Amount due', group: 'order' },
  { key: 'ORDER_ITEMS', labelKey: 'menu.docVarOrderItems', fallback: 'Products list', group: 'order' },
  { key: 'CLIENT_NAME', labelKey: 'menu.docVarClientName', fallback: 'Client name', group: 'client' },
  { key: 'CLIENT_PHONE', labelKey: 'menu.docVarClientPhone', fallback: 'Client phone', group: 'client' },
  { key: 'CLIENT_ADDRESS', labelKey: 'menu.docVarClientAddress', fallback: 'Client address', group: 'client' },
  { key: 'EMPLOYEE_NAME', labelKey: 'menu.docVarEmployeeName', fallback: 'Employee', group: 'staff' },
];

export function menuDocVariableToken(key: MenuDocVariableKey): string {
  return `{{${key}}}`;
}
