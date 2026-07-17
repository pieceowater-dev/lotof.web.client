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
// DELIVERING only means something for a delivery order — a pickup order has
// no courier leg, so READY may skip straight to COMPLETED for pickup
// instead of being forced through a status that doesn't apply to it.
// Mirrors the same exception in the backend's CanTransitionTo.
export function nextStatuses(current: string, orderType?: string): string[] {
  const base = ORDER_STATUS_TRANSITIONS[current] || [];
  if (current === 'READY' && orderType === 'pickup' && !base.includes('COMPLETED')) {
    return [...base, 'COMPLETED'];
  }
  return base;
}

// Real hex values applied via inline :style, not Tailwind utility classes —
// this badge's background previously used dynamically-composed class
// strings (e.g. "bg-emerald-800") which is exactly the pattern that bit the
// iOS-zoom-prevention CSS earlier (a class-based rule silently losing to
// something else / not applying as expected). Hex + inline style has no
// specificity or content-scanning failure mode, so it's guaranteed to render
// regardless of how the consuming component composes classes around it.
// Colors are also each visually distinct (ACCEPTED no longer reuses the same
// blue as NEW) and all clear WCAG AA contrast with white text.
const STATUS_BADGE_STYLE: Record<string, { bg: string; ring: string; icon: string }> = {
  NEW: { bg: '#2563eb', ring: '#bfdbfe', icon: 'lucide:inbox' },
  ACCEPTED: { bg: '#0891b2', ring: '#a5f3fc', icon: 'lucide:check' },
  IN_PREPARATION: { bg: '#b45309', ring: '#fde68a', icon: 'lucide:hourglass' },
  READY: { bg: '#0f766e', ring: '#99f6e4', icon: 'lucide:package-check' },
  DELIVERING: { bg: '#7c3aed', ring: '#ddd6fe', icon: 'lucide:truck' },
  COMPLETED: { bg: '#047857', ring: '#a7f3d0', icon: 'lucide:check-check' },
  CANCELLED: { bg: '#dc2626', ring: '#fecaca', icon: 'lucide:x' },
};
export function statusBadgeStyle(s: string) {
  return STATUS_BADGE_STYLE[s] || { bg: '#9ca3af', ring: '#e5e7eb', icon: 'lucide:circle' };
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
