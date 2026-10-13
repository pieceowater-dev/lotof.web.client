import type { TaskItem } from '@/api/tasks/task/list';

export type StatusInfo = { key: string; label: string; isTerminal: boolean };
export type CourierGroup = { assigneeId: string | null; tasks: TaskItem[] };
export type Counters = { waiting: number; active: number; done: number };

const isTerminal = (statuses: StatusInfo[], key: string) => !!statuses.find((s) => s.key === key)?.isTerminal;

/**
 * Tasks of a day grouped by assignee. Inside a group the dispatcher's manual
 * order from the board comes first; unassigned tasks form the last group.
 */
export function groupByCourier(tasks: TaskItem[], _statuses: StatusInfo[]): CourierGroup[] {
  const byId = new Map<string, TaskItem[]>();
  for (const tk of tasks) {
    const k = tk.assigneeUserId || '';
    if (!byId.has(k)) byId.set(k, []);
    byId.get(k)!.push(tk);
  }
  const groups: CourierGroup[] = [...byId.entries()].map(([id, list]) => ({
    assigneeId: id || null,
    tasks: list.slice().sort((a, b) => a.sortOrder - b.sortOrder),
  }));
  return groups.sort((a, b) => (a.assigneeId === null ? 1 : b.assigneeId === null ? -1 : 0));
}

/**
 * Per courier: waiting for them to take it (a handover pending), in progress,
 * and finished (any terminal status). Keyed by assignee id, '' = unassigned.
 */
export function courierCounters(tasks: TaskItem[], statuses: StatusInfo[]): Record<string, Counters> {
  const out: Record<string, Counters> = {};
  for (const tk of tasks) {
    const k = tk.assigneeUserId || '';
    const c = (out[k] ||= { waiting: 0, active: 0, done: 0 });
    if (isTerminal(statuses, tk.status)) c.done++;
    else if (tk.pendingAssigneeUserId || !tk.assigneeUserId) c.waiting++;
    else c.active++;
  }
  return out;
}

const hhmm = (iso?: string | null) => (iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '');

/** "14:00–16:00", "до 16:00" or an empty string. */
export function timeWindowText(tk: Pick<TaskItem, 'dueFrom' | 'dueAt'>): string {
  const a = hhmm(tk.dueFrom), b = hhmm(tk.dueAt);
  if (a && b) return `${a}–${b}`;
  return b ? `→ ${b}` : a;
}
