// Short, GitHub/Linear-issue-style display code for a task: the board
// slug's first 3 letters (uppercased) + the task's sequential number.
export function taskShortCode(boardSlug: string | undefined | null, taskNumber: number | undefined | null): string {
  const prefix = (boardSlug || '').replace(/[^a-z0-9]/gi, '').slice(0, 3).toUpperCase() || 'TSK';
  return `${prefix}-${taskNumber ?? 0}`;
}

// Jira-style priority chevrons: low points down, urgent stacks double up.
export const PRIORITY_ICONS: Record<number, string> = {
  0: 'lucide:chevron-down',
  1: 'lucide:equal',
  2: 'lucide:chevron-up',
  3: 'lucide:chevrons-up',
};

export const PRIORITY_COLORS: Record<number, string> = {
  0: 'text-gray-400',
  1: 'text-blue-500',
  2: 'text-amber-500',
  3: 'text-red-500',
};

export function priorityIcon(p: number): string {
  return PRIORITY_ICONS[p] || PRIORITY_ICONS[0];
}
export function priorityColorClass(p: number): string {
  return PRIORITY_COLORS[p] || PRIORITY_COLORS[0];
}

// Presets only -- kept intentionally small, and intentionally light/pastel
// rather than saturated, since a column's color tints its entire background
// on the board, not just a small badge.
export interface ColumnColorPreset { name: string; value: string; dotClass: string; columnClass: string }
export const COLUMN_COLOR_PRESETS: ColumnColorPreset[] = [
  { name: 'gray', value: '', dotClass: 'bg-gray-300 dark:bg-gray-600', columnClass: 'bg-gray-50 dark:bg-gray-800/40 border-gray-200 dark:border-gray-800' },
  { name: 'blue', value: 'blue', dotClass: 'bg-blue-300 dark:bg-blue-500', columnClass: 'bg-blue-50/70 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900' },
  { name: 'green', value: 'green', dotClass: 'bg-emerald-300 dark:bg-emerald-500', columnClass: 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900' },
  { name: 'red', value: 'red', dotClass: 'bg-red-300 dark:bg-red-500', columnClass: 'bg-red-50/70 dark:bg-red-950/20 border-red-200 dark:border-red-900' },
  { name: 'yellow', value: 'yellow', dotClass: 'bg-amber-300 dark:bg-amber-500', columnClass: 'bg-amber-50/70 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900' },
];
export function columnColorClass(color?: string | null): string {
  return COLUMN_COLOR_PRESETS.find((p) => p.value === (color || ''))?.columnClass || COLUMN_COLOR_PRESETS[0].columnClass;
}

// Light/pastel hex presets for a task type's color dot -- stored as a raw
// hex string (TaskType.color), so these are hex values rather than Tailwind
// classes like the column presets above.
export const TASK_TYPE_COLOR_PRESETS: { name: string; hex: string }[] = [
  { name: 'gray', hex: '#d1d5db' },
  { name: 'blue', hex: '#93c5fd' },
  { name: 'green', hex: '#6ee7b7' },
  { name: 'red', hex: '#fca5a5' },
  { name: 'yellow', hex: '#fcd34d' },
  { name: 'purple', hex: '#c4b5fd' },
];

// How tasks of a given type count toward a sprint's burndown report --
// "" behaves identically to "default" (one per task); kept as a separate
// value from the empty string just for a clearer UI label/selection.
export const ESTIMATION_TYPE_OPTIONS: { value: string; labelKey: string }[] = [
  { value: 'default', labelKey: 'tasks.estimationDefault' },
  { value: 'story_points', labelKey: 'tasks.estimationStoryPoints' },
  { value: 'hours', labelKey: 'tasks.estimationHours' },
  { value: 'none', labelKey: 'tasks.estimationNone' },
];

// "Required" statuses (board settings, per-column checkbox) gate terminal
// transitions: a task can't be moved into ANY terminal status until it has
// passed through every status marked required (Task.visitedStatuses, set
// server-side). Resolved client-side, same convention as isTerminal itself
// -- the server just persists the opaque statuses JSON and the append-only
// visited list, it never interprets either.
export interface RequirableStatus { key: string; label: string; isTerminal: boolean; isRequired?: boolean }
export function blockingRequiredStatuses(
  target: RequirableStatus,
  allStatuses: RequirableStatus[],
  visitedStatuses: string[] | undefined | null,
): RequirableStatus[] {
  if (!target.isTerminal) return [];
  const visited = new Set(visitedStatuses || []);
  return allStatuses.filter((s) => s.isRequired && s.key !== target.key && !visited.has(s.key));
}

// Curated set offered by the issue-type icon picker -- common enough to
// cover most task categories without overwhelming the picker grid. Any
// other lucide icon string still works if typed manually.
export const TASK_TYPE_ICON_CHOICES: string[] = [
  'lucide:clipboard-list', 'lucide:truck', 'lucide:package', 'lucide:wrench',
  'lucide:home', 'lucide:phone', 'lucide:alert-triangle', 'lucide:check-circle-2',
  'lucide:map-pin', 'lucide:users', 'lucide:shopping-cart', 'lucide:file-text',
  'lucide:bug', 'lucide:hammer', 'lucide:receipt', 'lucide:zap',
  'lucide:calendar-clock', 'lucide:message-square', 'lucide:camera', 'lucide:box',
];
