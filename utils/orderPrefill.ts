// Pre-fills the form when staff open it from a completed order to register a
// warranty case: the customer/branch carry over and the new order is linked
// back to the original via warrantyOfOrderId.
export type CreateOrderPrefill = {
  warrantyOfOrderId: string;
  warrantyOrderLabel: string;
  type: 'pickup' | 'delivery' | 'table';
  phone: string;
  customerName?: string | null;
  deliveryAddress?: string | null;
  branchId?: string | null;
  tableNumber?: number | string;
  // The original order's custom field values (JSON): the same device/vehicle
  // comes back, so its details carry over.
  customFields?: string;
};
