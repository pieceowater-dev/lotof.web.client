// The backend allocates order.number as a simple per-day sequential counter
// with no prefix of its own (see lotof.menu.msvc.core's allocateOrderNumber).
// Prefixing the display with the creation date turns a bare "#7" — which
// repeats every day — into a number that's actually unique and orderable
// across days, without needing a backend numbering-scheme change.
export function smartOrderNumber(order: { number: number; createdAt: string }): string {
  const d = new Date(order.createdAt);
  const y = String(d.getFullYear()).slice(2);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}-${String(order.number).padStart(3, '0')}`;
}
