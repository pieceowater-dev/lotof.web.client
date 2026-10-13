<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useCrmAuth } from '@/composables/useCrmAuth';
import { logError } from '@/utils/logger';
import { updateClientMarks, type ClientMarks } from '@/api/contacts/marks';

const props = defineProps<{ clientId?: string; marks: Partial<ClientMarks> }>();
const emit = defineEmits<{ (e: 'changed', marks: ClientMarks): void }>();

const { t } = useI18n();
const toast = useToast();
const { ctx } = useCrmAuth();

const state = ref<ClientMarks>({ rating: 0, isSupplier: false, isProblematic: false, isVip: false });
const saving = ref(false);

watch(() => props.marks, (m) => {
  state.value = { rating: m.rating ?? 0, isSupplier: !!m.isSupplier, isProblematic: !!m.isProblematic, isVip: !!m.isVip };
}, { immediate: true, deep: true });

async function save(next: ClientMarks) {
  if (!props.clientId) return;
  const c = await ctx();
  if (!c) return;
  const prev = state.value;
  state.value = next;
  saving.value = true;
  try {
    emit('changed', await updateClientMarks(c.token, c.ns, props.clientId, next));
  } catch (e) {
    state.value = prev;
    logError('Failed to save marks:', e);
    toast.add({ title: t('common.error'), description: t('contacts.notesSaveError'), color: 'red' });
  } finally {
    saving.value = false;
  }
}

const setRating = (n: number) => save({ ...state.value, rating: state.value.rating === n ? 0 : n });
const toggle = (k: 'isSupplier' | 'isProblematic' | 'isVip') => save({ ...state.value, [k]: !state.value[k] });

const chips: Array<{ key: 'isSupplier' | 'isProblematic' | 'isVip'; label: string; on: string }> = [
  { key: 'isSupplier', label: 'markSupplier', on: 'bg-sky-100 text-sky-700 border-sky-300 dark:bg-sky-900/40 dark:text-sky-200 dark:border-sky-700' },
  { key: 'isVip', label: 'markVip', on: 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-700' },
  { key: 'isProblematic', label: 'markProblematic', on: 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/40 dark:text-red-200 dark:border-red-700' },
];
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 px-5 py-4 flex items-center gap-4 flex-wrap">
    <div class="flex items-center gap-1" :title="t('contacts.markRating')">
      <button v-for="n in 5" :key="n" :disabled="saving" @click="setRating(n)">
        <UIcon name="lucide:star" class="w-5 h-5" :class="n <= state.rating ? 'text-amber-500 fill-amber-400' : 'text-gray-300 dark:text-gray-600'" />
      </button>
    </div>
    <div class="flex items-center gap-2 flex-wrap">
      <button
        v-for="c in chips"
        :key="c.key"
        :disabled="saving"
        class="text-xs px-2.5 py-1 rounded-full border transition-colors"
        :class="state[c.key] ? c.on : 'border-gray-300 text-gray-500 dark:border-gray-600 dark:text-gray-400'"
        @click="toggle(c.key)"
      >
        {{ t(`contacts.${c.label}`) }}
      </button>
    </div>
    <span class="text-[11px] text-gray-400">{{ t('contacts.marksHint') }}</span>
  </div>
</template>
