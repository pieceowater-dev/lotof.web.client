import { menuClient } from '@/api/clients';
import { menuRequestWithRefresh } from '@/api/menu/menuRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';
import type { MenuOrder } from '@/api/menu/order/list';

// Stages (the tenant's own statuses inside the fixed lifecycle groups), the
// price stage, urgency, the payments journal, order rules and quick counts.

export type OrderStage = {
  id: string;
  status: string;
  name: string;
  color: string;
  sortOrder: number;
  slaMinutes: number;
  isUrgent: boolean;
  isOverdue: boolean;
};

export type OrderPayment = {
  id: string;
  orderId: string;
  amount: number;
  method: 'CASH' | 'CARD' | 'TRANSFER' | 'OTHER' | string;
  kind: 'PAYMENT' | 'REFUND' | string;
  paidAt: string;
  userId?: string | null;
  comment: string;
  externalRef?: string | null;
};

export type OrderQuickCounts = { urgent: number; overdue: number; ready: number; mine: number };

const ORDER_FIELDS = `id number branchId clientId type status phone customerName deliveryAddress deliveryAt comment sourceTag totalAmount createdAt closedAt discountAmount discountType discountValue discountItemId paidAmount customFields warrantyOfOrderId readyAt priceQuotedAt priceQuotedBy priceApprovedAt stageId statusChangedAt isUrgent`;
const STAGE_FIELDS = 'id status name color sortOrder slaMinutes isUrgent isOverdue';
const PAYMENT_FIELDS = 'id orderId amount method kind paidAt userId comment externalRef';

async function call<T>(menuToken: string, ns: string, query: string, variables?: Record<string, unknown>): Promise<T> {
  const devHeaders = await getDeviceHeaders();
  return menuRequestWithRefresh(
    () => menuClient.request<T>(query as any, variables, { headers: { MenuAuthorization: `Bearer ${menuToken}`, Namespace: ns, ...devHeaders } }),
    ns,
  );
}

export async function menuOrderStages(token: string, ns: string): Promise<OrderStage[]> {
  const r = await call<{ orderStages: OrderStage[] }>(token, ns, `query OrderStages { orderStages { ${STAGE_FIELDS} } }`);
  return r.orderStages;
}

export async function menuCreateOrderStage(token: string, ns: string, input: { status: string; name: string; color?: string; slaMinutes?: number; isUrgent?: boolean; isOverdue?: boolean }) {
  const r = await call<{ createOrderStage: OrderStage }>(token, ns, `mutation CreateStage($input: CreateOrderStageInput!) { createOrderStage(input: $input) { ${STAGE_FIELDS} } }`, { input });
  return r.createOrderStage;
}

export async function menuUpdateOrderStage(token: string, ns: string, input: { id: string; name: string; color?: string; sortOrder?: number; slaMinutes?: number; isUrgent?: boolean; isOverdue?: boolean }) {
  const r = await call<{ updateOrderStage: OrderStage }>(token, ns, `mutation UpdateStage($input: UpdateOrderStageInput!) { updateOrderStage(input: $input) { ${STAGE_FIELDS} } }`, { input });
  return r.updateOrderStage;
}

export async function menuDeleteOrderStage(token: string, ns: string, id: string) {
  await call(token, ns, `mutation DeleteStage($id: ID!) { deleteOrderStage(id: $id) }`, { id });
}

export async function menuApplyStagePreset(token: string, ns: string, preset: string): Promise<OrderStage[]> {
  const r = await call<{ applyOrderStagePreset: OrderStage[] }>(token, ns, `mutation Preset($preset: String!) { applyOrderStagePreset(preset: $preset) { ${STAGE_FIELDS} } }`, { preset });
  return r.applyOrderStagePreset;
}

export async function menuUpdateOrderPriceStage(token: string, ns: string, orderId: string, stage: 'QUOTED' | 'APPROVED' | 'RESET'): Promise<MenuOrder> {
  const r = await call<{ updateOrderPriceStage: MenuOrder }>(token, ns, `mutation PriceStage($orderId: ID!, $stage: String!) { updateOrderPriceStage(orderId: $orderId, stage: $stage) { ${ORDER_FIELDS} } }`, { orderId, stage });
  return r.updateOrderPriceStage;
}

export async function menuUpdateOrderUrgent(token: string, ns: string, orderId: string, isUrgent: boolean): Promise<MenuOrder> {
  const r = await call<{ updateOrderUrgent: MenuOrder }>(token, ns, `mutation Urgent($orderId: ID!, $isUrgent: Boolean!) { updateOrderUrgent(orderId: $orderId, isUrgent: $isUrgent) { ${ORDER_FIELDS} } }`, { orderId, isUrgent });
  return r.updateOrderUrgent;
}

export async function menuOrderPayments(token: string, ns: string, orderId: string): Promise<OrderPayment[]> {
  const r = await call<{ orderPayments: OrderPayment[] }>(token, ns, `query Payments($orderId: String!) { orderPayments(orderId: $orderId) { ${PAYMENT_FIELDS} } }`, { orderId });
  return r.orderPayments;
}

export async function menuCreateOrderPayment(token: string, ns: string, input: { orderId: string; amount: number; method?: string; kind?: string; comment?: string; idempotencyKey?: string }): Promise<OrderPayment> {
  const r = await call<{ createOrderPayment: OrderPayment }>(token, ns, `mutation Pay($input: CreateOrderPaymentInput!) { createOrderPayment(input: $input) { ${PAYMENT_FIELDS} } }`, { input });
  return r.createOrderPayment;
}

export async function menuDeleteOrderPayment(token: string, ns: string, paymentId: string): Promise<MenuOrder> {
  const r = await call<{ deleteOrderPayment: MenuOrder }>(token, ns, `mutation DelPay($paymentId: ID!) { deleteOrderPayment(paymentId: $paymentId) { ${ORDER_FIELDS} } }`, { paymentId });
  return r.deleteOrderPayment;
}

export async function menuOrderQuickCounts(token: string, ns: string, participantUserId?: string): Promise<OrderQuickCounts> {
  const r = await call<{ orderQuickCounts: OrderQuickCounts }>(token, ns, `query Quick($p: String) { orderQuickCounts(participantUserId: $p) { urgent overdue ready mine } }`, { p: participantUserId });
  return r.orderQuickCounts;
}

export async function menuUpdateOrderRules(token: string, ns: string, rules: Record<string, boolean>): Promise<string> {
  const r = await call<{ updateOrderRules: { orderRules: string } }>(token, ns, `mutation Rules($rules: String!) { updateOrderRules(rules: $rules) { orderRules } }`, { rules: JSON.stringify(rules) });
  return r.updateOrderRules.orderRules;
}
