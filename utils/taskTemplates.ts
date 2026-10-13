// Quick-create templates stored on an Issues board (JSON on the board itself).

export type TaskTemplate = {
  id: string;
  name: string;
  title: string;
  description: string;
  priority: number;
  due_in_hours: number;
  task_type_id: string;
};

export function parseTaskTemplates(raw?: string | null): TaskTemplate[] {
  try {
    const arr = JSON.parse(raw || '[]');
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((x) => x && typeof x.name === 'string' && x.name.trim())
      .map((x) => ({
        id: String(x.id || ''),
        name: String(x.name),
        title: String(x.title || x.name),
        description: String(x.description || ''),
        priority: Number(x.priority) || 0,
        due_in_hours: Number(x.due_in_hours) || 0,
        task_type_id: String(x.task_type_id || ''),
      }));
  } catch {
    return [];
  }
}

/** The deadline a template gives a task created at `now` (undefined when it sets none). */
export function templateDueAt(tpl: Pick<TaskTemplate, 'due_in_hours'>, now = new Date()): string | undefined {
  return tpl.due_in_hours > 0 ? new Date(now.getTime() + tpl.due_in_hours * 3600_000).toISOString() : undefined;
}
