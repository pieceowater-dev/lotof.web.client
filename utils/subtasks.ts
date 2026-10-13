import type { TaskItem } from '@/api/tasks/task/list';

export type SubtaskProgress = { done: number; total: number; percent: number };

/** "2 of 5": a subtask counts as done when it is in a terminal status of the board. */
export function subtaskProgress(subtasks: Pick<TaskItem, 'status'>[], terminalKeys: string[]): SubtaskProgress {
  const total = subtasks.length;
  const done = subtasks.filter((s) => terminalKeys.includes(s.status)).length;
  return { done, total, percent: total ? Math.round((done / total) * 100) : 0 };
}
