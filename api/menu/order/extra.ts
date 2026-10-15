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
  autoTaskTitle?: string;
  moveOnPriceStage?: string;
  requiredFieldIds?: string[];
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

export type OrderQuickCounts = { urgent: number; overdue: number; ready: number; mine: number; contactDue: number };

const ORDER_FIELDS = `id number branchId clientId type status phone customerName deliveryAddress deliveryAt comment sourceTag totalAmount createdAt closedAt discountAmount discountType discountValue discountItemId paidAmount customFields warrantyOfOrderId readyAt priceQuotedAt priceQuotedBy priceApprovedAt stageId statusChangedAt isUrgent nextContactAt recommendation internalNotes displayNumber`;
const STAGE_FIELDS = 'id status name color sortOrder slaMinutes isUrgent isOverdue autoTaskTitle moveOnPriceStage requiredFieldIds';
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

export async function menuCreateOrderStage(token: string, ns: string, input: { status: string; name: string; color?: string; slaMinutes?: number; isUrgent?: boolean; isOverdue?: boolean; autoTaskTitle?: string; moveOnPriceStage?: string; requiredFieldIds?: string[] }) {
  const r = await call<{ createOrderStage: OrderStage }>(token, ns, `mutation CreateStage($input: CreateOrderStageInput!) { createOrderStage(input: $input) { ${STAGE_FIELDS} } }`, { input });
  return r.createOrderStage;
}

export async function menuUpdateOrderStage(token: string, ns: string, input: { id: string; name: string; color?: string; sortOrder?: number; slaMinutes?: number; isUrgent?: boolean; isOverdue?: boolean; autoTaskTitle?: string; moveOnPriceStage?: string; requiredFieldIds?: string[] }) {
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

export async function menuDeleteOrderPayment(token: string, ns: string, paymentId: string, orderId?: string): Promise<MenuOrder> {
  const r = await call<{ deleteOrderPayment: MenuOrder }>(token, ns, `mutation DelPay($paymentId: ID!, $orderId: ID) { deleteOrderPayment(paymentId: $paymentId, orderId: $orderId) { ${ORDER_FIELDS} } }`, { paymentId, orderId });
  return r.deleteOrderPayment;
}

export async function menuOrderQuickCounts(token: string, ns: string, participantUserId?: string): Promise<OrderQuickCounts> {
  const r = await call<{ orderQuickCounts: OrderQuickCounts }>(token, ns, `query Quick($p: String) { orderQuickCounts(participantUserId: $p) { urgent overdue ready mine contactDue } }`, { p: participantUserId });
  return r.orderQuickCounts;
}

export async function menuUpdateOrderRules(token: string, ns: string, rules: Record<string, boolean | string | Record<string, string>>): Promise<string> {
  const r = await call<{ updateOrderRules: { orderRules: string } }>(token, ns, `mutation Rules($rules: String!) { updateOrderRules(rules: $rules) { orderRules } }`, { rules: JSON.stringify(rules) });
  return r.updateOrderRules.orderRules;
}

export type OrderAttachment = { url: string; name: string; mime: string; sizeBytes: number; kind: 'PHOTO' | 'DOCUMENT' | string };
export type OrderNote = {
  id: string;
  orderId: string;
  authorId?: string | null;
  body: string;
  important: boolean;
  pinned: boolean;
  attachments: OrderAttachment[];
  createdAt: string;
  updatedAt: string;
  deleted: boolean;
};

const NOTE_FIELDS = 'id orderId authorId body important pinned createdAt updatedAt deleted attachments { url name mime sizeBytes kind }';

export async function menuOrderNotes(token: string, ns: string, orderId: string): Promise<OrderNote[]> {
  const r = await call<{ orderNotes: OrderNote[] }>(token, ns, `query Notes($orderId: String!) { orderNotes(orderId: $orderId) { ${NOTE_FIELDS} } }`, { orderId });
  return r.orderNotes;
}

export async function menuCreateOrderNote(token: string, ns: string, input: { orderId: string; body: string; important?: boolean; pinned?: boolean; attachments?: Array<{ url: string; name?: string; mime?: string; sizeBytes?: number; kind?: string }> }): Promise<OrderNote> {
  const r = await call<{ createOrderNote: OrderNote }>(token, ns, `mutation NoteCreate($orderId: ID!, $body: String!, $important: Boolean, $pinned: Boolean, $attachments: [OrderAttachmentInput!]) { createOrderNote(orderId: $orderId, body: $body, important: $important, pinned: $pinned, attachments: $attachments) { ${NOTE_FIELDS} } }`, input);
  return r.createOrderNote;
}

export async function menuUpdateOrderNote(token: string, ns: string, input: { noteId: string; body: string; important?: boolean; pinned?: boolean }): Promise<OrderNote> {
  const r = await call<{ updateOrderNote: OrderNote }>(token, ns, `mutation NoteUpdate($noteId: ID!, $body: String!, $important: Boolean, $pinned: Boolean) { updateOrderNote(noteId: $noteId, body: $body, important: $important, pinned: $pinned) { ${NOTE_FIELDS} } }`, input);
  return r.updateOrderNote;
}

export async function menuDeleteOrderNote(token: string, ns: string, noteId: string, restore = false): Promise<OrderNote> {
  const r = await call<{ deleteOrderNote: OrderNote }>(token, ns, `mutation NoteDelete($noteId: ID!, $restore: Boolean) { deleteOrderNote(noteId: $noteId, restore: $restore) { ${NOTE_FIELDS} } }`, { noteId, restore });
  return r.deleteOrderNote;
}

export async function menuUpdateOrderExtras(token: string, ns: string, input: { orderId: string; nextContactAt: string | null; recommendation: string; internalNotes: string }): Promise<MenuOrder> {
  const r = await call<{ updateOrderExtras: MenuOrder }>(token, ns, `mutation Extras($orderId: ID!, $nextContactAt: String, $recommendation: String, $internalNotes: String) { updateOrderExtras(orderId: $orderId, nextContactAt: $nextContactAt, recommendation: $recommendation, internalNotes: $internalNotes) { ${ORDER_FIELDS} } }`, input);
  return r.updateOrderExtras;
}

export type ExecutorReportRow = { executorId?: string | null; lines: number; orders: number; revenue: number; pay: number; cashReceived?: number };

export async function menuSetItemFlags(token: string, ns: string, itemId: string, flags: { cashReceived?: number; hideInDocuments?: boolean }) {
  await call(token, ns, `mutation Flags($itemId: ID!, $cashReceived: Float, $hideInDocuments: Boolean) { updateOrderItemFlags(itemId: $itemId, cashReceived: $cashReceived, hideInDocuments: $hideInDocuments) { id cashReceived hideInDocuments } }`, { itemId, ...flags });
}

export async function menuSetItemExecutor(token: string, ns: string, itemId: string, executorId: string | null) {
  await call(token, ns, `mutation Executor($itemId: ID!, $executorId: String) { updateOrderItemExecutor(itemId: $itemId, executorId: $executorId) { id executorId } }`, { itemId, executorId });
}

export async function menuExecutorReport(token: string, ns: string, closedFrom?: string, closedTo?: string, branchIds?: string[]): Promise<ExecutorReportRow[]> {
  const r = await call<{ executorReport: ExecutorReportRow[] }>(token, ns, `query ExecutorReport($closedFrom: String, $closedTo: String, $branchIds: [String!]) { executorReport(closedFrom: $closedFrom, closedTo: $closedTo, branchIds: $branchIds) { executorId lines orders revenue pay cashReceived } }`, { closedFrom, closedTo, branchIds: branchIds?.length ? branchIds : undefined });
  return r.executorReport;
}

export type StatusTimeRow = { status: string; stageId?: string | null; visits: number; avgMinutes: number; maxMinutes: number };
export type FieldValueRow = { value: string; completed: number; cancelled: number; avgCheck: number; revenue: number };
export type OrderEvent = { id: string; orderId: string; number: number; displayNumber: string; previousStatus: string; newStatus: string; stageId?: string | null; userId?: string | null; comment?: string | null; createdAt: string };

export async function menuStatusTimesReport(token: string, ns: string, createdFrom?: string, createdTo?: string, branchIds?: string[]): Promise<StatusTimeRow[]> {
  const r = await call<{ statusTimesReport: StatusTimeRow[] }>(token, ns, `query StatusTimes($createdFrom: String, $createdTo: String, $branchIds: [String!]) { statusTimesReport(createdFrom: $createdFrom, createdTo: $createdTo, branchIds: $branchIds) { status stageId visits avgMinutes maxMinutes } }`, { createdFrom, createdTo, branchIds: branchIds?.length ? branchIds : undefined });
  return r.statusTimesReport;
}

export async function menuFieldValueReport(token: string, ns: string, fieldId: string, closedFrom?: string, closedTo?: string, branchIds?: string[]): Promise<FieldValueRow[]> {
  const r = await call<{ fieldValueReport: FieldValueRow[] }>(token, ns, `query FieldValues($fieldId: String!, $closedFrom: String, $closedTo: String, $branchIds: [String!]) { fieldValueReport(fieldId: $fieldId, closedFrom: $closedFrom, closedTo: $closedTo, branchIds: $branchIds) { value completed cancelled avgCheck revenue } }`, { fieldId, closedFrom, closedTo, branchIds: branchIds?.length ? branchIds : undefined });
  return r.fieldValueReport;
}

export async function menuOrderEvents(token: string, ns: string, p: { userId?: string; from?: string; to?: string; page?: number; branchIds?: string[] }): Promise<{ rows: OrderEvent[]; count: number }> {
  const r = await call<{ orderEvents: { rows: OrderEvent[]; info: { count: number } } }>(token, ns, `query Events($userId: String, $from: String, $to: String, $branchIds: [String!], $filter: DefaultFilterInput) { orderEvents(userId: $userId, from: $from, to: $to, branchIds: $branchIds, filter: $filter) { rows { id orderId number displayNumber previousStatus newStatus stageId userId comment createdAt } info { count } } }`, { userId: p.userId, from: p.from, to: p.to, branchIds: p.branchIds?.length ? p.branchIds : undefined, filter: { pagination: { page: p.page || 1, length: 'FIFTY' } } });
  return { rows: r.orderEvents.rows, count: r.orderEvents.info.count };
}

export type OrderCardDef = { id: string; name: string; filter: string; sortOrder: number };

export async function menuMyOrderCards(token: string, ns: string): Promise<OrderCardDef[]> {
  const r = await call<{ myOrderCards: OrderCardDef[] }>(token, ns, `query MyCards { myOrderCards { id name filter sortOrder } }`);
  return r.myOrderCards;
}

export async function menuCreateOrderCard(token: string, ns: string, name: string, filter: string): Promise<OrderCardDef> {
  const r = await call<{ createOrderCard: OrderCardDef }>(token, ns, `mutation CardCreate($name: String!, $filter: String!) { createOrderCard(name: $name, filter: $filter) { id name filter sortOrder } }`, { name, filter });
  return r.createOrderCard;
}

export async function menuDeleteOrderCard(token: string, ns: string, id: string): Promise<void> {
  await call(token, ns, `mutation CardDelete($id: ID!) { deleteOrderCard(id: $id) }`, { id });
}
