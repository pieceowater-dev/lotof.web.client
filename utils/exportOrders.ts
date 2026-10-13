import * as XLSX from 'xlsx';
import type { MenuOrder } from '@/api/menu/order/list';
import { displayOrderNumber } from '@/utils/orderNumber';

// Exports orders (the selected rows, or the loaded page) to an .xlsx file.
// Headers come from the caller so the file follows the interface language.
export type OrderExportLabels = {
  number: string; status: string; created: string; closed: string; customer: string; phone: string;
  address: string; total: string; discount: string; paid: string; urgent: string; nextContact: string;
  recommendation: string; sheet: string; yes: string;
};

export function exportOrdersToXlsx(
  orders: MenuOrder[],
  labels: OrderExportLabels,
  statusOf: (o: MenuOrder) => string,
  fileName = 'orders',
) {
  const day = (iso?: string | null) => (iso ? new Date(iso).toLocaleString() : '');
  const rows = orders.map((o) => ({
    [labels.number]: displayOrderNumber(o),
    [labels.status]: statusOf(o),
    [labels.created]: day(o.createdAt),
    [labels.closed]: day(o.closedAt),
    [labels.customer]: o.customerName || '',
    [labels.phone]: o.phone || '',
    [labels.address]: o.deliveryAddress || '',
    [labels.total]: o.totalAmount,
    [labels.discount]: o.discountAmount ?? 0,
    [labels.paid]: o.paidAmount ?? 0,
    [labels.urgent]: o.isUrgent ? labels.yes : '',
    [labels.nextContact]: o.nextContactAt ? new Date(o.nextContactAt).toLocaleDateString() : '',
    [labels.recommendation]: o.recommendation || '',
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = Object.keys(rows[0] || {}).map((k) => ({ wch: Math.max(12, Math.min(40, k.length + 4)) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, labels.sheet.slice(0, 31));
  XLSX.writeFile(wb, `${fileName}-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
