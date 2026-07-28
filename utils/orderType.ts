// Shared across the storefront checkout, order-status page, admin order
// list/detail, and the kitchen board — one place mapping an order's
// fulfilment `type` to an icon and a translation key + English fallback,
// instead of the `type === 'pickup' ? a : b` ternaries repeated per view.
// Callers apply the fallback the same way the rest of the app does:
// `t(info.key) || info.fallback`.

export type OrderFulfilmentType = 'delivery' | 'pickup' | 'table';

const ORDER_TYPE_ICON: Record<string, string> = {
  delivery: 'lucide:truck',
  pickup: 'lucide:store',
  table: 'lucide:utensils',
};

export function orderTypeIcon(type: string): string {
  return ORDER_TYPE_ICON[type] || 'lucide:package';
}

const ORDER_TYPE_LABEL: Record<string, { key: string; fallback: string }> = {
  delivery: { key: 'menu.delivery', fallback: 'Delivery' },
  pickup: { key: 'menu.pickup', fallback: 'Pickup' },
  table: { key: 'menu.tableService', fallback: 'Table service' },
};

export function orderTypeLabelInfo(type: string): { key: string; fallback: string } {
  return ORDER_TYPE_LABEL[type] || { key: 'menu.delivery', fallback: 'Delivery' };
}
