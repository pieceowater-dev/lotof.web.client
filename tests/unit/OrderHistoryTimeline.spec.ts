import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

// The component's own logic is under test, not the app plumbing it imports.
vi.mock('@/composables/useI18n', () => ({ useI18n: () => ({ t: (k: string) => k, locale: { value: 'ru' } }) }));
vi.mock('@/utils/imageCompression', () => ({ compressImageForUpload: async (f: File) => f }));
vi.mock('@/api/menu/media/uploadAttachment', () => ({ menuUploadOrderAttachment: async () => ({}) }));
vi.mock('@/api/menu/order/extra', () => ({ menuOrderNotes: async () => [], menuCreateOrderNote: async () => ({}) }));
vi.mock('@/utils/logger', () => ({ logError: () => {} }));
vi.mock('@/utils/types/errors', () => ({ getErrorMessage: () => '' }));
vi.mock('@/utils/mediaUrl', () => ({ absoluteMediaUrl: (u: string) => u }));
import OrderHistoryTimeline from '@/components/menu/OrderHistoryTimeline.vue';
import { orderNotesStore } from '@/composables/useOrderNotes';

const stubs = {
  Icon: { template: '<i />' },
  Teleport: { template: '<div />' },
  UTextarea: { props: ['modelValue'], template: '<textarea :value="modelValue" />' },
};

const history = [
  { id: 'h1', orderId: 'o1', previousStatus: 'NEW', newStatus: 'NEW', createdAt: '2026-10-14T08:00:00Z' },
  { id: 'h2', orderId: 'o1', previousStatus: 'NEW', newStatus: 'ACCEPTED', createdAt: '2026-10-14T10:00:00Z' },
] as any;

const base = {
  history,
  statusLabel: (s: string) => `status:${s}`,
  memberDisplayName: (id: string) => `user:${id}`,
  formatDate: (iso: string) => iso,
};

describe('order timeline', () => {
  it('merges status changes, linked tasks and comments in time order', () => {
    const notes = orderNotesStore('o-merge');
    notes.value = [
      { id: 'n1', orderId: 'o-merge', authorId: 'u1', body: 'called the client', attachments: [], important: false, pinned: false, createdAt: '2026-10-14T09:00:00Z', updatedAt: '', deleted: false },
      { id: 'n2', orderId: 'o-merge', authorId: 'u1', body: 'secret removed note', attachments: [], important: false, pinned: false, createdAt: '2026-10-14T09:30:00Z', updatedAt: '', deleted: true },
    ] as any;
    const tasks = [{ taskId: 't1', title: 'Call back', boardSlug: 'rem', taskNumber: 7, createdAt: '2026-10-14T08:30:00Z', closedAt: '2026-10-14T11:00:00Z' }] as any;
    const w = mount(OrderHistoryTimeline, { props: { ...base, tasks, orderId: 'o-merge', nsSlug: 'ns', getToken: async () => 'tok' }, global: { stubs } });
    const text = w.text();
    const at = (s: string) => text.indexOf(s);
    expect(at('status:NEW')).toBeGreaterThan(-1);
    // 08:00 status, 08:30 task created, 09:00 comment, 10:00 accepted, 11:00 task done
    expect(at('status:NEW')).toBeLessThan(at('REM-7'));
    expect(at('REM-7')).toBeLessThan(at('called the client'));
    expect(at('called the client')).toBeLessThan(at('status:ACCEPTED'));
    expect(at('status:ACCEPTED')).toBeLessThan(text.lastIndexOf('REM-7'));
    expect(text).not.toContain('secret removed note');
  });

  it('shows the comment box only when it knows the order and can talk to the server', () => {
    const withBox = mount(OrderHistoryTimeline, { props: { ...base, orderId: 'o1', nsSlug: 'ns', getToken: async () => 't' }, global: { stubs } });
    expect(withBox.find('textarea').exists()).toBe(true);
    const readOnly = mount(OrderHistoryTimeline, { props: { ...base }, global: { stubs } });
    expect(readOnly.find('textarea').exists()).toBe(false);
  });

  it('an empty order says so instead of rendering an empty list', () => {
    const w = mount(OrderHistoryTimeline, { props: { ...base, history: [] }, global: { stubs } });
    expect(w.find('ol').exists()).toBe(false);
  });
});
