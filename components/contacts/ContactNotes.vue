<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useCrmAuth } from '@/composables/useCrmAuth';
import { compressImageForUpload } from '@/utils/imageCompression';
import { logError } from '@/utils/logger';
import {
  listClientNotes, createClientNote, updateClientNote, pinClientNote, deleteClientNote, restoreClientNote,
  type ClientNote, type NoteAttachment,
} from '@/api/contacts/notes';

const props = defineProps<{ clientId?: string }>();

const { t } = useI18n();
const toast = useToast();
const { ctx } = useCrmAuth();

const MAX_PHOTOS = 5;
const MAX_DATA_URL = 240_000; // chars; photos are stored inline, so keep them small

const notes = ref<ClientNote[]>([]);
const loading = ref(false);
const saving = ref(false);
const showDeleted = ref(false);
const body = ref('');
const important = ref(false);
const photos = ref<NoteAttachment[]>([]);
const fileInput = ref<HTMLInputElement | null>(null);
const editingId = ref<string | null>(null);
const editingBody = ref('');

const pinned = computed(() => notes.value.filter(n => (n.pinned || n.important) && !n.deleted));
const rest = computed(() => notes.value.filter(n => !(n.pinned || n.important) || n.deleted));

async function load() {
  if (!props.clientId) return;
  const c = await ctx();
  if (!c) return;
  loading.value = true;
  try {
    notes.value = await listClientNotes(c.token, c.ns, props.clientId, showDeleted.value);
  } catch (e) {
    logError('Failed to load notes:', e);
    toast.add({ title: t('common.error'), description: t('contacts.notesLoadError'), color: 'red' });
  } finally {
    loading.value = false;
  }
}

onMounted(load);
watch(() => props.clientId, load);
watch(showDeleted, load);

function readAsDataURL(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error || new Error('read failed'));
    reader.readAsDataURL(file);
  });
}

async function onPick(e: Event) {
  const input = e.target as HTMLInputElement;
  for (const file of Array.from(input.files || [])) {
    if (photos.value.length >= MAX_PHOTOS) {
      toast.add({ title: t('contacts.notesAttachLimit').replace('{n}', String(MAX_PHOTOS)), color: 'amber' });
      break;
    }
    try {
      const compressed = await compressImageForUpload(file, { t, maxDimension: 1100, quality: 0.7 });
      const dataUrl = await readAsDataURL(compressed);
      if (dataUrl.length > MAX_DATA_URL) {
        toast.add({ title: t('contacts.notesPhotoTooHeavy'), color: 'red' });
        continue;
      }
      photos.value.push({ fileUrl: dataUrl, fileName: file.name, mime: compressed.type || 'image/jpeg', sizeBytes: compressed.size });
    } catch (err) {
      logError('Photo attach failed:', err);
      toast.add({ title: t('common.error'), description: (err as Error).message, color: 'red' });
    }
  }
  input.value = '';
}

async function add() {
  if (!props.clientId || (!body.value.trim() && !photos.value.length)) return;
  const c = await ctx();
  if (!c) return;
  saving.value = true;
  try {
    await createClientNote(c.token, c.ns, props.clientId, {
      body: body.value, important: important.value, attachments: photos.value,
    });
    body.value = '';
    important.value = false;
    photos.value = [];
    await load();
  } catch (e) {
    logError('Failed to add note:', e);
    toast.add({ title: t('common.error'), description: t('contacts.notesSaveError'), color: 'red' });
  } finally {
    saving.value = false;
  }
}

async function act(fn: (token: string, ns: string) => Promise<unknown>) {
  const c = await ctx();
  if (!c) return;
  try {
    await fn(c.token, c.ns);
    await load();
  } catch (e) {
    logError('Note action failed:', e);
    toast.add({ title: t('common.error'), description: t('contacts.notesSaveError'), color: 'red' });
  }
}

const togglePin = (n: ClientNote) => act((tk, ns) => pinClientNote(tk, ns, n.id, !n.pinned));
const remove = (n: ClientNote) => act((tk, ns) => deleteClientNote(tk, ns, n.id));
const restore = (n: ClientNote) => act((tk, ns) => restoreClientNote(tk, ns, n.id));

function startEdit(n: ClientNote) {
  editingId.value = n.id;
  editingBody.value = n.body;
}

async function saveEdit(n: ClientNote) {
  const text = editingBody.value.trim();
  if (!text) return;
  await act((tk, ns) => updateClientNote(tk, ns, n.id, text, n.important));
  editingId.value = null;
}

function fmt(d: string) {
  return new Date(d).toLocaleString();
}
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
    <div class="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
      <UIcon name="lucide:sticky-note" class="w-5 h-5 text-amber-500" />
      <h2 class="text-lg font-semibold text-gray-900 dark:text-white flex-1">
        {{ t('contacts.notesTitle') }}
      </h2>
      <label class="text-xs text-gray-500 flex items-center gap-1 cursor-pointer">
        <input v-model="showDeleted" type="checkbox">
        {{ t('contacts.notesShowDeleted') }}
      </label>
    </div>

    <div class="px-5 py-4 space-y-3">
      <!-- composer -->
      <div class="space-y-2">
        <UTextarea v-model="body" :rows="2" autoresize :placeholder="t('contacts.notesPlaceholder')" />
        <div v-if="photos.length" class="flex flex-wrap gap-2">
          <div v-for="(p, i) in photos" :key="i" class="relative">
            <img :src="p.fileUrl" :alt="p.fileName" class="w-16 h-16 object-cover rounded-md border border-gray-200 dark:border-gray-600">
            <button
              class="absolute -top-1.5 -right-1.5 bg-white dark:bg-gray-700 rounded-full border border-gray-300 dark:border-gray-500 p-0.5"
              @click="photos.splice(i, 1)"
            >
              <UIcon name="lucide:x" class="w-3 h-3" />
            </button>
          </div>
        </div>
        <div class="flex items-center gap-2 flex-wrap">
          <input ref="fileInput" type="file" accept="image/*" multiple class="hidden" @change="onPick">
          <UButton size="xs" color="gray" variant="soft" icon="lucide:image-plus" @click="fileInput?.click()">
            {{ t('contacts.notesAttach') }}
          </UButton>
          <label class="text-xs text-gray-600 dark:text-gray-300 flex items-center gap-1 cursor-pointer">
            <input v-model="important" type="checkbox">
            {{ t('contacts.notesMarkImportant') }}
          </label>
          <UButton
            class="ml-auto"
            size="xs"
            :loading="saving"
            :disabled="!body.trim() && !photos.length"
            @click="add"
          >
            {{ t('contacts.notesAdd') }}
          </UButton>
        </div>
      </div>

      <div v-if="loading" class="text-sm text-gray-400">{{ t('common.loading') }}</div>
      <div v-else-if="!notes.length" class="text-sm text-gray-400">{{ t('contacts.notesEmpty') }}</div>

      <!-- pinned / important first -->
      <template v-for="group in [pinned, rest]" :key="group === pinned ? 'p' : 'r'">
        <div
          v-for="n in group"
          :key="n.id"
          class="rounded-lg border px-3 py-2 text-sm"
          :class="[
            n.deleted ? 'opacity-60 border-dashed border-gray-300 dark:border-gray-600'
              : n.important ? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30'
                : 'border-gray-200 dark:border-gray-700',
          ]"
        >
          <div class="flex items-center gap-2 text-xs text-gray-500 mb-1">
            <UIcon v-if="n.pinned && !n.deleted" name="lucide:pin" class="w-3.5 h-3.5 text-amber-600" />
            <UIcon v-if="n.important && !n.deleted" name="lucide:alert-triangle" class="w-3.5 h-3.5 text-amber-600" />
            <span>{{ fmt(n.createdAt) }}</span>
            <span v-if="n.deleted" class="italic">{{ t('contacts.notesDeleted') }}</span>
            <span class="flex-1" />
            <template v-if="!n.deleted">
              <button class="hover:text-gray-900 dark:hover:text-white" :title="n.pinned ? t('contacts.notesUnpin') : t('contacts.notesPin')" @click="togglePin(n)">
                <UIcon name="lucide:pin" class="w-3.5 h-3.5" />
              </button>
              <button class="hover:text-gray-900 dark:hover:text-white" :title="t('contacts.notesEdit')" @click="startEdit(n)">
                <UIcon name="lucide:pencil" class="w-3.5 h-3.5" />
              </button>
              <button class="hover:text-red-600" :title="t('contacts.notesDelete')" @click="remove(n)">
                <UIcon name="lucide:trash-2" class="w-3.5 h-3.5" />
              </button>
            </template>
            <button v-else class="hover:text-gray-900 dark:hover:text-white underline" @click="restore(n)">
              {{ t('contacts.notesRestore') }}
            </button>
          </div>

          <template v-if="editingId === n.id">
            <UTextarea v-model="editingBody" :rows="2" autoresize />
            <div class="flex gap-2 mt-2 justify-end">
              <UButton size="xs" color="gray" variant="soft" @click="editingId = null">{{ t('common.cancel') }}</UButton>
              <UButton size="xs" @click="saveEdit(n)">{{ t('contacts.notesSave') }}</UButton>
            </div>
          </template>
          <p v-else class="whitespace-pre-wrap break-words text-gray-800 dark:text-gray-100">{{ n.body }}</p>

          <div v-if="n.attachments.length" class="flex flex-wrap gap-2 mt-2">
            <a v-for="a in n.attachments" :key="a.id" :href="a.fileUrl" target="_blank" rel="noopener">
              <img :src="a.fileUrl" :alt="a.fileName" class="w-20 h-20 object-cover rounded-md border border-gray-200 dark:border-gray-600">
            </a>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
