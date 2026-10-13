import { menuOrderStages, type OrderStage } from '@/api/menu/order/extra';

// The tenant's own order statuses ("stages") inside the fixed lifecycle groups.
// Loaded once per page and shared; a tenant with no stages behaves exactly as
// before: seven groups, each with its own (renameable) label.
export function useOrderStages() {
  const stages = useState<OrderStage[]>('menu-order-stages', () => []);
  const loadedFor = useState<string>('menu-order-stages-ns', () => '');

  async function load(menuToken: string, ns: string, force = false) {
    if (!force && loadedFor.value === ns) return stages.value;
    try {
      stages.value = (await menuOrderStages(menuToken, ns)).slice().sort((a, b) => a.sortOrder - b.sortOrder);
      loadedFor.value = ns;
    } catch {
      stages.value = [];
    }
    return stages.value;
  }

  const byId = (id?: string | null) => (id ? stages.value.find(s => s.id === id) : undefined);
  const ofGroup = (group: string) => stages.value.filter(s => s.status === group);

  return { stages, load, byId, ofGroup };
}

/** Minutes the order has been in its current status/stage, or null when unknown. */
export function minutesInStatus(statusChangedAt?: string | null): number | null {
  if (!statusChangedAt) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(statusChangedAt).getTime()) / 60000));
}

/** True when the order stayed in its stage longer than the stage's limit. */
export function isOverdue(order: { statusChangedAt?: string | null; closedAt?: string | null }, stage?: OrderStage): boolean {
  if (!stage || order.closedAt) return false;
  if (stage.isOverdue) return true;
  const m = minutesInStatus(order.statusChangedAt);
  return stage.slaMinutes > 0 && m !== null && m > stage.slaMinutes;
}

export function formatDuration(minutes: number | null): string {
  if (minutes === null) return '';
  if (minutes < 60) return `${minutes} мин`;
  const h = Math.floor(minutes / 60);
  if (h < 48) return `${h} ч`;
  return `${Math.floor(h / 24)} дн`;
}
