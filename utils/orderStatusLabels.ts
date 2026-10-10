// Order statuses are a fixed lifecycle (see utils/orderStatus.ts), but a
// business may call the stages whatever suits it ("In repair" instead of "In
// progress"). The custom names live on the brand settings as one JSON object
// {"<STATUS>": "<name>"}; a missing key means "use the default, localized
// name". These helpers are the single place that turns a status key into the
// text people see.

export const ORDER_STATUS_KEYS = ['NEW', 'ACCEPTED', 'IN_PREPARATION', 'READY', 'DELIVERING', 'COMPLETED', 'CANCELLED'] as const;
export type OrderStatusKey = (typeof ORDER_STATUS_KEYS)[number];
export type StatusLabels = Partial<Record<OrderStatusKey, string>>;

export const MAX_STATUS_LABEL_LENGTH = 40;

// Locale key + English fallback of each status's default name.
const DEFAULTS: Record<OrderStatusKey, { key: string; fallback: string }> = {
  NEW: { key: 'menu.statusNew', fallback: 'New' },
  ACCEPTED: { key: 'menu.statusAccepted', fallback: 'Accepted' },
  IN_PREPARATION: { key: 'menu.statusInPreparation', fallback: 'In progress' },
  READY: { key: 'menu.statusReady', fallback: 'Ready' },
  DELIVERING: { key: 'menu.statusDelivering', fallback: 'On the way' },
  COMPLETED: { key: 'menu.statusCompleted', fallback: 'Handed over' },
  CANCELLED: { key: 'menu.statusCancelled', fallback: 'Cancelled' },
};

export function isOrderStatusKey(s: string): s is OrderStatusKey {
  return (ORDER_STATUS_KEYS as readonly string[]).includes(s);
}

// Tolerant parse: anything that isn't a JSON object of known statuses with
// non-empty text is ignored rather than failing the page.
export function parseStatusLabels(json: string | null | undefined): StatusLabels {
  if (!json) return {};
  try {
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: StatusLabels = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (isOrderStatusKey(k) && typeof v === 'string' && v.trim() !== '') out[k] = v.trim();
    }
    return out;
  } catch {
    return {};
  }
}

// Canonical JSON to store: known statuses only, trimmed, blanks dropped (a
// cleared field means "back to the default").
export function serializeStatusLabels(labels: Record<string, string | undefined>): string {
  const clean: StatusLabels = {};
  for (const key of ORDER_STATUS_KEYS) {
    const v = (labels[key] ?? '').trim().slice(0, MAX_STATUS_LABEL_LENGTH);
    if (v) clean[key] = v;
  }
  return JSON.stringify(clean);
}

export function defaultStatusLabel(status: string, t: (key: string) => string): string {
  if (!isOrderStatusKey(status)) return status;
  const d = DEFAULTS[status];
  return t(d.key) || d.fallback;
}

// The name to show for a status: the business's own, else the default.
export function statusLabelFor(status: string, custom: StatusLabels | undefined, t: (key: string) => string): string {
  if (isOrderStatusKey(status) && custom?.[status]) return custom[status] as string;
  return defaultStatusLabel(status, t);
}
