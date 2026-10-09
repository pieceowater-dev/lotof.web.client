// Registry of {{VARIABLE}} placeholders a Menu document template can use.
// The canonical identity of every variable is the English key -- that's
// what the rest of the app's logic (buildMenuDocVariables) keys off of --
// but the token text a manager actually types/sees inside {{ }} is
// localized per UI locale (e.g. {{ORDER_ITEMS}} in English becomes
// {{ЗАКАЗ_ТОВАРЫ}} in Russian), so a template only ever looks like the
// author's own language. Printing recognizes every locale's spelling at
// once (see documentVariableSubstitution.ts), not just whichever locale is
// active at print time, since the person printing may not be the same
// person -- or use the same UI language -- as whoever authored the template.
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
  | 'EMPLOYEE_NAME'
  | 'BRAND_NAME'
  | 'BRANCH_NAME'
  | 'BRANCH_ADDRESS'
  | 'BRANCH_PHONE'
  | 'SOCIAL_LINKS_QR';

export type MenuDocVariableLocale = 'en' | 'ru' | 'kk';

export type MenuDocVariableInfo = {
  key: MenuDocVariableKey;
  labelKey: string;
  fallback: string;
  group: 'order' | 'client' | 'staff' | 'brand';
  // The English entry always equals `key` -- English already reads as a
  // normal token, no separate spelling needed.
  localTokens: Record<MenuDocVariableLocale, string>;
};

export const MENU_DOC_VARIABLES: MenuDocVariableInfo[] = [
  {
    key: 'TODAY_DATE', labelKey: 'menu.docVarTodayDate', fallback: "Today's date", group: 'order',
    localTokens: { en: 'TODAY_DATE', ru: 'ДАТА_СЕГОДНЯ', kk: 'БҮГІНГІ_КҮН' },
  },
  {
    key: 'ORDER_NUMBER', labelKey: 'menu.docVarOrderNumber', fallback: 'Order number', group: 'order',
    localTokens: { en: 'ORDER_NUMBER', ru: 'ЗАКАЗ_НОМЕР', kk: 'ТАПСЫРЫС_НӨМІР' },
  },
  {
    key: 'ORDER_TOTAL_AMOUNT', labelKey: 'menu.docVarOrderTotal', fallback: 'Order total', group: 'order',
    localTokens: { en: 'ORDER_TOTAL_AMOUNT', ru: 'ЗАКАЗ_СУММА', kk: 'ТАПСЫРЫС_СОМА' },
  },
  {
    key: 'DISCOUNT_AMOUNT', labelKey: 'menu.docVarDiscount', fallback: 'Discount', group: 'order',
    localTokens: { en: 'DISCOUNT_AMOUNT', ru: 'ЗАКАЗ_СКИДКА', kk: 'ТАПСЫРЫС_ЖЕҢІЛДІК' },
  },
  {
    key: 'PAID_AMOUNT', labelKey: 'menu.docVarPaidAmount', fallback: 'Amount paid', group: 'order',
    localTokens: { en: 'PAID_AMOUNT', ru: 'ЗАКАЗ_ОПЛАЧЕНО', kk: 'ТАПСЫРЫС_ТӨЛЕНДІ' },
  },
  {
    key: 'AMOUNT_DUE', labelKey: 'menu.docVarAmountDue', fallback: 'Amount due', group: 'order',
    localTokens: { en: 'AMOUNT_DUE', ru: 'ЗАКАЗ_К_ОПЛАТЕ', kk: 'ТАПСЫРЫС_ТӨЛЕУГЕ' },
  },
  {
    key: 'ORDER_ITEMS', labelKey: 'menu.docVarOrderItems', fallback: 'Products list', group: 'order',
    localTokens: { en: 'ORDER_ITEMS', ru: 'ЗАКАЗ_ТОВАРЫ', kk: 'ТАПСЫРЫС_ТАУАРЛАР' },
  },
  {
    key: 'CLIENT_NAME', labelKey: 'menu.docVarClientName', fallback: 'Client name', group: 'client',
    localTokens: { en: 'CLIENT_NAME', ru: 'КЛИЕНТ_ИМЯ', kk: 'КЛИЕНТ_АТЫ' },
  },
  {
    key: 'CLIENT_PHONE', labelKey: 'menu.docVarClientPhone', fallback: 'Client phone', group: 'client',
    localTokens: { en: 'CLIENT_PHONE', ru: 'КЛИЕНТ_ТЕЛЕФОН', kk: 'КЛИЕНТ_ТЕЛЕФОН' },
  },
  {
    key: 'CLIENT_ADDRESS', labelKey: 'menu.docVarClientAddress', fallback: 'Client address', group: 'client',
    localTokens: { en: 'CLIENT_ADDRESS', ru: 'КЛИЕНТ_АДРЕС', kk: 'КЛИЕНТ_МЕКЕНЖАЙ' },
  },
  {
    key: 'EMPLOYEE_NAME', labelKey: 'menu.docVarEmployeeName', fallback: 'Employee', group: 'staff',
    localTokens: { en: 'EMPLOYEE_NAME', ru: 'СОТРУДНИК', kk: 'ҚЫЗМЕТКЕР' },
  },
  {
    key: 'BRAND_NAME', labelKey: 'menu.docVarBrandName', fallback: 'Business name', group: 'brand',
    localTokens: { en: 'BRAND_NAME', ru: 'БРЕНД_НАЗВАНИЕ', kk: 'БРЕНД_АТАУЫ' },
  },
  {
    key: 'BRANCH_NAME', labelKey: 'menu.docVarBranchName', fallback: 'Branch name', group: 'brand',
    localTokens: { en: 'BRANCH_NAME', ru: 'ФИЛИАЛ_НАЗВАНИЕ', kk: 'ФИЛИАЛ_АТАУЫ' },
  },
  {
    key: 'BRANCH_ADDRESS', labelKey: 'menu.docVarBranchAddress', fallback: 'Branch address', group: 'brand',
    localTokens: { en: 'BRANCH_ADDRESS', ru: 'ФИЛИАЛ_АДРЕС', kk: 'ФИЛИАЛ_МЕКЕНЖАЙЫ' },
  },
  {
    key: 'BRANCH_PHONE', labelKey: 'menu.docVarBranchPhone', fallback: 'Branch phone', group: 'brand',
    localTokens: { en: 'BRANCH_PHONE', ru: 'ФИЛИАЛ_ТЕЛЕФОН', kk: 'ФИЛИАЛ_ТЕЛЕФОНЫ' },
  },
  {
    key: 'SOCIAL_LINKS_QR', labelKey: 'menu.docVarSocialLinksQr', fallback: 'Social links (QR codes)', group: 'brand',
    localTokens: { en: 'SOCIAL_LINKS_QR', ru: 'СОЦСЕТИ_QR', kk: 'ӘЛЕУМЕТТІК_ЖЕЛІЛЕР_QR' },
  },
];

export const MENU_DOC_VARIABLES_BY_KEY: Record<MenuDocVariableKey, MenuDocVariableInfo> = Object.fromEntries(
  MENU_DOC_VARIABLES.map((v) => [v.key, v])
) as Record<MenuDocVariableKey, MenuDocVariableInfo>;

// The token text to insert into (or display within) the editor for the
// given locale, e.g. menuDocVariableToken('ORDER_ITEMS', 'ru') -> "{{ЗАКАЗ_ТОВАРЫ}}".
export function menuDocVariableToken(key: MenuDocVariableKey, locale: MenuDocVariableLocale): string {
  const spelling = MENU_DOC_VARIABLES_BY_KEY[key]?.localTokens[locale] || key;
  return `{{${spelling}}}`;
}
