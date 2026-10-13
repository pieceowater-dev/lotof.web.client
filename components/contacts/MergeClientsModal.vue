<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { atModalUi } from '@/utils/atraceUi';
import { useI18n } from '@/composables/useI18n';
import { contactsListClients, type ClientRow } from '@/api/contacts/listClients';
import { contactsFindDuplicates, contactsMergeClients } from '@/api/contacts/mergeClients';
import { logError } from '@/utils/logger';
import { maskProfanity } from '@/utils/profanityFilter';

const props = defineProps<{
  isOpen: boolean;
  primary: ClientRow | null;
  token: string;
  namespace: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'merged'): void;
}>();

const { t } = useI18n();
const toast = useToast();

const search = ref('');
const results = ref<ClientRow[]>([]);
const suggestions = ref<ClientRow[]>([]);
const selected = ref<Map<string, ClientRow>>(new Map());
const searching = ref(false);
const merging = ref(false);
const confirming = ref(false);
let searchTimer: ReturnType<typeof setTimeout> | null = null;

function nameOf(c: ClientRow): string {
  if (c.individual) {
    return maskProfanity([c.individual.lastName, c.individual.firstName, c.individual.middleName].filter(Boolean).join(' '));
  }
  return maskProfanity(c.legalEntity?.legalName) || '---';
}

function phonesOf(c: ClientRow): string {
  return (c.contacts || []).filter(i => i.type === 'phone' || i.type === 'email').map(i => i.value).slice(0, 3).join(', ');
}

const primaryId = computed(() => props.primary?.client.id || '');
const selectedList = computed(() => [...selected.value.values()]);

// Only clients of the same type that are not already merged can be picked.
function eligible(c: ClientRow): boolean {
  return c.client.id !== primaryId.value
    && c.client.clientType === props.primary?.client.clientType
    && !(c as any).client.mergedIntoId;
}

function toggle(c: ClientRow) {
  const next = new Map(selected.value);
  if (next.has(c.client.id)) next.delete(c.client.id);
  else next.set(c.client.id, c);
  selected.value = next;
}

async function loadSuggestions() {
  suggestions.value = [];
  if (!props.token || !props.namespace || !primaryId.value) return;
  try {
    const groups = await contactsFindDuplicates(props.token, props.namespace);
    const mine = groups.filter(g => g.clients.some(c => c.client.id === primaryId.value));
    const seen = new Set<string>();
    suggestions.value = mine.flatMap(g => g.clients).filter(c => {
      if (!eligible(c) || seen.has(c.client.id)) return false;
      seen.add(c.client.id);
      return true;
    });
  } catch (e) {
    logError('Failed to load duplicate suggestions:', e);
  }
}

async function runSearch() {
  const q = search.value.trim();
  if (!q) {
    results.value = [];
    return;
  }
  searching.value = true;
  try {
    const res = await contactsListClients(props.token, props.namespace, {
      search: q,
      clientType: props.primary?.client.clientType,
      pagination: { length: 10, page: 1 },
    });
    results.value = res.rows.filter(eligible);
  } catch (e) {
    logError('Client search failed:', e);
  } finally {
    searching.value = false;
  }
}

watch(search, () => {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(runSearch, 300);
});

watch(() => props.isOpen, (open) => {
  if (open) {
    search.value = '';
    results.value = [];
    selected.value = new Map();
    confirming.value = false;
    loadSuggestions();
  }
});

async function doMerge() {
  if (!selectedList.value.length || !primaryId.value) return;
  merging.value = true;
  try {
    await contactsMergeClients(props.token, props.namespace, primaryId.value, selectedList.value.map(c => c.client.id));
    toast.add({ title: t('common.success'), description: t('contacts.mergeDone'), color: 'emerald' });
    emit('merged');
    emit('close');
  } catch (e) {
    logError('Merge clients failed:', e);
    toast.add({ title: t('common.error'), description: t('contacts.mergeError'), color: 'red' });
  } finally {
    merging.value = false;
    confirming.value = false;
  }
}
</script>

<template>
  <UModal
    class="at-modal"
    :ui="atModalUi"
    :model-value="isOpen"
    @update:model-value="emit('close')"
  >
    <div class="p-7 sm:p-8 max-h-[88vh] overflow-y-auto space-y-4">
      <div class="flex items-start justify-between gap-3">
        <div>
          <h2 class="text-lg font-semibold">{{ t('contacts.mergeTitle') }}</h2>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {{ t('contacts.mergeHint') }}
          </p>
        </div>
        <UButton color="gray" variant="ghost" icon="lucide:x" class="-my-1" @click="emit('close')" />
      </div>

      <div v-if="primary" class="rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm">
        <span class="text-gray-500">{{ t('contacts.mergeKeep') }}:</span>
        <span class="font-medium ml-1">{{ nameOf(primary) }}</span>
      </div>

      <div v-if="suggestions.length" class="space-y-2">
        <div class="text-xs font-medium uppercase tracking-wide text-gray-500">{{ t('contacts.mergeSuggestions') }}</div>
        <label
          v-for="c in suggestions"
          :key="c.client.id"
          class="flex items-center gap-3 p-2.5 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer"
          :class="{ 'ring-2 ring-emerald-500': selected.has(c.client.id) }"
        >
          <input type="checkbox" :checked="selected.has(c.client.id)" @change="toggle(c)">
          <div class="min-w-0">
            <div class="text-sm font-medium truncate">{{ nameOf(c) }}</div>
            <div class="text-xs text-gray-500 truncate">{{ phonesOf(c) }}</div>
          </div>
        </label>
      </div>

      <div class="space-y-2">
        <UInput v-model="search" size="sm" icon="lucide:search" :placeholder="t('contacts.mergeSearch')" />
        <div v-if="searching" class="text-xs text-gray-500">{{ t('common.loading') }}</div>
        <label
          v-for="c in results"
          :key="c.client.id"
          class="flex items-center gap-3 p-2.5 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer"
          :class="{ 'ring-2 ring-emerald-500': selected.has(c.client.id) }"
        >
          <input type="checkbox" :checked="selected.has(c.client.id)" @change="toggle(c)">
          <div class="min-w-0">
            <div class="text-sm font-medium truncate">{{ nameOf(c) }}</div>
            <div class="text-xs text-gray-500 truncate">{{ phonesOf(c) }}</div>
          </div>
        </label>
      </div>

      <div v-if="confirming" class="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/30 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
        {{ t('contacts.mergeConfirm') }}
      </div>

      <div class="flex justify-end gap-2">
        <UButton color="gray" variant="soft" @click="emit('close')">{{ t('common.cancel') }}</UButton>
        <UButton
          v-if="!confirming"
          :disabled="!selectedList.length"
          @click="confirming = true"
        >
          {{ t('contacts.mergeAction') }} ({{ selectedList.length }})
        </UButton>
        <UButton v-else color="amber" :loading="merging" @click="doMerge">
          {{ t('contacts.mergeConfirmButton') }}
        </UButton>
      </div>
    </div>
  </UModal>
</template>
