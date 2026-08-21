// Order.discountType wire values <-> localized label, same EN-key/localized-
// label split as utils/orderType.ts's ORDER_TYPE_LABEL.
export type DiscountType = '' | 'ORDER_AMOUNT' | 'ORDER_PERCENT' | 'ITEM_AMOUNT' | 'ITEM_PERCENT';

export const DISCOUNT_TYPE_LABEL: Record<DiscountType, { key: string; fallback: string }> = {
  '': { key: 'menu.discountTypeNone', fallback: 'No discount' },
  ORDER_AMOUNT: { key: 'menu.discountTypeOrderAmount', fallback: 'Amount off whole order' },
  ORDER_PERCENT: { key: 'menu.discountTypeOrderPercent', fallback: 'Percent off whole order' },
  ITEM_AMOUNT: { key: 'menu.discountTypeItemAmount', fallback: 'Amount off one product' },
  ITEM_PERCENT: { key: 'menu.discountTypeItemPercent', fallback: 'Percent off one product' },
};

export function discountTypeLabelInfo(type: string): { key: string; fallback: string } {
  return DISCOUNT_TYPE_LABEL[type as DiscountType] || DISCOUNT_TYPE_LABEL[''];
}

export function isItemScopedDiscount(type: string): boolean {
  return type === 'ITEM_AMOUNT' || type === 'ITEM_PERCENT';
}

export function isPercentDiscount(type: string): boolean {
  return type === 'ORDER_PERCENT' || type === 'ITEM_PERCENT';
}
