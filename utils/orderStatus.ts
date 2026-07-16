export const ORDER_STATUSES = ['NEW', 'ACCEPTED', 'IN_PREPARATION', 'READY', 'DELIVERING', 'COMPLETED', 'CANCELLED'] as const;

// Mirrors the backend's validStatusTransitions map exactly (see
// lotof.menu.msvc.core's order.ent.go) — kept in sync by hand since the
// frontend has no generated types for this. Used to only ever offer statuses
// the backend will actually accept, instead of letting the user pick an
// invalid one and bouncing off a FailedPrecondition error.
const ORDER_STATUS_TRANSITIONS: Record<string, string[]> = {
  NEW: ['ACCEPTED', 'CANCELLED'],
  ACCEPTED: ['IN_PREPARATION', 'CANCELLED'],
  IN_PREPARATION: ['READY', 'CANCELLED'],
  READY: ['DELIVERING', 'CANCELLED'],
  DELIVERING: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};
export function nextStatuses(current: string): string[] {
  return ORDER_STATUS_TRANSITIONS[current] || [];
}

// Full literal class strings (not template-interpolated) so Tailwind's JIT
// content scanner can actually find and generate them at build time. Shades
// picked (600/700, not 500) so white badge text clears WCAG AA at small
// sizes — 500-weight amber/emerald/teal read as low-contrast ("Завершён"
// was reported unreadable at emerald-500).
const STATUS_BADGE_STYLE: Record<string, { bg: string; ring: string; icon: string }> = {
  NEW: { bg: 'bg-blue-600', ring: 'ring-blue-200 dark:ring-blue-900', icon: 'lucide:inbox' },
  ACCEPTED: { bg: 'bg-primary-600', ring: 'ring-primary-200 dark:ring-primary-900', icon: 'lucide:check' },
  IN_PREPARATION: { bg: 'bg-amber-700', ring: 'ring-amber-200 dark:ring-amber-900', icon: 'lucide:cooking-pot' },
  READY: { bg: 'bg-teal-700', ring: 'ring-teal-200 dark:ring-teal-900', icon: 'lucide:package-check' },
  DELIVERING: { bg: 'bg-violet-600', ring: 'ring-violet-200 dark:ring-violet-900', icon: 'lucide:truck' },
  COMPLETED: { bg: 'bg-emerald-800', ring: 'ring-emerald-200 dark:ring-emerald-900', icon: 'lucide:check-check' },
  CANCELLED: { bg: 'bg-red-600', ring: 'ring-red-200 dark:ring-red-900', icon: 'lucide:x' },
};
export function statusBadgeStyle(s: string) {
  return STATUS_BADGE_STYLE[s] || { bg: 'bg-gray-400', ring: 'ring-gray-200 dark:ring-gray-800', icon: 'lucide:circle' };
}

const HISTORY_DOT_STYLE: Record<string, { bg: string; dot: string }> = {
  NEW: { bg: 'bg-blue-100 dark:bg-blue-900/40', dot: 'text-blue-500' },
  ACCEPTED: { bg: 'bg-primary-100 dark:bg-primary-900/40', dot: 'text-primary-500' },
  IN_PREPARATION: { bg: 'bg-amber-100 dark:bg-amber-900/40', dot: 'text-amber-500' },
  READY: { bg: 'bg-teal-100 dark:bg-teal-900/40', dot: 'text-teal-500' },
  DELIVERING: { bg: 'bg-violet-100 dark:bg-violet-900/40', dot: 'text-violet-500' },
  COMPLETED: { bg: 'bg-emerald-100 dark:bg-emerald-900/40', dot: 'text-emerald-500' },
  CANCELLED: { bg: 'bg-red-100 dark:bg-red-900/40', dot: 'text-red-500' },
};
export function historyDotStyle(s: string) {
  return HISTORY_DOT_STYLE[s] || { bg: 'bg-gray-100 dark:bg-gray-800', dot: 'text-gray-400' };
}
