import { describe, it, expect } from 'vitest';
import { parseTaskTemplates, templateDueAt } from '@/utils/taskTemplates';

describe('task templates', () => {
  it('reads valid templates and drops nameless or broken ones', () => {
    const list = parseTaskTemplates('[{"id":"1","name":"Callback","due_in_hours":4,"priority":2},{"name":""},5]');
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: '1', name: 'Callback', title: 'Callback', due_in_hours: 4, priority: 2 });
    expect(parseTaskTemplates('nope')).toEqual([]);
    expect(parseTaskTemplates(null)).toEqual([]);
  });

  it('computes the deadline from the hours', () => {
    const now = new Date('2026-10-13T10:00:00Z');
    expect(templateDueAt({ due_in_hours: 4 }, now)).toBe('2026-10-13T14:00:00.000Z');
    expect(templateDueAt({ due_in_hours: 0 }, now)).toBeUndefined();
  });
});
