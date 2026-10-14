<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { logError } from '@/utils/logger';
import { getErrorMessage } from '@/utils/types/errors';
import { compressImageForUpload } from '@/utils/imageCompression';
import { absoluteMediaUrl } from '@/utils/mediaUrl';
import { menuUploadImage } from '@/api/menu/media/upload';
import { orderNotesStore, loadOrderNotes } from '@/composables/useOrderNotes';
import {
  menuOrderNotes, menuCreateOrderNote, menuUpdateOrderNote, menuDeleteOrderNote, type OrderNote,
} from '@/api/menu/order/extra';

// Free-form notes with photos in the order card. Pinned and important notes
// float to the top; deleting is soft and can be undone.
const props = defineProps<{
  orderId: string;
  nsSlug: string;
  getToken: () => Promise<string>;
  formatDate: (iso: string) => string;
  memberDisplayName: (userId: string) => string;
}>();

const { t } = useI18n();
const toast = useToast();

const notes = computed(() => orderNotesStore(props.orderId).value);
const body = ref('');
const important = ref(false);
const files = ref<File[]>([]);
const previews = ref<string[]>([]);
const busy = ref(false);
const editingId = ref<string | null>(null);
const editBody = ref('');
const lightbox = ref<string | null>(null);
const MAX_FILES = 10;

// Quick phrases: tap to drop a typical comment into the composer. Kept per
// browser; the first ones ship as starters and the list is editable.
const TEMPLATES_KEY = 'menu:noteTemplates';
const starter = () => [t('menu.noteTpl1'), t('menu.noteTpl2'), t('menu.noteTpl3')];
const templates = ref<string[]>([]);
function loadTemplates() {
  try {
    const raw = localStorage.getItem(TEMPLATES_KEY);
    templates.value = raw ? JSON.parse(raw) : starter();
  } catch { templates.value = starter(); }
}
function persistTemplates() {
  try { localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates.value)); } catch { /* storage unavailable */ }
}
function useTemplate(tpl: string) { body.value = body.value ? `${body.value}\n${tpl}` : tpl; }
function saveAsTemplate() {
  const v = body.value.trim();
  if (!v || templates.value.includes(v) || templates.value.length >= 12) return;
  templates.value = [...templates.value, v.slice(0, 160)];
  persistTemplates();
}
function dropTemplate(i: number) { templates.value = templates.value.filter((_, j) => j !== i); persistTemplates(); }
onMounted(loadTemplates);

const visible = computed(() => notes.value.slice().sort((a, b) => {
  const w = (n: OrderNote) => (n.deleted ? -2 : 0) + (n.pinned ? 2 : 0) + (n.important ? 1 : 0);
  return w(b) - w(a) || b.createdAt.localeCompare(a.createdAt);
}));

async function load() {
  try {
    await loadOrderNotes(await props.getToken(), props.nsSlug, props.orderId);
  } catch (e) {
    logError('[OrderNotes] load failed', e);
  }
}
onMounted(load);
watch(() => props.orderId, load);

function fail(e: unknown) {
  logError('[OrderNotes] action failed', e);
  toast.add({ title: getErrorMessage(e, t) || t('common.error'), color: 'red' });
}

function addFiles(list: FileList | File[] | null) {
  for (const f of Array.from(list || [])) {
    if (!f.type.startsWith('image/') || files.value.length >= MAX_FILES) continue;
    files.value.push(f);
    previews.value.push(URL.createObjectURL(f));
  }
}
function removeFile(i: number) {
  URL.revokeObjectURL(previews.value[i]);
  files.value.splice(i, 1);
  previews.value.splice(i, 1);
}
function onPaste(e: ClipboardEvent) {
  const imgs = Array.from(e.clipboardData?.files || []).filter((f) => f.type.startsWith('image/'));
  if (imgs.length) { e.preventDefault(); addFiles(imgs); }
}
function onDrop(e: DragEvent) { addFiles(e.dataTransfer?.files || null); }

const canSend = computed(() => !busy.value && (body.value.trim().length > 0 || files.value.length > 0));

async function send() {
  if (!canSend.value) return;
  busy.value = true;
  try {
    const token = await props.getToken();
    const attachments = [];
    for (const f of files.value) {
      const small = await compressImageForUpload(f, { t });
      const up = await menuUploadImage(token, props.nsSlug, small);
      attachments.push({ url: up.url, name: f.name, mime: up.contentType, sizeBytes: up.size, kind: 'PHOTO' });
    }
    const n = await menuCreateOrderNote(token, props.nsSlug, {
      orderId: props.orderId, body: body.value.trim(), important: important.value, attachments,
    });
    notes.value.unshift(n);
    body.value = ''; important.value = false;
    previews.value.forEach((u) => URL.revokeObjectURL(u));
    files.value = []; previews.value = [];
  } catch (e) { fail(e); } finally { busy.value = false; }
}

function replace(n: OrderNote) {
  const i = notes.value.findIndex((x) => x.id === n.id);
  if (i >= 0) notes.value[i] = n;
}

async function togglePin(n: OrderNote) {
  try { replace(await menuUpdateOrderNote(await props.getToken(), props.nsSlug, { noteId: n.id, body: n.body, important: n.important, pinned: !n.pinned })); } catch (e) { fail(e); }
}
async function toggleImportant(n: OrderNote) {
  try { replace(await menuUpdateOrderNote(await props.getToken(), props.nsSlug, { noteId: n.id, body: n.body, important: !n.important, pinned: n.pinned })); } catch (e) { fail(e); }
}
function startEdit(n: OrderNote) { editingId.value = n.id; editBody.value = n.body; }
async function saveEdit(n: OrderNote) {
  try {
    replace(await menuUpdateOrderNote(await props.getToken(), props.nsSlug, { noteId: n.id, body: editBody.value, important: n.important, pinned: n.pinned }));
    editingId.value = null;
  } catch (e) { fail(e); }
}
async function remove(n: OrderNote, restore = false) {
  try { replace(await menuDeleteOrderNote(await props.getToken(), props.nsSlug, n.id, restore)); } catch (e) { fail(e); }
}
</script>

<template>
  <div class="at-panel !p-4 space-y-3" @dragover.prevent @drop.prevent="onDrop">
    <div class="at-h2">{{ t('menu.notesTitle') }}</div>

    <!-- composer -->
    <div class="space-y-2">
      <UTextarea v-model="body" :rows="2" autoresize :placeholder="t('menu.notePlaceholder')" @paste="onPaste" />
      <div class="flex flex-wrap gap-1.5">
        <span v-for="(tpl, i) in templates" :key="tpl" class="pill-filter !pr-1.5 group cursor-pointer" @click="useTemplate(tpl)">
          {{ tpl }}
          <button type="button" class="ml-1 opacity-50 hover:opacity-100" :aria-label="t('common.delete')" @click.stop="dropTemplate(i)"><Icon name="lucide:x" class="w-3 h-3" /></button>
        </span>
        <button v-if="body.trim() && !templates.includes(body.trim())" type="button" class="pill-outline" @click="saveAsTemplate"><Icon name="lucide:bookmark-plus" class="w-3.5 h-3.5" />{{ t('menu.noteSaveTemplate') }}</button>
      </div>
      <div v-if="previews.length" class="flex gap-2 flex-wrap">
        <div v-for="(p, i) in previews" :key="p" class="relative">
          <img :src="p" alt="" class="h-16 w-16 rounded-xl object-cover ring-1 ring-black/5">
          <button type="button" class="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-slate-900/80 text-white" :aria-label="t('common.delete')" @click="removeFile(i)">
            <Icon name="lucide:x" class="w-3 h-3" />
          </button>
        </div>
      </div>
      <div class="flex items-center gap-2 flex-wrap">
        <label class="at-btn !px-3 !py-1.5 cursor-pointer">
          <Icon name="lucide:image-plus" class="w-4 h-4" />{{ t('menu.noteAddPhoto') }}
          <input type="file" accept="image/*" multiple class="hidden" @change="(e) => { addFiles((e.target as HTMLInputElement).files); (e.target as HTMLInputElement).value = ''; }">
        </label>
        <button type="button" class="pill-filter" :class="important ? 'pill-filter--rose' : ''" @click="important = !important">
          <Icon name="lucide:alert-circle" class="w-3.5 h-3.5" />{{ t('menu.noteImportant') }}
        </button>
        <div class="flex-1" />
        <button type="button" class="at-btn at-btn--primary" :disabled="!canSend" @click="send">
          <Icon :name="busy ? 'lucide:loader-2' : 'lucide:send'" class="w-4 h-4" :class="{ 'animate-spin': busy }" />{{ t('menu.noteSend') }}
        </button>
      </div>
    </div>

    <p v-if="!visible.length" class="text-sm text-slate-500">{{ t('menu.notesEmpty') }}</p>

    <div v-for="n in visible" :key="n.id" class="at-row !items-start space-y-1.5" :class="n.deleted ? 'opacity-60' : ''">
      <div class="flex items-center gap-1.5 flex-wrap text-xs text-slate-500 dark:text-slate-400">
        <span class="font-semibold text-slate-700 dark:text-slate-200">{{ n.authorId ? memberDisplayName(n.authorId) : t('menu.noteSystem') }}</span>
        <span>{{ formatDate(n.createdAt) }}</span>
        <span v-if="n.updatedAt !== n.createdAt && !n.deleted" class="italic">· {{ t('menu.noteEdited') }}</span>
        <span v-if="n.pinned" class="at-chip !text-[11px]"><Icon name="lucide:pin" class="w-3 h-3" />{{ t('menu.notePinned') }}</span>
        <span v-if="n.important" class="at-chip !text-[11px] !bg-rose-500/10 !text-rose-600"><Icon name="lucide:alert-circle" class="w-3 h-3" />{{ t('menu.noteImportant') }}</span>
        <span class="flex-1" />
        <template v-if="!n.deleted">
          <button type="button" class="cp-icon" :title="t('menu.notePin')" @click="togglePin(n)"><Icon name="lucide:pin" class="w-4 h-4" /></button>
          <button type="button" class="cp-icon" :title="t('menu.noteImportant')" @click="toggleImportant(n)"><Icon name="lucide:alert-circle" class="w-4 h-4" /></button>
          <button type="button" class="cp-icon" :title="t('common.edit')" @click="startEdit(n)"><Icon name="lucide:pencil" class="w-4 h-4" /></button>
          <button type="button" class="cp-icon" :title="t('common.delete')" @click="remove(n)"><Icon name="lucide:trash-2" class="w-4 h-4" /></button>
        </template>
        <button v-else type="button" class="at-btn !px-3 !py-1" @click="remove(n, true)"><Icon name="lucide:undo-2" class="w-4 h-4" />{{ t('menu.noteRestore') }}</button>
      </div>

      <template v-if="n.deleted"><p class="text-sm italic text-slate-500">{{ t('menu.noteDeleted') }}</p></template>
      <template v-else>
        <div v-if="editingId === n.id" class="space-y-2">
          <UTextarea v-model="editBody" :rows="2" autoresize />
          <div class="flex gap-2">
            <button type="button" class="at-btn at-btn--primary !px-3 !py-1.5" @click="saveEdit(n)">{{ t('common.save') }}</button>
            <button type="button" class="at-btn !px-3 !py-1.5" @click="editingId = null">{{ t('common.cancel') }}</button>
          </div>
        </div>
        <p v-else-if="n.body" class="text-sm whitespace-pre-wrap break-words text-slate-800 dark:text-slate-100">{{ n.body }}</p>
        <div v-if="n.attachments.length" class="flex gap-2 flex-wrap">
          <template v-for="a in n.attachments" :key="a.url">
            <button v-if="a.kind === 'PHOTO'" type="button" @click="lightbox = absoluteMediaUrl(a.url)">
              <img :src="absoluteMediaUrl(a.url)" :alt="a.name" loading="lazy" class="h-20 w-20 rounded-xl object-cover ring-1 ring-black/5">
            </button>
            <a v-else :href="absoluteMediaUrl(a.url)" target="_blank" rel="noopener" download class="flex max-w-[14rem] items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-xs hover:bg-slate-200 dark:bg-white/10">
              <Icon name="lucide:file-text" class="h-4 w-4 flex-shrink-0" /><span class="truncate font-medium">{{ a.name }}</span>
            </a>
          </template>
        </div>
      </template>
    </div>

    <Teleport to="body">
      <div v-if="lightbox" class="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" @click="lightbox = null">
        <img :src="lightbox" alt="" class="max-h-full max-w-full rounded-2xl object-contain">
      </div>
    </Teleport>
  </div>
</template>
