<script setup lang="ts">
import AppSkeleton from '@/components/ui/AppSkeleton.vue';
import { useI18n } from '@/composables/useI18n'

const props = withDefaults(defineProps<{
  rows: any[]
  columns: Array<{ key: string; label?: string; sortable?: boolean }>
  loading?: boolean
  emptyIcon?: string
  hover?: boolean
  soft?: boolean
  // Total count for pagination; if not provided, falls back to rows.length
  total?: number | null
  pageCountOptions?: number[]
  // Flag to enable pagination
  pagination?: boolean
  // On phones a wide table is unreadable (the important columns end up off-screen), so each
  // row is shown as a card instead. Switch off for tables that must stay tables.
  mobileCards?: boolean
}>(), {
  mobileCards: true,
  emptyIcon: 'lucide:bird',
  total: null,
  pageCountOptions: () => [10, 25, 50, 100],
  pagination: false
})

// Expose UTable's sort v-model and optional page/pageCount/selected v-models
const sort = defineModel<any>('sort')
const page = defineModel<number>('page')
const pageCount = defineModel<number>('pageCount')
// Row selection (checkboxes). Only rendered when a consumer binds v-model:selected
// — UTable shows its checkbox column automatically whenever this is non-undefined,
// so leaving it unbound keeps tables without selection exactly as before.
const selected = defineModel<any[] | undefined>('selected', { default: undefined })

// UTable's row-click event isn't forwarded automatically: AppTable's root
// element is a wrapper <div>, not <UTable> itself, so Vue's default attrs
// fallthrough never reaches the nested UTable — an explicit re-emit is
// required for @select to work on the consumer side.
const emit = defineEmits<{ (e: 'select', row: any): void }>()

const { t } = useI18n()

const options = computed(() => props.pageCountOptions || [10, 25, 50, 100])

// Show pagination if explicitly enabled via prop or if page/pageCount models have values
const hasPaging = computed(() => {
  return props.pagination || (page.value !== undefined && pageCount.value !== undefined)
})
const pageModel = computed<number>({ get: () => page.value ?? 1, set: (v) => (page.value = v) })
const pageCountModel = computed<number>({ get: () => pageCount.value ?? options.value[0], set: (v) => (pageCount.value = v) })

// Cards: the first column is the card's title, columns without a label are actions.
const titleCol = computed(() => props.columns.find((c) => c.key !== 'select' && c.key !== 'actions'))
const detailCols = computed(() => props.columns.filter((c) => c !== titleCol.value && c.key !== 'select' && c.key !== 'actions' && c.label !== ''))
const actionCols = computed(() => props.columns.filter((c) => c.key === 'actions'))

// Use provided total or fall back to rows.length
const effectiveTotal = computed(() => props.total ?? props.rows.length)
const pageFrom = computed(() => hasPaging.value ? ((pageModel.value - 1) * pageCountModel.value) + 1 : 0)
const pageTo = computed(() => hasPaging.value ? Math.min(pageModel.value * pageCountModel.value, effectiveTotal.value) : 0)
</script>

<template>
  <div
    class="overflow-hidden flex flex-col"
    :class="soft ? 'at-tray max-h-full' : 'h-full bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-800'"
  >
    <div class="flex-1 min-h-0 overflow-auto">
      <!-- Phones: one card per row -->
      <div v-if="mobileCards" class="sm:hidden divide-y divide-gray-100 dark:divide-gray-800">
        <div v-if="loading && !rows.length" class="px-4 py-4"><AppSkeleton variant="list" :rows="4" /></div>
        <div v-else-if="!rows.length" class="flex flex-col items-center gap-2 px-4 py-10 text-sm text-gray-500">
          <UIcon :name="emptyIcon || 'lucide:bird'" class="h-8 w-8 opacity-50" />{{ t('app.emptyTable') }}
        </div>
        <div
          v-for="(row, i) in rows"
          :key="row.id ?? i"
          class="px-4 py-3 active:bg-gray-50 dark:active:bg-white/5" :class="$slots['mobile-card'] ? '' : 'space-y-2'"
          role="button"
          tabindex="0"
          @click="emit('select', row)"
          @keydown.enter="emit('select', row)"
        >
          <!-- A page may draw its own, denser phone card (identity + the deciding facts + the next action). -->
          <slot v-if="$slots['mobile-card']" name="mobile-card" :row="row" />
          <template v-else>
          <div v-if="titleCol" class="min-w-0 text-sm font-semibold">
            <slot :name="`${titleCol.key}-data`" :row="row" :column="titleCol">{{ row[titleCol.key] }}</slot>
          </div>
          <dl class="grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
            <template v-for="col in detailCols" :key="col.key">
              <dt class="text-gray-400">{{ col.label }}</dt>
              <dd class="min-w-0 text-right text-gray-700 dark:text-gray-200">
                <slot :name="`${col.key}-data`" :row="row" :column="col">{{ row[col.key] }}</slot>
              </dd>
            </template>
          </dl>
          <div v-if="actionCols.length" class="flex justify-end" @click.stop>
            <slot v-for="col in actionCols" :key="col.key" :name="`${col.key}-data`" :row="row" :column="col" />
          </div>
          </template>
        </div>
      </div>

      <div :class="mobileCards ? 'hidden sm:block' : ''">
        <UTable
          v-model:sort="sort"
          v-model="selected"
          by="id"
          :rows="rows"
          :columns="columns"
          :loading="!!loading"
          :loading-state="{ icon: 'lucide:loader', label: '' }"
          :empty-state="{ icon: emptyIcon || 'lucide:bird', label: t('app.emptyTable') }"
          :progress="{ color: 'primary', animation: 'carousel' }"
          :ui="{
            // no inner scroll wrapper: the parent .overflow-auto must be the only scroller so the sticky header sticks
            wrapper: 'relative',
            th: { base: 'normal-case sticky top-0 z-10 bg-gray-50 dark:bg-gray-800/50 whitespace-nowrap', padding: 'px-2 md:px-4 py-1 md:py-2 text-xs md:text-sm' },
            td: { base: 'truncate', padding: 'px-2 md:px-4 py-1 md:py-2 text-xs md:text-sm' },
            divide: 'divide-y divide-gray-200 dark:divide-gray-800',
            tbody: 'divide-y divide-gray-200 dark:divide-gray-800 bg-white dark:bg-gray-900',
            thead: '',
            tr: {
              base: 'transition-colors duration-150',
              selected: 'bg-primary-50/60 dark:bg-primary-950/20'
            },
            default: {
              sortAscIcon: 'i-lucide-arrow-up',
              sortDescIcon: 'i-lucide-arrow-down',
              sortButton: {
                icon: 'i-lucide-arrow-up-down',
                trailing: true,
                square: true,
                color: 'gray',
                variant: 'ghost',
                class: 'ms-1 -my-1.5 opacity-50 hover:opacity-100 transition-opacity'
              }
            }
          }"
          class="w-full min-w-max"
          :hover="hover ?? true"
          @select="(row: any) => emit('select', row)"
        >
          <!-- first load of an empty table: skeleton rows instead of a lone spinner -->
          <template #loading-state>
            <div class="px-4 py-4">
              <AppSkeleton variant="list" :rows="5" />
            </div>
          </template>

          <!-- UTable doesn't stop the checkbox click from bubbling to the
               row's own @select handler, so ticking a box would also open
               the row underneath it — swallow the click here instead. -->
          <template #select-data="{ checked, change }">
            <UCheckbox :model-value="checked" @click.stop @change="change" />
          </template>

          <!-- Dynamic forward of column data slots -->
          <template
            v-for="col in columns"
            :key="col.key"
            #[`${col.key}-data`]="slotProps"
          >
            <slot
              :name="`${col.key}-data`"
              v-bind="slotProps"
            >
              <span class="truncate">{{ (slotProps.row as any)[col.key] }}</span>
            </slot>
          </template>
        </UTable>
      </div>
    </div>

    <!-- Optional pagination footer -->
    <template v-if="hasPaging">
      <div class="flex flex-wrap justify-between items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-800 flex-shrink-0" :class="soft && 'at-tray-foot'">
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
            <USelect
              v-model="pageCountModel"
              :options="options"
              class="w-16"
              size="xs"
            />
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
  transition: background-color 75ms ease-in-out;
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

/* Flash for rows that just appeared (e.g. new orders arriving via a
   background poll) — set by a consumer via `row.class`. Settles to a dim
   persistent tint rather than fading out entirely (`forwards` holds the
   100% keyframe), so the row stays visibly "unacknowledged" until the
   consumer removes the class (on open/status-change/row-click). */
:deep(tr.row-flash-new) {
  animation: row-flash-new 0.9s ease-out forwards;
}

:deep(tr.row-flash-new td) {
  animation: row-flash-new 0.9s ease-out forwards;
}

@keyframes row-flash-new {
  0% { background-color: rgba(37, 99, 235, 0.35); }
  100% { background-color: rgba(37, 99, 235, 0.12); }
}
</style>