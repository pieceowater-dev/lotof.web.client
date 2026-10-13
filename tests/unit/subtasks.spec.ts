import { describe, it, expect } from 'vitest';
import { subtaskProgress } from '@/utils/subtasks';

describe('subtask progress', () => {
  it('counts terminal statuses as done', () => {
    expect(subtaskProgress([{ status: 'new' }, { status: 'done' }, { status: 'done' }, { status: 'wip' }], ['done'])).toEqual({ done: 2, total: 4, percent: 50 });
  });
  it('handles no subtasks', () => {
    expect(subtaskProgress([], ['done'])).toEqual({ done: 0, total: 0, percent: 0 });
  });
});
