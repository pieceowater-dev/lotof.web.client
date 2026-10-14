import { beforeEach, describe, expect, it, vi } from 'vitest';

const uploads: Array<{ name: string; type: string }> = [];
const created: any[] = [];

vi.mock('@/utils/imageCompression', () => ({
  compressImageForUpload: async (f: File) => new File([f], 'small-' + f.name, { type: f.type }),
}));
vi.mock('@/api/menu/media/uploadAttachment', () => ({
  menuUploadOrderAttachment: async (_t: string, _ns: string, f: File) => {
    uploads.push({ name: f.name, type: f.type });
    return { url: `/media/menu/ns/${f.name}`, key: `menu/ns/${f.name}`, contentType: f.type || 'application/octet-stream', size: f.size };
  },
}));
vi.mock('@/api/menu/order/extra', () => ({
  menuOrderNotes: async () => [{ id: 'n0', orderId: 'o1', body: 'old', attachments: [], important: false, pinned: false, createdAt: 'a', updatedAt: 'a', deleted: false }],
  menuCreateOrderNote: async (_t: string, _ns: string, input: any) => {
    created.push(input);
    return { id: 'n' + created.length, orderId: input.orderId, body: input.body, attachments: input.attachments, important: !!input.important, pinned: false, createdAt: 'b', updatedAt: 'b', deleted: false };
  },
}));

import { orderNotesStore, loadOrderNotes, addOrderNote } from '@/composables/useOrderNotes';

const t = (k: string) => k;

describe('shared order notes', () => {
  beforeEach(() => { uploads.length = 0; created.length = 0; });

  it('one list per order, shared by everyone who asks for it', () => {
    expect(orderNotesStore('a')).toBe(orderNotesStore('a'));
    expect(orderNotesStore('a')).not.toBe(orderNotesStore('b'));
  });

  it('loading fills the same list the timeline reads', async () => {
    await loadOrderNotes('tok', 'ns', 'o1');
    expect(orderNotesStore('o1').value.map((n) => n.id)).toEqual(['n0']);
  });

  it('a new comment goes first and carries photos as PHOTO and documents as DOCUMENT', async () => {
    await loadOrderNotes('tok', 'ns', 'o1');
    const photo = new File(['x'], 'shot.png', { type: 'image/png' });
    const doc = new File(['y'], 'act.pdf', { type: 'application/pdf' });
    const note = await addOrderNote('tok', 'ns', 'o1', { body: '  see attached  ', files: [photo, doc], t });
    expect(note.body).toBe('see attached');
    expect(orderNotesStore('o1').value[0].id).toBe(note.id);
    expect(created[0].attachments.map((a: any) => a.kind)).toEqual(['PHOTO', 'DOCUMENT']);
    // photos pass through the compressor, documents are sent as they are
    expect(uploads.map((u) => u.name)).toEqual(['small-shot.png', 'act.pdf']);
  });

  it('a comment without files is just text', async () => {
    const note = await addOrderNote('tok', 'ns', 'o2', { body: 'hi', files: [], t });
    expect(note.attachments).toEqual([]);
    expect(uploads).toHaveLength(0);
  });
});
