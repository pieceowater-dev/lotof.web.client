import * as XLSX from 'xlsx';
import type { ClientRow } from '@/api/contacts/listClients';

export type ClientExportLabels = {
  type: string; name: string; phones: string; emails: string; tags: string; status: string; created: string; notes: string;
  individual: string; legal: string; sheet: string;
};

const nameOf = (r: ClientRow) =>
  r.client.clientType === 'LEGAL'
    ? (r.legalEntity?.legalName || r.legalEntity?.brandName || '')
    : [r.individual?.lastName, r.individual?.firstName, r.individual?.middleName].filter(Boolean).join(' ');

// Exports the given clients (the loaded page) to an .xlsx file.
export function exportClientsToXlsx(rows: ClientRow[], labels: ClientExportLabels, fileName = 'clients') {
  const values = (r: ClientRow, kind: string) => (r.contacts || []).filter((c) => c.type === kind).map((c) => c.value).join(', ');
  const data = rows.map((r) => ({
    [labels.type]: r.client.clientType === 'LEGAL' ? labels.legal : labels.individual,
    [labels.name]: nameOf(r),
    [labels.phones]: values(r, 'PHONE'),
    [labels.emails]: values(r, 'EMAIL'),
    [labels.tags]: (r.tags || []).map((t) => t.name).join(', '),
    [labels.status]: r.client.status,
    [labels.created]: r.client.createdAt ? new Date(r.client.createdAt).toLocaleDateString() : '',
    [labels.notes]: r.additionalInfo || '',
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  ws['!cols'] = Object.keys(data[0] || {}).map((k) => ({ wch: Math.max(14, Math.min(40, k.length + 6)) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, labels.sheet.slice(0, 31));
  XLSX.writeFile(wb, `${fileName}-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
