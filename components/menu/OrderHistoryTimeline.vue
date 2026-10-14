<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { historyDotStyle } from '@/utils/orderStatus';
import type { MenuOrderHistoryEntry } from '@/api/menu/order/history';
import type { MenuOrderTask } from '@/api/menu/order/tasks';
import type { OrderNote } from '@/api/menu/order/extra';
import { orderNotesStore, addOrderNote } from '@/composables/useOrderNotes';
import { absoluteMediaUrl } from '@/utils/mediaUrl';
import { maskProfanity } from '@/utils/profanityFilter';
import { logError } from '@/utils/logger';
import { getErrorMessage } from '@/utils/types/errors';

const { t } = useI18n();

// The server writes service events (price stage, urgency, payments, stage moves)
// as short markers in the history comment; show them as readable sentences.
function friendly(comment: string): string {
  const c = comment.trim();
  const map: Record<string, string> = {
    '[price] quoted': 'menu.histPriceQuoted',
    '[price] approved': 'menu.histPriceApproved',
    '[price] reset': 'menu.histPriceReset',
    '[price] reset (order changed)': 'menu.histPriceAutoReset',
    '[urgent] on': 'menu.histUrgentOn',
    '[urgent] off': 'menu.histUrgentOff',
  };
  if (map[c]) return t(map[c]);
  const pay = c.match(/^\[(payment|refund|payment removed)\] ([\d.]+) (\w+)$/);
  if (pay) {
    const key = pay[1] === 'payment' ? 'menu.histPayment' : pay[1] === 'refund' ? 'menu.histRefund' : 'menu.histPaymentRemoved';
    return `${t(key)}: ${pay[2]} · ${t('menu.pay' + pay[3].charAt(0) + pay[3].slice(1).toLowerCase())}`;
  }
  if (c.startsWith('Stage: ')) return c.slice(7);
  return maskProfanity(c);
}

const props = defineProps<{
  history: MenuOrderHistoryEntry[];
  // Linked Issues tasks: their creation and completion show up in the same timeline.
  tasks?: MenuOrderTask[];
  // With an order id the timeline also carries the order's comments and lets staff add one (text, photos, documents).
  orderId?: string;
  nsSlug?: string;
  getToken?: () => Promise<string>;
  statusLabel: (s: string) => string;
  memberDisplayName: (userId: string) => string;
  formatDate: (iso: string) => string;
}>();

type Row =
  | { kind: 'status'; at: string; id: string; h: MenuOrderHistoryEntry }
  | { kind: 'note'; at: string; id: string; n: OrderNote }
  | { kind: 'task'; at: string; id: string; text: string; done: boolean };
const rows = computed<Row[]>(() => {
  const out: Row[] = props.history.map((h) => ({ kind: 'status', at: h.createdAt, id: h.id, h }));
  for (const tk of props.tasks || []) {
    const code = `${tk.boardSlug ? tk.boardSlug.toUpperCase() + '-' : '#'}${tk.taskNumber}`;
    if (tk.createdAt) out.push({ kind: 'task', at: tk.createdAt, id: `${tk.taskId}-c`, text: `${t('menu.histTaskCreated')}: ${code} ${tk.title}`, done: false });
    if (tk.closedAt) out.push({ kind: 'task', at: tk.closedAt, id: `${tk.taskId}-d`, text: `${t('menu.histTaskDone')}: ${code} ${tk.title}`, done: true });
  }
  if (props.orderId) {
    for (const n of notes.value.filter((x) => !x.deleted)) out.push({ kind: 'note', at: n.createdAt, id: `note-${n.id}`, n });
  }
  return out.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
});

// --- comments ---
const notes = computed(() => (props.orderId ? orderNotesStore(props.orderId).value : []));
const body = ref('');
const files = ref<File[]>([]);
const sending = ref(false);
const MAX_FILES = 10;
const canSend = computed(() => !sending.value && (body.value.trim().length > 0 || files.value.length > 0));
function addFiles(list: FileList | File[] | null) {
  for (const f of Array.from(list || [])) if (files.value.length < MAX_FILES) files.value.push(f);
}
function onPaste(e: ClipboardEvent) {
  const pasted = Array.from(e.clipboardData?.files || []);
  if (pasted.length) { e.preventDefault(); addFiles(pasted); }
}
const previewUrl = (f: File) => (f.type.startsWith('image/') ? URL.createObjectURL(f) : '');
const sizeText = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
async function sendNote() {
  if (!canSend.value || !props.orderId || !props.nsSlug || !props.getToken) return;
  sending.value = true;
  try {
    await addOrderNote(await props.getToken(), props.nsSlug, props.orderId, { body: body.value, files: files.value, t });
    body.value = '';
    files.value = [];
  } catch (e) {
    logError('[OrderHistoryTimeline] add note failed', e);
    useToast().add({ title: getErrorMessage(e, t) || t('common.error'), color: 'red' });
  } finally {
    sending.value = false;
  }
}
const lightbox = ref<string | null>(null);
</script>

<template>
  <div>
    <!-- composer: a comment with photos / documents goes straight into the timeline -->
    <div v-if="orderId && getToken" class="mb-4 space-y-2 rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900" @dragover.prevent @drop.prevent="addFiles($event.dataTransfer?.files || null)">
      <UTextarea v-model="body" :rows="2" autoresize :placeholder="t('menu.timelineCommentPlaceholder')" @paste="onPaste" @keydown.ctrl.enter="sendNote" @keydown.meta.enter="sendNote" />
      <div v-if="files.length" class="flex flex-wrap gap-2">
        <div v-for="(f, i) in files" :key="f.name + i" class="relative">
          <img v-if="f.type.startsWith('image/')" :src="previewUrl(f)" alt="" class="h-14 w-14 rounded-xl object-cover ring-1 ring-black/5">
          <div v-else class="flex h-14 max-w-[9rem] items-center gap-1.5 rounded-xl bg-gray-100 px-2.5 text-xs dark:bg-gray-800"><Icon name="lucide:file-text" class="h-4 w-4 flex-shrink-0" /><span class="truncate">{{ f.name }}</span></div>
          <button type="button" class="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-slate-900/80 text-white" :aria-label="t('common.delete')" @click="files.splice(i, 1)"><Icon name="lucide:x" class="h-3 w-3" /></button>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <label class="at-btn cursor-pointer !px-3 !py-1.5" :title="t('menu.timelineAttach')">
          <Icon name="lucide:paperclip" class="h-4 w-4" /><span class="hidden sm:inline">{{ t('menu.timelineAttach') }}</span>
          <input type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv" class="hidden" @change="(e) => { addFiles((e.target as HTMLInputElement).files); (e.target as HTMLInputElement).value = ''; }">
        </label>
        <div class="flex-1" />
        <button type="button" class="at-btn at-btn--primary !px-3 !py-1.5" :disabled="!canSend" @click="sendNote">
          <Icon :name="sending ? 'lucide:loader-2' : 'lucide:send'" class="h-4 w-4" :class="{ 'animate-spin': sending }" />{{ t('menu.noteSend') }}
        </button>
      </div>
    </div>

    <div v-if="!rows.length" class="text-sm text-gray-400">{{ t('menu.noHistory') || 'No history yet' }}</div>
    <ol v-else class="relative">
      <li v-for="(r, idx) in rows" :key="r.id" class="relative pl-8" :class="idx !== rows.length - 1 ? 'pb-6' : ''">
        <span v-if="idx !== rows.length - 1" class="absolute left-[11px] top-6 bottom-0 w-px bg-gray-200 dark:bg-gray-800" />
        <template v-if="r.kind === 'status'">
          <span class="absolute left-0 top-0 flex h-6 w-6 items-center justify-center rounded-full flex-shrink-0" :class="historyDotStyle(r.h.newStatus).bg">
            <Icon name="lucide:circle" class="w-2 h-2" :class="historyDotStyle(r.h.newStatus).dot" />
          </span>
          <div class="min-w-0">
            <div class="text-sm font-medium">{{ statusLabel(r.h.newStatus) }}</div>
            <div class="text-xs text-gray-400">{{ formatDate(r.h.createdAt) }}</div>
            <div v-if="r.h.userId" class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ memberDisplayName(r.h.userId) }}</div>
            <div v-if="r.h.comment" class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ friendly(r.h.comment) }}</div>
          </div>
        </template>
        <template v-else-if="r.kind === 'note'">
          <span class="absolute left-0 top-0 flex h-6 w-6 items-center justify-center rounded-full flex-shrink-0 bg-primary-50 dark:bg-primary-950/40">
            <Icon name="lucide:message-square" class="w-3.5 h-3.5 text-primary-600 dark:text-primary-300" />
          </span>
          <div class="min-w-0 space-y-1">
            <div class="text-xs text-gray-400">{{ formatDate(r.n.createdAt) }}<span v-if="r.n.authorId"> · {{ memberDisplayName(r.n.authorId) }}</span></div>
            <p v-if="r.n.body" class="whitespace-pre-wrap break-words text-sm text-gray-800 dark:text-gray-100">{{ maskProfanity(r.n.body) }}</p>
            <div v-if="r.n.attachments.length" class="flex flex-wrap gap-2">
              <template v-for="a in r.n.attachments" :key="a.url">
                <button v-if="a.kind === 'PHOTO'" type="button" @click="lightbox = absoluteMediaUrl(a.url)"><img :src="absoluteMediaUrl(a.url)" :alt="a.name" loading="lazy" class="h-20 w-20 rounded-xl object-cover ring-1 ring-black/5"></button>
                <a v-else :href="absoluteMediaUrl(a.url)" target="_blank" rel="noopener" download class="flex max-w-[14rem] items-center gap-2 rounded-xl bg-gray-100 px-3 py-2 text-xs hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700">
                  <Icon name="lucide:file-text" class="h-4 w-4 flex-shrink-0" /><span class="min-w-0"><span class="block truncate font-medium">{{ a.name }}</span><span class="text-gray-400">{{ sizeText(a.sizeBytes) }}</span></span>
                </a>
              </template>
            </div>
          </div>
        </template>
        <template v-else>
          <span class="absolute left-0 top-0 flex h-6 w-6 items-center justify-center rounded-full flex-shrink-0 bg-gray-100 dark:bg-gray-800">
            <Icon :name="r.done ? 'lucide:check' : 'lucide:list-todo'" class="w-3.5 h-3.5 text-gray-500" />
          </span>
          <div class="min-w-0">
            <div class="text-sm font-medium">{{ r.text }}</div>
            <div class="text-xs text-gray-400">{{ formatDate(r.at) }}</div>
          </div>
        </template>
      </li>
    </ol>
    <Teleport to="body">
      <div v-if="lightbox" class="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" @click="lightbox = null">
        <img :src="lightbox" alt="" class="max-h-full max-w-full rounded-2xl object-contain">
      </div>
    </Teleport>
  </div>
</template>
