<script lang="ts" setup>
import { atraceRecordsByPost, type AtraceRecord } from '@/api/atrace/record/listByPost';
import { CookieKeys } from '@/utils/storageKeys';
import { useAtraceToken } from '@/composables/useAtraceToken';
import { useI18n } from '@/composables/useI18n';
import AppTable from '@/components/ui/AppTable.vue';

const props = defineProps<{ postId?: string | null }>();

const { t } = useI18n();

// Columns for Nuxt UI table
const columns = [
  { key: 'timestamp', label: t('common.datetime'), sortable: true },
  { key: 'username', label: t('common.username'), sortable: false },
  { key: 'email', label: t('common.email'), sortable: false },
  { key: 'method', label: t('common.method'), sortable: false },
  { key: 'suspicious', label: t('common.suspicious'), sortable: false },
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

// Token from cookie (centralized)
const { current: currentAtraceToken } = useAtraceToken();

// Data loader
const { data: records, status, refresh } = await useLazyAsyncData<AtraceRecord[]>(
  'atrace:records',
  async () => {
    if (!props.postId) return [];
    const token = currentAtraceToken();
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
  const key = `app.methodLabels.${method}`;
  const label = t(key);
  return label === key
    ? method.replace(/^METHOD_/, '').replace(/_/g, ' ')
    : label;
}
</script>

<template>
  <div class="w-full h-full flex flex-col min-h-0">
    <!-- Table -->
    <AppTable
      v-model:sort="sort"
      v-model:page="page"
      v-model:pageCount="pageCount"
      :total="pageTotal"
      :rows="records || []"
      :columns="columns"
      :loading="status === 'pending'"
      :pagination="true"
    >
      <template #method-data="{ row }">
        <span>{{ fmtMethod(row.method) }}</span>
      </template>

      <template #timestamp-data="{ row }">
        <span class="font-mono">{{ fmtTs(row.timestamp) }}</span>
      </template>

      <template #suspicious-data="{ row }">
        <UBadge
          size="xs"
          :label="row.suspicious ? t('common.suspicious') : t('common.ok')"
          :color="row.suspicious ? 'red' : 'gray'"
          variant="subtle"
          :title="row.suspicious ? t('common.suspiciousReasons') : ''"
        />
      </template>
    </AppTable>
  </div>
</template>