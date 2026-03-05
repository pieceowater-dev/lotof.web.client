<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue';
import { useI18n } from '@/composables/useI18n';
import type { ClientRow } from '@/api/contacts/listClients';
import FinderStyleSearch from './FinderStyleSearch.vue';

const { t } = useI18n();

const props = defineProps<{
  clients: ClientRow[];
  loading?: boolean;
  searchQuery?: string;
  selectedTags?: Array<{ id: string; name: string }>;
  page?: number;
  pageSize?: number;
  totalPages?: number;
  totalItems?: number;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
  nsSlug?: string;
}>();

const emit = defineEmits<{
  (e: 'rowClick', client: ClientRow): void;
  (e: 'update:searchQuery', value: string): void;
  (e: 'update:selectedTags', value: Array<{ id: string; name: string }>): void;
  (e: 'update:page', value: number): void;
  (e: 'update:pageSize', value: number): void;
  (e: 'update:sort', value: { field: string; direction: 'asc' | 'desc' }): void;
  (e: 'openTagsModal', clientId: string): void;
}>();

// Local state for pagination that syncs with props
const localPage = ref<number>(props.page ?? 1);
const localPageSize = ref<number>(props.pageSize ?? 20);

// Sync local state with props changes
watch(() => props.page, (newPage) => {
  if (newPage !== undefined) localPage.value = newPage;
});

watch(() => props.pageSize, (newPageSize) => {
  if (newPageSize !== undefined) {
    const numValue = typeof newPageSize === 'number' ? newPageSize : parseInt(String(newPageSize), 10);
    localPageSize.value = numValue;
  }
});

// Emit events when local state changes
watch(localPage, (newPage) => {
  // Client-side only: Prevent view transition errors when document is hidden
  if (process.client) {
    if (document.visibilityState !== 'visible') {
      // Defer update until document becomes visible
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          emit('update:page', newPage);
          document.removeEventListener('visibilitychange', handleVisibilityChange);
        }
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);
      return;
    }
  }
  emit('update:page', newPage);
});

watch(localPageSize, (newPageSize) => {
  // Ensure it's always a number
  const numValue = typeof newPageSize === 'number' ? newPageSize : parseInt(String(newPageSize), 10);
  // Client-side only: Prevent view transition errors when document is hidden
  if (process.client) {
    if (document.visibilityState !== 'visible') {
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          emit('update:pageSize', numValue);
          document.removeEventListener('visibilitychange', handleVisibilityChange);
        }
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);
      return;
    }
  }
  emit('update:pageSize', numValue);
});

const page = computed<number>(() => localPage.value);

const pageSize = computed<number>(() => localPageSize.value);

const totalItems = computed<number>(() => props.totalItems ?? props.clients.length);
const resolvedTotalPages = computed<number>(() => {
  if (props.totalPages && props.totalPages > 0) return props.totalPages;
  return Math.max(1, Math.ceil(totalItems.value / pageSize.value));
});

interface ColumnDef {
  key: string;
  label: string;
  width: number;
  minWidth: number;
  sortable?: boolean;
}

const STORAGE_KEY = 'contacts-table-columns';

const defaultColumns: ColumnDef[] = [
  { key: 'type', label: 'Type', width: 50, minWidth: 50, sortable: false },
  { key: 'createdAt', label: 'Created', width: 160, minWidth: 140, sortable: true },
  { key: 'name', label: 'Name', width: 240, minWidth: 150, sortable: true },
  { key: 'identifier', label: 'BIN/IIN', width: 140, minWidth: 120, sortable: false },
  { key: 'additionalInfo', label: 'Info', width: 180, minWidth: 140, sortable: false },
  { key: 'status', label: 'Status', width: 110, minWidth: 90, sortable: false },
  { key: 'tags', label: 'Tags', width: 180, minWidth: 120, sortable: false },
  { key: 'updatedAt', label: 'Updated', width: 160, minWidth: 140, sortable: true },
];

const columns = ref<ColumnDef[]>([...defaultColumns]);

const pageSizeOptions = [
  { value: 10, label: '10' },
  { value: 20, label: '20' },
  { value: 50, label: '50' },
  { value: 100, label: '100' }
];

// Sorting state
const sortBy = ref<string | null>(props.sortField ?? 'createdAt');
const sortDirection = ref<'asc' | 'desc'>(props.sortDirection ?? 'desc');

watch(() => props.sortField, (newField) => {
  if (newField) sortBy.value = newField;
});

watch(() => props.sortDirection, (newDirection) => {
  if (newDirection) sortDirection.value = newDirection;
});

// Sorting is server-driven
const sortedClients = computed(() => props.clients);

// Pagination: Use clients as-is from backend (already paginated)
// Don't re-slice, backend already returned correct page
const paginatedClients = computed(() => sortedClients.value);

const pageFrom = computed(() => {
  if (props.clients.length === 0) return 0;
  return (page.value - 1) * pageSize.value + 1;
});

const pageTo = computed(() => {
  return pageFrom.value + props.clients.length - 1;
});

// Sort handler
function handleSort(columnKey: string) {
  // Don't sort while resizing
  if (resizing.value) return;
  
  const column = columns.value.find(c => c.key === columnKey);
  if (!column?.sortable) return;
  
  if (sortBy.value === columnKey) {
    // Toggle direction
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
  } else {
    // New column
    sortBy.value = columnKey;
    sortDirection.value = 'asc';
  }

  emit('update:sort', { field: columnKey, direction: sortDirection.value });
  
  // Reset to page 1 when sorting changes
  localPage.value = 1;
}

// Reset to page 1 when clients change or page is out of bounds
watch(() => sortedClients.value.length, () => {
  if (localPage.value > (props.totalPages ?? 1) && (props.totalPages ?? 0) > 0) {
    localPage.value = 1;
  }
});

// Load column widths from localStorage
onMounted(() => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const savedColumns = JSON.parse(saved);
      columns.value = columns.value.map((col) => {
        const savedCol = savedColumns.find((s: any) => s.key === col.key);
        return savedCol ? { ...col, width: savedCol.width } : col;
      });
    }
  } catch (e) {
    console.error('Failed to load column widths', e);
  }
  
  // Update labels
  columns.value = columns.value.map((col) => ({
    ...col,
    label: t(`common.contacts.${col.key}`) || col.label,
  }));
});

// Save column widths to localStorage
function saveColumnWidths() {
  try {
    const toSave = columns.value.map((col) => ({ key: col.key, width: col.width }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch (e) {
    console.error('Failed to save column widths', e);
  }
}

// Resize handling
const resizing = ref<{ index: number; startX: number; startWidth: number } | null>(null);

function startResize(index: number, event: MouseEvent) {
  event.preventDefault();
  resizing.value = {
    index,
    startX: event.clientX,
    startWidth: columns.value[index].width,
  };
  document.addEventListener('mousemove', handleResize);
  document.addEventListener('mouseup', stopResize);
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
}

function handleResize(event: MouseEvent) {
  if (!resizing.value) return;
  const diff = event.clientX - resizing.value.startX;
  const newWidth = Math.max(
    columns.value[resizing.value.index].minWidth,
    resizing.value.startWidth + diff
  );
  columns.value[resizing.value.index].width = newWidth;
}

function stopResize() {
  if (resizing.value) {
    saveColumnWidths();
    resizing.value = null;
  }
  document.removeEventListener('mousemove', handleResize);
  document.removeEventListener('mouseup', stopResize);
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
}

function getClientName(client: ClientRow): string {
  if (client.client.clientType === 'INDIVIDUAL' && client.individual) {
    const parts = [
      client.individual.lastName,
      client.individual.firstName,
      client.individual.middleName,
    ].filter(Boolean);
    return parts.join(' ');
  }
  return client.legalEntity?.legalName || '—';
}

function getClientIdentifier(client: ClientRow): string {
  if (client.client.clientType === 'LEGAL' && client.legalEntity?.binIin) {
    return client.legalEntity.binIin;
  }
  return '—';
}

function getAdditionalInfo(client: ClientRow): string {
  if (client.client.clientType === 'INDIVIDUAL' && client.individual?.birthDate) {
    return new Date(client.individual.birthDate).toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
  if (client.client.clientType === 'LEGAL' && client.legalEntity?.brandName) {
    return client.legalEntity.brandName;
  }
  return '—';
}

function getStatusColor(status: string): 'green' | 'red' | 'gray' {
  switch (status) {
    case 'ACTIVE':
      return 'green';
    case 'BLOCKED':
      return 'red';
    case 'ARCHIVED':
      return 'gray';
    default:
      return 'gray';
  }
}

function getStatusLabel(status: string): string {
  const statusMap: Record<string, string> = {
    'ACTIVE': t('common.contacts.active'),
    'BLOCKED': t('common.contacts.blocked'),
    'ARCHIVED': t('common.contacts.archived'),
  };
  return statusMap[status] || status;
}

function getStatusBadgeClass(status: string): string {
  switch (status) {
    case 'ACTIVE':
      return 'px-2 py-1 rounded-full text-xs font-medium border bg-green-100 text-green-700 border-green-200 dark:bg-green-900/40 dark:text-green-100 dark:border-green-900/60';
    case 'BLOCKED':
      return 'px-2 py-1 rounded-full text-xs font-medium border bg-red-100 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-100 dark:border-red-900/60';
    case 'ARCHIVED':
      return 'px-2 py-1 rounded-full text-xs font-medium border bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-900/40 dark:text-gray-100 dark:border-gray-900/60';
    default:
      return 'px-2 py-1 rounded-full text-xs font-medium border bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-900/40 dark:text-gray-100 dark:border-gray-900/60';
  }
}

function handleRowClick(client: ClientRow) {
  emit('rowClick', client);
}

// Mock tags for now - will be replaced with real data from backend
function getClientTags(client: ClientRow): Array<{ id: string; name: string }> {
  return client.tags || [];
}

function openTagsModal(clientId: string) {
  emit('openTagsModal', clientId);
}

function addTagToFilter(tagId: string, tagName: string) {
  const tags = props.selectedTags || [];
  if (!tags.find(t => t.id === tagId)) {
    emit('update:selectedTags', [...tags, { id: tagId, name: tagName }]);
  }
}
</script>

<template>
  <div class="relative overflow-hidden rounded-xl shadow-lg ring-1 ring-gray-200 dark:ring-gray-800 bg-white dark:bg-gray-900">
    <!-- Finder-style search bar -->
    <div class="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-4 py-3">
      <FinderStyleSearch
        :selected-tags="selectedTags"
        :search-query="searchQuery"
        @update:selected-tags="(tags) => emit('update:selectedTags', tags)"
        @update:search-query="(query) => emit('update:searchQuery', query)"
      />
    </div>

    <!-- No blocking overlay to avoid table blinking on updates -->

    <!-- Table container with horizontal scroll -->
    <div 
      ref="tableBodyRef"
      class="overflow-x-auto overflow-y-auto max-h-[calc(100vh-360px)] relative"
    >
      <table class="w-full border-collapse min-w-[1200px]">
        <!-- Header -->
        <thead class="sticky top-0 z-10 bg-gray-100 dark:bg-gray-800 shadow-md">
          <tr>
            <th
              v-for="(col, index) in columns"
              :key="col.key"
              :style="{ width: `${col.width}px`, minWidth: `${col.minWidth}px` }"
              :class="[
                'relative px-4 py-2 text-left text-xs font-semibold text-gray-800 dark:text-gray-100 uppercase tracking-wider border-r-[3px] border-gray-400 dark:border-gray-500 last:border-r-0 bg-gray-100 dark:bg-gray-800',
                col.sortable && 'cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors'
              ]"
              @click="col.sortable ? handleSort(col.key) : undefined"
            >
              <div class="flex items-center gap-1">
                <span>{{ t(`common.contacts.${col.key}`) }}</span>
                <UIcon 
                  v-if="col.sortable && sortBy === col.key"
                  :name="sortDirection === 'asc' ? 'lucide:arrow-up' : 'lucide:arrow-down'"
                  class="w-3 h-3"
                />
                <UIcon 
                  v-else-if="col.sortable"
                  name="lucide:arrow-up-down"
                  class="w-3 h-3 opacity-30"
                />
              </div>
              
              <!-- Resize handle -->
              <div
                v-if="index < columns.length - 1"
                class="absolute top-0 -right-[1.5px] w-[3px] h-full cursor-col-resize bg-gray-400 dark:bg-gray-500 hover:bg-blue-500 active:bg-blue-600 transition-colors z-20"
                @mousedown="startResize(index, $event)"
                @click.stop
                :title="t('common.contacts.resizeColumns') || 'Drag to resize'"
              />
            </th>
          </tr>
        </thead>

        <!-- Body -->
        <tbody class="divide-y divide-gray-200 dark:divide-gray-800">
          <!-- Loading skeleton -->
          <template v-if="loading">
            <tr
              v-for="i in pageSize"
              :key="`skeleton-${i}`"
              class="animate-pulse"
            >
              <td
                v-for="(col, colIndex) in columns"
                :key="`skeleton-${i}-${col.key}`"
                :style="{ width: `${col.width}px` }"
                class="px-4 py-3"
              >
                <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded" :class="colIndex === 0 ? 'w-6' : colIndex === 2 ? 'w-32' : 'w-24'"></div>
              </td>
            </tr>
          </template>

          <!-- Empty state -->
          <tr v-else-if="paginatedClients.length === 0">
            <td :colspan="columns.length" class="px-4 py-12 text-center">
              <div class="flex flex-col items-center justify-center text-gray-500 dark:text-gray-400">
                <UIcon name="lucide:inbox" class="w-12 h-12 mb-2 opacity-50" />
                <p>{{ t('common.contacts.noClients') }}</p>
              </div>
            </td>
          </tr>

          <!-- Data rows -->
          <tr
            v-else
            v-for="client in paginatedClients"
            :key="client.client.id"
            class="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
            @click="emit('rowClick', client)"
          >
            <!-- Type -->
            <td
              :style="{ width: `${columns[0].width}px` }"
              class="px-2 py-3 text-sm text-gray-600 dark:text-gray-300"
            >
              <div class="flex items-center justify-center">
                <UIcon 
                  :name="client.client.clientType === 'INDIVIDUAL' ? 'lucide:user' : 'lucide:building-2'" 
                  class="w-4 h-4"
                  :title="client.client.clientType === 'INDIVIDUAL' ? t('common.contacts.individual') : t('common.contacts.legalEntity')"
                />
              </div>
            </td>

            <!-- Created At -->
            <td
              :style="{ width: `${columns[1].width}px` }"
              class="px-4 py-3 text-sm text-gray-600 dark:text-gray-300"
            >
              <div class="truncate">
                {{ new Date(client.client.createdAt).toLocaleDateString('ru-RU', { 
                  year: 'numeric', 
                  month: 'short', 
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                }) }}
              </div>
            </td>

            <!-- Name -->
            <td
              :style="{ width: `${columns[2].width}px` }"
              class="px-4 py-3 text-sm font-medium"
            >
              <NuxtLink
                :to="`/${props.nsSlug}/contacts/${client.client.shortId || client.client.id}`"
                class="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline truncate block"
                :title="getClientName(client)"
              >
                {{ getClientName(client) }}
              </NuxtLink>
            </td>

            <!-- Identifier (BIN/IIN) -->
            <td
              :style="{ width: `${columns[3].width}px` }"
              class="px-4 py-3 text-sm text-gray-600 dark:text-gray-300"
            >
              <div class="truncate font-mono">{{ getClientIdentifier(client) }}</div>
            </td>

            <!-- Additional Info -->
            <td
              :style="{ width: `${columns[4].width}px` }"
              class="px-4 py-3 text-sm text-gray-600 dark:text-gray-300"
            >
              <div class="truncate">{{ getAdditionalInfo(client) }}</div>
            </td>

            <!-- Status -->
            <td
              :style="{ width: `${columns[5].width}px` }"
              class="px-4 py-3 text-sm"
            >
              <span :class="getStatusBadgeClass(client.client.status)">
                {{ getStatusLabel(client.client.status) }}
              </span>
            </td>

            <!-- Tags -->
            <td
              :style="{ width: `${columns[6].width}px` }"
              class="px-4 py-3 text-sm"
            >
              <div class="flex flex-wrap gap-1 items-center">
                <button
                  v-for="tag in getClientTags(client)"
                  :key="tag.id"
                  class="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-md bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                  @click.stop="addTagToFilter(tag.id, tag.name)"
                  :title="`Filter by ${tag.name}`"
                >
                  <UIcon name="lucide:tag" class="w-3 h-3 text-gray-500 dark:text-gray-400" />
                  <span>{{ tag.name }}</span>
                </button>
                <button
                  @click.stop="openTagsModal(client.client.id)"
                  class="inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  :title="getClientTags(client).length === 0 ? 'Add tag' : 'Add more tags'"
                >
                  <UIcon name="lucide:plus" class="w-3 h-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
                </button>
                <span v-if="getClientTags(client).length === 0" class="text-gray-400 text-xs">—</span>
              </div>
            </td>

            <!-- Updated At -->
            <td
              :style="{ width: `${columns[7].width}px` }"
              class="px-4 py-3 text-sm text-gray-600 dark:text-gray-300"
            >
              <div class="truncate">
                {{ new Date(client.client.updatedAt).toLocaleDateString('ru-RU', { 
                  year: 'numeric', 
                  month: 'short', 
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                }) }}
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Footer with pagination -->
    <div class="border-t-2 border-gray-300 dark:border-gray-600 px-4 py-3 bg-gray-100 dark:bg-gray-800">
      <div class="flex flex-wrap justify-between items-center gap-4">
        <!-- Left: Info -->
        <div class="text-xs text-gray-600 dark:text-gray-400">
          <span>
            {{ t('common.showing') }}
            <span class="font-medium text-gray-900 dark:text-white">{{ pageFrom }}</span>
            {{ t('common.to') }}
            <span class="font-medium text-gray-900 dark:text-white">{{ pageTo }}</span>
            {{ t('common.of') }}
            <span class="font-medium text-gray-900 dark:text-white">{{ totalItems }}</span>
            {{ t('common.contacts.clients').toLowerCase() }}
          </span>
        </div>

        <!-- Right: Pagination controls -->
        <div class="flex items-center gap-3">
          <!-- Page size selector -->
          <div class="flex items-center gap-2">
            <span class="text-xs text-gray-600 dark:text-gray-400">{{ t('common.rowsPerPage') }}</span>
            <USelect 
              :model-value="localPageSize" 
              @update:model-value="(val) => localPageSize = typeof val === 'number' ? val : parseInt(String(val), 10)"
              :options="pageSizeOptions" 
              option-attribute="label"
              value-attribute="value"
              size="xs"
              class="w-20"
            />
          </div>

          <!-- Pagination -->
          <UPagination
            v-model="localPage"
            :total="totalItems"
            :page-count="pageSize"
            size="xs"
            :show-last="true"
            :show-first="true"
            :max="7"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Smooth scrolling for both axes */
.overflow-x-auto,
.overflow-y-auto {
  scroll-behavior: smooth;
  scrollbar-width: thin;
  scrollbar-color: rgb(209, 213, 219) transparent;
}

.dark .overflow-x-auto,
.dark .overflow-y-auto {
  scrollbar-color: rgb(55, 65, 81) transparent;
}

.overflow-x-auto::-webkit-scrollbar,
.overflow-y-auto::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.overflow-x-auto::-webkit-scrollbar-track,
.overflow-y-auto::-webkit-scrollbar-track {
  background: transparent;
}

.overflow-x-auto::-webkit-scrollbar-thumb,
.overflow-y-auto::-webkit-scrollbar-thumb {
  background-color: rgb(209, 213, 219);
  border-radius: 4px;
}

.dark .overflow-x-auto::-webkit-scrollbar-thumb,
.dark .overflow-y-auto::-webkit-scrollbar-thumb {
  background-color: rgb(55, 65, 81);
}

.overflow-x-auto::-webkit-scrollbar-thumb:hover,
.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background-color: rgb(156, 163, 175);
}

.dark .overflow-x-auto::-webkit-scrollbar-thumb:hover,
.dark .overflow-y-auto::-webkit-scrollbar-thumb:hover {
  background-color: rgb(75, 85, 99);
}

/* Resize handle hover effect */
.group:hover {
  background-color: rgba(59, 130, 246, 0.5);
}
</style>
