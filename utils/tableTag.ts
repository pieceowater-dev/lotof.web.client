// Table QR ordering has no dedicated backend field for "which table" — it
// rides in the existing free-text Order.sourceTag / ShareLink.sourceTag as
// "table:007" (always zero-padded to 3 digits), the same field ShareLink
// already uses for marketing attribution. Keeping the convention in one
// place here means the storefront (building it), the admin QR generator
// (building it), and the order/board views (parsing it) never drift.
const TABLE_TAG_PREFIX = 'table:';

export function formatTableNumber(n: number | string): string {
  const num = typeof n === 'string' ? parseInt(n, 10) : n;
  if (!Number.isFinite(num) || num < 0) return '000';
  return String(Math.trunc(num)).padStart(3, '0').slice(-3);
}

export function buildTableTag(n: number | string): string {
  return `${TABLE_TAG_PREFIX}${formatTableNumber(n)}`;
}

// Returns the zero-padded table number ("007") if sourceTag follows the
// "table:NNN" convention, otherwise null.
export function parseTableTag(sourceTag?: string | null): string | null {
  if (!sourceTag || !sourceTag.startsWith(TABLE_TAG_PREFIX)) return null;
  const rest = sourceTag.slice(TABLE_TAG_PREFIX.length).trim();
  return rest || null;
}
