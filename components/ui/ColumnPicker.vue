<script setup lang="ts">
import { parseHidden, toggleHidden, type ColumnDef } from '@/utils/columnPrefs';

// "Columns" button with a checklist; the choice is kept in this browser under `storageKey`.
const props = defineProps<{ storageKey: string; columns: ColumnDef[]; locked?: string[] }>();
const hidden = defineModel<string[]>('hidden', { default: () => [] });
const { t } = useI18n();
const open = ref(false);

onMounted(() => {
  try { hidden.value = parseHidden(localStorage.getItem(props.storageKey)); } catch { /* storage may be blocked */ }
});
function toggle(key: string) {
  hidden.value = toggleHidden(hidden.value, key, props.locked || []);
  try { localStorage.setItem(props.storageKey, JSON.stringify(hidden.value)); } catch { /* storage may be blocked */ }
}
function reset() {
  hidden.value = [];
  try { localStorage.removeItem(props.storageKey); } catch { /* storage may be blocked */ }
}
</script>

<template>
  <div class="relative">
    <button type="button" class="at-btn !px-3 !py-1.5" @click="open = !open">
      <UIcon name="lucide:columns-3" class="h-4 w-4" />{{ t('common.columns') }}
    </button>
    <div v-if="open" class="fixed inset-0 z-20" @click="open = false" />
    <div v-if="open" class="absolute right-0 top-full z-30 mt-2 w-56 rounded-2xl border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-800 dark:bg-gray-900">
      <button
        v-for="c in columns.filter((x) => !(locked || []).includes(x.key))"
        :key="c.key"
        type="button"
        class="flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-white/5"
        @click="toggle(c.key)"
      >
        <UIcon :name="hidden.includes(c.key) ? 'lucide:square' : 'lucide:check-square'" class="h-4 w-4" :class="hidden.includes(c.key) ? 'text-gray-400' : 'text-accent-600'" />{{ c.label }}
      </button>
      <button type="button" class="mt-1 w-full rounded-xl px-2.5 py-1.5 text-left text-xs text-gray-500 hover:bg-gray-50 dark:hover:bg-white/5" @click="reset">{{ t('common.resetColumns') }}</button>
    </div>
  </div>
</template>
