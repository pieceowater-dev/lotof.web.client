// Warranty maths for order lines. A line's warrantyDays is snapshotted from
// the catalog when it is ordered; the warranty starts when the order is
// closed as COMPLETED (handed over) and lasts warrantyDays calendar days.

export type WarrantyState = 'none' | 'pending' | 'active' | 'expired';

export type WarrantyInfo = {
  state: WarrantyState;
  // End of the warranty; null until the order is completed.
  endsAt: Date | null;
  // Whole days remaining (>= 0) while active, otherwise 0.
  daysLeft: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function warrantyInfo(
  warrantyDays: number,
  order: { status: string; closedAt?: string | null },
  now: Date = new Date()
): WarrantyInfo {
  if (!warrantyDays || warrantyDays <= 0) return { state: 'none', endsAt: null, daysLeft: 0 };
  if (order.status !== 'COMPLETED' || !order.closedAt) return { state: 'pending', endsAt: null, daysLeft: 0 };
  const closed = new Date(order.closedAt);
  if (Number.isNaN(closed.getTime())) return { state: 'pending', endsAt: null, daysLeft: 0 };
  const endsAt = new Date(closed.getTime() + warrantyDays * DAY_MS);
  if (endsAt.getTime() < now.getTime()) return { state: 'expired', endsAt, daysLeft: 0 };
  return { state: 'active', endsAt, daysLeft: Math.ceil((endsAt.getTime() - now.getTime()) / DAY_MS) };
}
