<script lang="ts" setup>
import type { SiteCategory } from '@/api/pages/ops';
import { categoryTree } from '@/utils/pagesCategories';
import { useI18n } from '@/composables/useI18n';

// Pick categories as toggle pills in tree order. `single` makes it a one-of picker (used for the parent category).
const props = defineProps<{ categories: SiteCategory[]; modelValue: string[]; single?: boolean; exclude?: Set<string> }>();
const emit = defineEmits<{ 'update:modelValue': [string[]] }>();
const { t } = useI18n();

const rows = computed(() => categoryTree(props.categories).filter(r => !props.exclude?.has(r.cat.id)));
const on = (id: string) => props.modelValue.includes(id);
function toggle(id: string) {
  if (props.single) { emit('update:modelValue', on(id) ? [] : [id]); return; }
  emit('update:modelValue', on(id) ? props.modelValue.filter(x => x !== id) : [...props.modelValue, id]);
}
</script>

<template>
  <div v-if="!rows.length" class="rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-500 dark:bg-white/5 dark:text-gray-400"><slot name="empty">{{ t('pages.categories.none') }}</slot></div>
  <div v-else class="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto">
    <button v-for="r in rows" :key="r.cat.id" type="button"
      class="inline-flex max-w-full items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ring-1 transition"
      :class="on(r.cat.id) ? 'bg-primary-50 text-primary-700 ring-primary-300 dark:bg-blue-500/15 dark:text-primary-300 dark:ring-primary-500/40' : 'bg-white text-gray-600 ring-black/10 hover:bg-gray-50 dark:bg-transparent dark:text-gray-300 dark:ring-white/10 dark:hover:bg-white/5'"
      :style="r.depth ? { marginLeft: `${Math.min(r.depth, 3) * 0.75}rem` } : undefined"
      :aria-pressed="on(r.cat.id)" @click="toggle(r.cat.id)">
      <UIcon :name="on(r.cat.id) ? 'lucide:check' : 'lucide:tag'" class="h-3.5 w-3.5 flex-shrink-0" />
      <span class="truncate">{{ r.cat.title }}</span>
    </button>
  </div>
</template>
