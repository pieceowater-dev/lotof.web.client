import * as XLSX from 'xlsx';

export type StockExportRow = {
  name: string; sku: string; quantity: number; reservedQuantity: number; available: number; costCents: number; valueCents: number;
};
export type StockExportLabels = {
  name: string; sku: string; quantity: string; reserved: string; available: string; cost: string; value: string; sheet: string;
};

// Exports the stock rows currently on screen (after filters) to an .xlsx file.
export function exportStockToXlsx(rows: StockExportRow[], labels: StockExportLabels, fileName = 'stock') {
  const money = (cents: number) => Math.round(cents) / 100;
  const data = rows.map((r) => ({
    [labels.name]: r.name,
    [labels.sku]: r.sku,
    [labels.quantity]: r.quantity,
    [labels.reserved]: r.reservedQuantity,
    [labels.available]: r.available,
    [labels.cost]: money(r.costCents),
    [labels.value]: money(r.valueCents),
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  ws['!cols'] = Object.keys(data[0] || {}).map((k) => ({ wch: Math.max(12, Math.min(40, k.length + 6)) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, labels.sheet.slice(0, 31));
  XLSX.writeFile(wb, `${fileName}-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
