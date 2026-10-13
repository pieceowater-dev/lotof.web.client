// Turns the rows of an uploaded sheet (header → value) into goods to create.
// Columns are found by header name in ru/en; nothing has to be mapped by hand.

export type ImportedGood = {
  line: number;
  name: string;
  sku: string;
  category: string;
  unit: string;
  costPriceCents: number;
  salePriceCents: number;
  quantity: number;
  error?: string;
};

const ALIASES: Record<string, string[]> = {
  name: ['название', 'наименование', 'товар', 'name', 'product', 'title'],
  sku: ['артикул', 'sku', 'код', 'code'],
  category: ['категория', 'category', 'группа', 'group'],
  unit: ['единица', 'ед', 'ед.', 'ед. изм.', 'unit', 'uom'],
  cost: ['закупка', 'цена закупки', 'закупочная цена', 'себестоимость', 'cost', 'purchase price'],
  price: ['цена', 'цена продажи', 'продажа', 'price', 'sale price', 'sale'],
  quantity: ['остаток', 'количество', 'кол-во', 'qty', 'quantity', 'stock'],
};

const norm = (s: unknown) => String(s ?? '').trim().toLowerCase();

/** header text → logical field, for the headers present in the sheet. */
export function detectColumns(headers: string[]): Record<string, string> {
  const found: Record<string, string> = {};
  for (const h of headers) {
    const n = norm(h);
    for (const [field, names] of Object.entries(ALIASES)) {
      if (!found[field] && names.includes(n)) found[field] = h;
    }
  }
  return found;
}

/** "1 250,50" / "1250.5" / 12 → cents; blank → 0; unparsable → NaN. */
export function toCents(v: unknown): number {
  if (v === null || v === undefined || String(v).trim() === '') return 0;
  const n = Number(String(v).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : NaN;
}

export function toQuantity(v: unknown): number {
  if (v === null || v === undefined || String(v).trim() === '') return 0;
  const n = Number(String(v).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : NaN;
}

export function parseGoodsSheet(rows: Record<string, unknown>[]): { goods: ImportedGood[]; columns: Record<string, string> } {
  const headers = rows.length ? Object.keys(rows[0]) : [];
  const columns = detectColumns(headers);
  const goods: ImportedGood[] = [];
  rows.forEach((row, i) => {
    const get = (f: string) => (columns[f] ? row[columns[f]] : '');
    const name = String(get('name') ?? '').trim();
    const skuRaw = String(get('sku') ?? '').trim();
    const cost = toCents(get('cost'));
    const price = toCents(get('price'));
    const qty = toQuantity(get('quantity'));
    if (!name && !skuRaw && !String(get('price') ?? '').trim()) return; // an empty line
    const g: ImportedGood = {
      line: i + 2,
      name,
      sku: skuRaw,
      category: String(get('category') ?? '').trim(),
      unit: String(get('unit') ?? '').trim(),
      costPriceCents: Number.isNaN(cost) ? 0 : cost,
      salePriceCents: Number.isNaN(price) ? 0 : price,
      quantity: Number.isNaN(qty) ? 0 : qty,
    };
    if (!name) g.error = 'name';
    else if (Number.isNaN(cost) || Number.isNaN(price) || Number.isNaN(qty)) g.error = 'number';
    goods.push(g);
  });
  // The same SKU twice in one file would create duplicates.
  const seen = new Set<string>();
  for (const g of goods) {
    if (!g.sku || g.error) continue;
    const k = g.sku.toLowerCase();
    if (seen.has(k)) g.error = 'duplicate';
    seen.add(k);
  }
  return { goods, columns };
}

export const TEMPLATE_HEADERS = ['Название', 'Артикул', 'Категория', 'Единица', 'Цена закупки', 'Цена продажи', 'Остаток'];
