import { ref, type Ref } from 'vue';
import { compressImageForUpload } from '@/utils/imageCompression';
import { menuUploadOrderAttachment } from '@/api/menu/media/uploadAttachment';
import { menuOrderNotes, menuCreateOrderNote, type OrderNote } from '@/api/menu/order/extra';

// One shared list of notes per order: the order card's notes section and the
// timeline rail show (and add to) the same list, so a comment written in one
// place appears in the other at once.
const stores = new Map<string, Ref<OrderNote[]>>();

export function orderNotesStore(orderId: string): Ref<OrderNote[]> {
  let s = stores.get(orderId);
  if (!s) { s = ref<OrderNote[]>([]); stores.set(orderId, s); }
  return s;
}

export async function loadOrderNotes(token: string, ns: string, orderId: string): Promise<void> {
  orderNotesStore(orderId).value = await menuOrderNotes(token, ns, orderId);
}

export type NewNoteInput = { body: string; important?: boolean; files: File[]; t: (k: string, p?: any) => string };

// Uploads the photos (compressed) and creates the note; the new note lands first in the shared list.
export async function addOrderNote(token: string, ns: string, orderId: string, input: NewNoteInput): Promise<OrderNote> {
  const attachments = [];
  for (const f of input.files) {
    const isImage = f.type.startsWith('image/');
    const ready = isImage ? await compressImageForUpload(f, { t: input.t }) : f;
    const up = await menuUploadOrderAttachment(token, ns, ready);
    attachments.push({ url: up.url, name: f.name, mime: up.contentType, sizeBytes: up.size, kind: isImage ? 'PHOTO' : 'DOCUMENT' });
  }
  const n = await menuCreateOrderNote(token, ns, { orderId, body: input.body.trim(), important: !!input.important, attachments });
  orderNotesStore(orderId).value.unshift(n);
  return n;
}
