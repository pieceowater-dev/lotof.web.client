<script setup lang="ts">
import { useI18n } from '@/composables/useI18n'

const props = withDefaults(defineProps<{
  rows: any[]
  columns: Array<{ key: string; label?: string; sortable?: boolean }>
  loading?: boolean
  emptyIcon?: string
  hover?: boolean
  // Total count for pagination; if not provided, falls back to rows.length
  total?: number | null
  pageCountOptions?: number[]
  // Flag to enable pagination
  pagination?: boolean
}>(), {
  total: null,
  pagination: false
})

// Expose UTable's sort v-model and optional page/pageCount v-models
const sort = defineModel<any>('sort')
const page = defineModel<number>('page')
const pageCount = defineModel<number>('pageCount')

const { t } = useI18n()

const options = computed(() => props.pageCountOptions || [10, 25, 50, 100])

// Show pagination if explicitly enabled via prop or if page/pageCount models have values
const hasPaging = computed(() => {
  return props.pagination || (page.value !== undefined && pageCount.value !== undefined)
})
const pageModel = computed<number>({ get: () => page.value ?? 1, set: (v) => (page.value = v) })
const pageCountModel = computed<number>({ get: () => pageCount.value ?? options.value[0], set: (v) => (pageCount.value = v) })

// Use provided total or fall back to rows.length
const effectiveTotal = computed(() => props.total ?? props.rows.length)
const pageFrom = computed(() => hasPaging.value ? ((pageModel.value - 1) * pageCountModel.value) + 1 : 0)
const pageTo = computed(() => hasPaging.value ? Math.min(pageModel.value * pageCountModel.value, effectiveTotal.value) : 0)
</script>

<template>
  <div class="bg-white dark:bg-gray-900 rounded-xl shadow-lg ring-1 ring-gray-200 dark:ring-gray-800 overflow-hidden flex flex-col h-full">
  <div class="flex-1 min-h-0 overflow-auto">
  <div class="overflow-x-auto">
  <UTable
    v-model:sort="sort"
    :rows="rows"
    :columns="columns"
    :loading="!!loading"
    :loading-state="{ icon: 'lucide:loader', label: '' }"
    :empty-state="{ icon: emptyIcon || 'lucide:bird', label: t('app.emptyTable') }"
    :progress="{ color: 'primary', animation: 'carousel' }"
    :ui="{ 
      th: { base: 'normal-case sticky top-0 z-10 bg-gray-50 dark:bg-gray-800/50 whitespace-nowrap', padding: 'px-2 md:px-4 py-1 md:py-2 text-xs md:text-sm' }, 
      td: { base: 'truncate', padding: 'px-2 md:px-4 py-1 md:py-2 text-xs md:text-sm' },
      divide: 'divide-y divide-gray-200 dark:divide-gray-800',
      tbody: 'divide-y divide-gray-200 dark:divide-gray-800 bg-white dark:bg-gray-900',
      thead: '',
      tr: { 
        base: 'transition-colors duration-150',
        selected: 'bg-gray-50 dark:bg-gray-800/30'
      }
    }"
    class="w-full min-w-max"
    :hover="hover ?? true"
  >
    <!-- Dynamic forward of column data slots -->
    <template v-for="col in columns" :key="col.key" v-slot:[`${col.key}-data`]="slotProps">
      <slot :name="`${col.key}-data`" v-bind="slotProps">
        <span class="truncate">{{ (slotProps.row as any)[col.key] }}</span>
      </slot>
    </template>
  </UTable>
  </div>
  </div>

    <!-- Optional pagination footer -->
    <template v-if="hasPaging">
      <div class="flex flex-wrap justify-between items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-800 flex-shrink-0">
        <div>
          <span class="text-xs leading-5 text-gray-600 dark:text-gray-400">
            {{ t('common.showing') }}
            <span class="font-medium text-gray-900 dark:text-white">{{ pageFrom }}</span>
            {{ t('common.to') }}
            <span class="font-medium text-gray-900 dark:text-white">{{ pageTo }}</span>
            {{ t('common.of') }}
            <span class="font-medium text-gray-900 dark:text-white">{{ effectiveTotal }}</span>
            {{ t('common.results') }}
          </span>
        </div>

        <div class="flex gap-x-2 items-center">
          <div class="flex items-center gap-1.5">
            <span class="text-xs leading-5 text-gray-600 dark:text-gray-400">{{ t('common.rowsPerPage') }}</span>
            <USelect v-model="pageCountModel" :options="options" class="w-16" size="xs" />
          </div>
          <UPagination
            v-model="pageModel"
            :page-count="pageCountModel || 10"
            :total="effectiveTotal"
            size="xs"
            :ui="{ wrapper: 'flex items-center gap-0.5', rounded: 'min-w-[28px] justify-center text-xs', default: { activeButton: { variant: 'outline' } } }"
          />
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
/* Table row hover effect */
:deep(tbody tr) {
  transition: background-color 150ms ease-in-out;
}

:deep(tbody tr:hover) {
  background-color: rgb(249 250 251) !important;
}

:deep(tbody tr:hover td) {
  background-color: rgb(249 250 251) !important;
}

.dark :deep(tbody tr:hover) {
  background-color: rgb(64 64 64 / 0.3) !important;
}

.dark :deep(tbody tr:hover td) {
  background-color: rgb(64 64 64 / 0.3) !important;
}
</style>