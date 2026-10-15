<template>
  <!-- Compact pager: a rows-per-page menu, arrows, and a page box ("3 / 287") instead of a strip of numbered buttons. -->
  <div class="flex items-center gap-2">
    <UDropdown :items="[sizeOptions.map((n) => ({ label: String(n), click: () => emit('update:pageSize', n) }))]" :popper="{ placement: 'top-end', strategy: 'fixed' }">
      <button type="button" class="at-btn !px-3 !py-1.5 text-xs" :aria-label="t('common.rowsPerPage')" :title="t('common.rowsPerPage')">
        <span class="tabular-nums">{{ pageSize }}</span><span class="text-gray-400">{{ t('common.perPage') }}</span>
        <Icon name="lucide:chevron-up" class="h-3.5 w-3.5 text-gray-400" />
      </button>
    </UDropdown>

    <div class="flex items-center gap-1">
      <button type="button" class="at-btn !px-2 !py-1.5 hidden sm:inline-flex" :disabled="page <= 1" :aria-label="t('common.firstPage')" @click="go(1)"><Icon name="lucide:chevrons-left" class="h-4 w-4" /></button>
      <button type="button" class="at-btn !px-2 !py-1.5" :disabled="page <= 1" :aria-label="t('common.prevPage')" @click="go(page - 1)"><Icon name="lucide:chevron-left" class="h-4 w-4" /></button>
      <label class="flex items-center gap-1.5 px-1 text-xs text-gray-500 dark:text-gray-400">
        <input
          :value="page"
          type="number"
          inputmode="numeric"
          min="1"
          :max="pageCount"
          class="h-8 w-14 rounded-full border border-gray-200 bg-white text-center text-sm font-semibold tabular-nums text-gray-900 outline-none focus:border-primary-400 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          :aria-label="t('common.page')"
          @change="(e) => go(Number((e.target as HTMLInputElement).value))"
        >
        <span class="tabular-nums">/ {{ pageCount }}</span>
      </label>
      <button type="button" class="at-btn !px-2 !py-1.5" :disabled="page >= pageCount" :aria-label="t('common.nextPage')" @click="go(page + 1)"><Icon name="lucide:chevron-right" class="h-4 w-4" /></button>
      <button type="button" class="at-btn !px-2 !py-1.5 hidden sm:inline-flex" :disabled="page >= pageCount" :aria-label="t('common.lastPage')" @click="go(pageCount)"><Icon name="lucide:chevrons-right" class="h-4 w-4" /></button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from '@/composables/useI18n';

const props = defineProps<{ page: number; pageSize: number; total: number; sizeOptions?: number[] }>();
const emit = defineEmits<{ (e: 'update:page', v: number): void; (e: 'update:pageSize', v: number): void }>();
const { t } = useI18n();

const sizeOptions = computed(() => props.sizeOptions?.length ? props.sizeOptions : [10, 25, 50, 100]);
const pageCount = computed(() => Math.max(1, Math.ceil(props.total / Math.max(1, props.pageSize))));
function go(n: number) {
  const next = Math.min(pageCount.value, Math.max(1, Math.floor(n) || 1));
  if (next !== props.page) emit('update:page', next);
}
</script>
