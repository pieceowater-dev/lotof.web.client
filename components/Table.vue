<script lang="ts" setup>
import { atraceRecordsByPost, type AtraceRecord } from '@/api/atrace/record/listByPost';
import { CookieKeys } from '@/utils/storageKeys';

const props = defineProps<{ postId?: string | null }>();

// Columns for Nuxt UI table
const columns = [
  { key: 'timestamp', label: 'Datetime', sortable: true },
  { key: 'username', label: 'Username', sortable: false },
  { key: 'email', label: 'Email', sortable: false },
  { key: 'method', label: 'Method', sortable: false },
  { key: 'suspicious', label: 'Suspicious', sortable: false },
];

// Selected Rows (not used for actions right now, but keep parity with UTable)
const selectedRows = ref<AtraceRecord[]>([]);
function select(row: AtraceRecord) {
  const idx = selectedRows.value.findIndex(r => r.id === row.id);
  if (idx === -1) selectedRows.value.push(row);
  else selectedRows.value.splice(idx, 1);
}

// Route/context
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);

// Pagination and sorting
const page = ref(1);
const pageCount = ref(10); // rows per page (maps to GraphQL enum)
const pageTotal = ref(0);
const pageFrom = computed(() => (page.value - 1) * pageCount.value + 1);
const pageTo = computed(() => Math.min(page.value * pageCount.value, pageTotal.value));
const sort = ref<{ column: string; direction: 'asc' | 'desc' }>({ column: 'timestamp', direction: 'desc' });

// Map numeric to GraphQL enum length
const pageCountToEnum = (n: number): any => {
  switch (n) {
    case 10: return 'TEN';
    case 25: return 'TWENTY_FIVE';
    case 50: return 'FIFTY';
    case 100: return 'ONE_HUNDRED';
    default: return 'TEN';
  }
};

// Token from cookie (local to this component)
function getAtraceToken(): string | null {
  const cookie = useCookie<string | null>(CookieKeys.ATRACE_TOKEN, { path: '/' });
  return cookie.value || null;
}

// Data loader
const { data: records, status, refresh } = await useLazyAsyncData<AtraceRecord[]>(
  'atrace:records',
  async () => {
    if (!props.postId) return [];
    const token = getAtraceToken();
    if (!token) return [];
    const res = await atraceRecordsByPost(token, nsSlug.value, {
      postId: props.postId,
      page: page.value,
      length: pageCountToEnum(pageCount.value),
      sort: { field: sort.value.column, by: sort.value.direction.toUpperCase() as 'ASC' | 'DESC' },
    });
    pageTotal.value = res.count;
    return res.records;
  },
  { default: () => [], watch: [() => props.postId, page, pageCount, sort, nsSlug] }
);

// Ensure initial load if postId is set on mount
watchEffect(() => {
  if (props.postId) refresh();
});

// Helper to format timestamp
function fmtTs(ts: number): string {
  try { return new Date(ts * 1000).toLocaleString(); } catch { return String(ts); }
}

// Helper to format method enum to human readable
function fmtMethod(method: string): string {
  switch (method) {
    case 'METHOD_QR_STATIC': return 'QR Static';
    case 'METHOD_QR_DYNAMIC': return 'QR Dynamic';
    case 'METHOD_PIN': return 'PIN';
    case 'METHOD_MANUAL': return 'Manual';
    // Add more cases as needed
    default: return method.replace(/_/g, ' ').replace(/\bMETHOD\b/, '').trim();
  }
}
</script>

<template>
  <UCard
    class="w-full"
    :ui="{
      base: '',
      ring: '',
      divide: 'divide-y divide-gray-200 dark:divide-gray-700',
      header: { padding: 'px-4 py-5' },
      body: { padding: '', base: 'divide-y divide-gray-200 dark:bg-gray-800' },
      footer: { padding: 'p-4', base: 'dark:bg-gray-800' }
    }"
  >

    <!-- Header and Action buttons -->
    <!-- <div class="flex justify-between items-center w-full px-4 py-3">
      <div class="flex gap-1.5 items-center">
        <UDropdown v-if="selectedRows.length > 1" :items="actions" :ui="{ width: 'w-36' }">
          <UButton
            icon="i-lucide-chevron-down"
            trailing
            color="gray"
            size="xs"
          >
            Mark as
          </UButton>
        </UDropdown>

        <USelectMenu v-model="selectedColumns" :options="excludeSelectColumn" multiple>
          <UButton
            icon="i-lucide-columns-2"
            color="gray"
            size="xs"
          >
            Columns
          </UButton>
        </USelectMenu>

        <UButton
          icon="i-lucide-filter"
          color="gray"
          size="xs"
          :disabled="search === '' && selectedStatus.length === 0"
          @click="resetFilters"
        >
          Reset
        </UButton>
      </div>
    </div> -->

    <!-- Table -->
    <UTable
      v-model:sort="sort"
      :rows="records || []"
      :columns="columns"
      :loading="status === 'pending'"
      sort-asc-icon="i-lucide-arrow-up"
      sort-desc-icon="i-lucide-arrow-down"
      sort-mode="manual"
      class="w-full"
      :ui="{ td: { base: 'max-w-[0] truncate' } }"
    >
      <template #method-data="{ row }">
        <span>{{ fmtMethod(row.method) }}</span>
      </template>

      <template #timestamp-data="{ row }">
        <span class="font-mono">{{ fmtTs(row.timestamp) }}</span>
      </template>

      <template #suspicious-data="{ row }">
        <UBadge size="xs" :label="row.suspicious ? 'Suspicious' : 'OK'" :color="row.suspicious ? 'red' : 'gray'" variant="subtle" />
      </template>
    </UTable>

    <!-- Number of rows & Pagination -->
    <template #footer>
      <div class="flex flex-wrap justify-between items-center">
        <div>
          <span class="text-sm leading-5">
            Showing
            <span class="font-medium">{{ pageFrom }}</span>
            to
            <span class="font-medium">{{ pageTo }}</span>
            of
            <span class="font-medium">{{ pageTotal }}</span>
            results
          </span>
        </div>

        <div class="flex gap-x-4">
        <div class="flex items-center gap-1.5">
        <span class="text-sm leading-5">Rows per page:</span>

        <USelect
          v-model="pageCount"
          :options="[10, 25, 50, 100]"
          class="me-2 w-20"
          size="xs"
        />
      </div>

        <UPagination
          v-model="page"
          :page-count="pageCount"
          :total="pageTotal"
          :ui="{
            wrapper: 'flex items-center ',
            rounded: 'min-w-[32px] justify-center',
            default: {
              activeButton: {
                variant: 'outline'
              }
            }
          }"
        />
      </div>
      </div>
    </template>
  </UCard>
</template>