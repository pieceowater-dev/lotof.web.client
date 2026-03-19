const BATCH_SIZE = 500;

export interface ImportRow {
  name: string;
  client_type?: 'INDIVIDUAL' | 'LEGAL';
  company?: string;
  phone?: string;
  email?: string;
  whatsapp?: string;
  telegram?: string;
  iin?: string;
  extra_info?: string;
}

export interface ImportRowResult {
  row_index: number;
  name: string;
  success: boolean;
  client_id?: string;
  error?: string;
}

export interface ImportBatchResult {
  total: number;
  imported: number;
  failed: number;
  rows: ImportRowResult[];
}

export interface ImportProgress {
  batchIndex: number;
  totalBatches: number;
  imported: number;
  failed: number;
}

async function importBatch(
  baseUrl: string,
  token: string,
  rows: ImportRow[],
  offset: number,
): Promise<ImportBatchResult> {
  const res = await fetch(`${baseUrl}/import/clients`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ContactsAuthorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ rows }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${text}`);
  }

  const data: ImportBatchResult = await res.json();

  // Shift row_index values to reflect global position
  data.rows = data.rows.map((r) => ({ ...r, row_index: r.row_index + offset }));
  return data;
}

export async function contactsImportClients(
  token: string,
  rows: ImportRow[],
  onProgress?: (p: ImportProgress) => void,
): Promise<ImportBatchResult> {
  const baseUrl = (import.meta.env.VITE_API_CONTACTS as string).replace(/\/$/, '');

  const batches: ImportRow[][] = [];
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    batches.push(rows.slice(i, i + BATCH_SIZE));
  }

  const aggregate: ImportBatchResult = { total: rows.length, imported: 0, failed: 0, rows: [] };

  for (let i = 0; i < batches.length; i++) {
    const offset = i * BATCH_SIZE;
    const batchResult = await importBatch(baseUrl, token, batches[i], offset);

    aggregate.imported += batchResult.imported;
    aggregate.failed += batchResult.failed;
    aggregate.rows.push(...batchResult.rows);

    onProgress?.({
      batchIndex: i + 1,
      totalBatches: batches.length,
      imported: aggregate.imported,
      failed: aggregate.failed,
    });
  }

  return aggregate;
}
