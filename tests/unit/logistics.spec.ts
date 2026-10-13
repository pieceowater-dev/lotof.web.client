import { describe, it, expect } from 'vitest';
import { groupByCourier, courierCounters } from '@/utils/logistics';

const st = [{ key: 'new', label: 'New', isTerminal: false }, { key: 'way', label: 'On the way', isTerminal: false }, { key: 'done', label: 'Done', isTerminal: true }];
const task = (over: any): any => ({ id: Math.random().toString(), sortOrder: 0, status: 'new', ...over });

describe('logistics', () => {
  it('groups by courier in the dispatcher order and puts unassigned last', () => {
    const g = groupByCourier([
      task({ id: 'a2', assigneeUserId: 'u1', sortOrder: 20 }),
      task({ id: 'x', assigneeUserId: null }),
      task({ id: 'a1', assigneeUserId: 'u1', sortOrder: 10 }),
      task({ id: 'b1', assigneeUserId: 'u2' }),
    ], st);
    expect(g.map((x) => x.assigneeId)).toEqual(['u1', 'u2', null]);
    expect(g[0].tasks.map((x) => x.id)).toEqual(['a1', 'a2']);
  });

  it('counts waiting, in progress and finished per courier', () => {
    const c = courierCounters([
      task({ assigneeUserId: 'u1', status: 'way' }),
      task({ assigneeUserId: 'u1', status: 'done' }),
      task({ assigneeUserId: 'u1', status: 'new', pendingAssigneeUserId: 'u1' }),
      task({ assigneeUserId: null, status: 'new' }),
    ], st);
    expect(c.u1).toEqual({ waiting: 1, active: 1, done: 1 });
    expect(c['']).toEqual({ waiting: 1, active: 0, done: 0 });
  });
});
