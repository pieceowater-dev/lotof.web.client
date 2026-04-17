<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue';
import { useI18n } from '@/composables/useI18n';
import type { ClientRow } from '@/api/contacts/listClients';
import { formatDisplayPhoneUniversal } from '@/utils/phone';
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
  resolvedNames?: Record<string, string>;
}>();

const emit = defineEmits<{
  (e: 'rowClick', client: ClientRow): void;
  (e: 'update:searchQuery', value: string): void;
  (e: 'update:selectedTags', value: Array<{ id: string; name: string }>): void;
  (e: 'update:page', value: number): void;
  (e: 'update:pageSize', value: number): void;
  (e: 'update:sort', value: { field: string; direction: 'asc' | 'desc' }): void;
  (e: 'openTagsModal', clientId: string): void;
  (e: 'saveName', payload: {
    clientId: string;
    clientType: 'INDIVIDUAL' | 'LEGAL';
    firstName?: string;
    lastName?: string;
    middleName?: string;
    legalName?: string;
  }): void;
  (e: 'savePrimaryPhone', payload: { clientId: string; phone: string }): void;
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

const totalItems = computed<number>(() => props.totalItems ?? props.clients.length);
const resolvedTotalPages = computed<number>(() => {
  if (props.totalPages && props.totalPages > 0) return props.totalPages;
  return Math.max(1, Math.ceil(totalItems.value / localPageSize.value));
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
  { key: 'name', label: 'Name', width: 280, minWidth: 220, sortable: true },
  { key: 'contacts', label: 'Contacts', width: 340, minWidth: 260, sortable: false },
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
  return (localPage.value - 1) * localPageSize.value + 1;
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
    label: t(`contacts.${col.key}`) || col.label,
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

const editingNameClientId = ref<string | null>(null);
const editingPhoneClientId = ref<string | null>(null);
const editFirstName = ref('');
const editLastName = ref('');
const editMiddleName = ref('');
const editLegalName = ref('');
const editPhone = ref('');

function getIdentities(client: ClientRow) {
  return client.contacts || [];
}

function getPrimaryPhone(client: ClientRow) {
  const identities = getIdentities(client);
  return identities.find((item) => item.type === 'phone' && item.isPrimary) || identities.find((item) => item.type === 'phone');
}

function getPrimaryPhoneDisplay(client: ClientRow): string {
  const value = getPrimaryPhone(client)?.value || '';
  return value ? formatDisplayPhoneUniversal(value) : '—';
}

function getOtherContacts(client: ClientRow): Array<{ type: string; value: string }> {
  return getIdentities(client)
    .filter((item) => item.type !== 'phone')
    .map((item) => {
      const displayValue = (item.type === 'company' || item.type === 'contact_person')
        ? (item.comments?.trim() || props.resolvedNames?.[item.value] || item.value)
        : item.value;
      return { type: item.type, value: displayValue };
    })
    .slice(0, 4);
}

function startEditName(client: ClientRow) {
  editingNameClientId.value = client.client.id;
  if (client.client.clientType === 'INDIVIDUAL') {
    editFirstName.value = client.individual?.firstName || '';
    editLastName.value = client.individual?.lastName || '';
    editMiddleName.value = client.individual?.middleName || '';
    return;
  }
  editLegalName.value = client.legalEntity?.legalName || '';
}

function cancelEditName() {
  editingNameClientId.value = null;
}

function saveEditName(client: ClientRow) {
  if (client.client.clientType === 'INDIVIDUAL') {
    emit('saveName', {
      clientId: client.client.id,
      clientType: 'INDIVIDUAL',
      firstName: editFirstName.value,
      lastName: editLastName.value,
      middleName: editMiddleName.value,
    });
  } else {
    emit('saveName', {
      clientId: client.client.id,
      clientType: 'LEGAL',
      legalName: editLegalName.value,
    });
  }
  editingNameClientId.value = null;
}

function startEditPrimaryPhone(clientId: string) {
  const client = props.clients.find((item) => item.client.id === clientId);
  editingPhoneClientId.value = clientId;
  editPhone.value = client ? getPrimaryPhone(client)?.value || '' : '';
}

function cancelEditPrimaryPhone() {
  editingPhoneClientId.value = null;
  editPhone.value = '';
}

function saveEditPrimaryPhone(clientId: string) {
  emit('savePrimaryPhone', { clientId, phone: editPhone.value });
  editingPhoneClientId.value = null;
}

function contactTypeLabel(type: string): string {
  if (type === 'email') return t('contacts.email');
  if (type === 'telegram') return t('contacts.telegram');
  if (type === 'whatsapp') return t('contacts.whatsapp');
  if (type === 'website') return t('contacts.website');
  return type;
}

function getAdditionalInfo(client: ClientRow): string {
  const fromProfile = client.additionalInfo?.trim();
  if (fromProfile) {
    return fromProfile;
  }
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

function getStatusColor(status: string): 'emerald' | 'red' | 'gray' {
  switch (status) {
    case 'ACTIVE':
      return 'emerald';
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
    'ACTIVE': t('contacts.active'),
    'BLOCKED': t('contacts.blocked'),
    'ARCHIVED': t('contacts.archived'),
  };
  return statusMap[status] || status;
}

function getStatusBadgeClass(status: string): string {
  switch (status) {
    case 'ACTIVE':
      return 'px-2 py-1 rounded-full text-xs font-medium border bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-100 dark:border-emerald-900/60';
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
    <div data-tour="contacts-table-search" class="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-4 py-3">
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
                <span>{{ t(`contacts.${col.key}`) }}</span>
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
                class="absolute top-0 -right-[1.5px] w-[3px] h-full cursor-col-resize bg-gray-400 dark:bg-gray-500 hover:bg-emerald-500 active:bg-emerald-600 transition-colors z-20"
                :title="t('contacts.resizeColumns') || 'Drag to resize'"
                @mousedown="startResize(index, $event)"
                @click.stop
              />
            </th>
          </tr>
        </thead>

        <!-- Body -->
        <tbody class="divide-y divide-gray-200 dark:divide-gray-800">
          <!-- Loading skeleton -->
          <template v-if="loading">
            <tr
              v-for="i in localPageSize"
              :key="`skeleton-${i}`"
              class="animate-pulse"
            >
              <td
                v-for="(col, colIndex) in columns"
                :key="`skeleton-${i}-${col.key}`"
                :style="{ width: `${col.width}px` }"
                class="px-4 py-3"
              >
                <div
                  class="h-4 bg-gray-200 dark:bg-gray-700 rounded"
                  :class="colIndex === 0 ? 'w-6' : colIndex === 2 ? 'w-32' : 'w-24'"
                />
              </td>
            </tr>
          </template>

          <!-- Empty state -->
          <tr v-else-if="paginatedClients.length === 0">
            <td
              :colspan="columns.length"
              class="px-4 py-12 text-center"
            >
              <div class="flex flex-col items-center justify-center text-gray-500 dark:text-gray-400">
                <UIcon
                  name="lucide:inbox"
                  class="w-12 h-12 mb-2 opacity-50"
                />
                <p>{{ t('contacts.noClients') }}</p>
              </div>
            </td>
          </tr>

          <!-- Data rows -->
          <tr
            v-for="client in paginatedClients"
            v-else
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
                  :title="client.client.clientType === 'INDIVIDUAL' ? t('contacts.individual') : t('contacts.legalEntity')"
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
              @click.stop
            >
              <div
                v-if="editingNameClientId === client.client.id"
                class="space-y-2"
              >
                <template v-if="client.client.clientType === 'INDIVIDUAL'">
                  <UInput
                    v-model="editLastName"
                    size="xs"
                    :placeholder="t('contacts.lastName')"
                    @click.stop
                  />
                  <UInput
                    v-model="editFirstName"
                    size="xs"
                    :placeholder="t('contacts.firstName')"
                    @click.stop
                  />
                  <UInput
                    v-model="editMiddleName"
                    size="xs"
                    :placeholder="t('contacts.middleName')"
                    @click.stop
                  />
                </template>
                <template v-else>
                  <UInput
                    v-model="editLegalName"
                    size="xs"
                    :placeholder="t('contacts.legalName')"
                    @click.stop
                  />
                </template>
                <div class="flex items-center gap-2">
                  <UButton
                    size="xs"
                    color="primary"
                    variant="soft"
                    @click.stop="saveEditName(client)"
                  >
                    {{ t('common.save') }}
                  </UButton>
                  <UButton
                    size="xs"
                    color="gray"
                    variant="ghost"
                    @click.stop="cancelEditName"
                  >
                    {{ t('common.cancel') }}
                  </UButton>
                </div>
              </div>
              <div
                v-else
                class="flex items-center gap-2"
              >
                <NuxtLink
                  :to="`/${props.nsSlug}/contacts/${client.client.shortId || client.client.id}`"
                  class="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline truncate block"
                  :title="getClientName(client)"
                >
                  {{ getClientName(client) }}
                </NuxtLink>
                <UButton
                  icon="lucide:pencil"
                  size="xs"
                  color="gray"
                  variant="ghost"
                  @click.stop="startEditName(client)"
                />
              </div>
            </td>

            <!-- Contacts -->
            <td
              :style="{ width: `${columns[3].width}px` }"
              class="px-4 py-3 text-sm text-gray-600 dark:text-gray-300"
              @click.stop
            >
              <div class="space-y-1">
                <div
                  v-if="editingPhoneClientId === client.client.id"
                  class="space-y-2"
                >
                  <UInput
                    v-model="editPhone"
                    size="xs"
                    :placeholder="t('contacts.enterPhone')"
                    @click.stop
                  />
                  <p
                    v-if="editPhone.trim()"
                    class="text-xs text-gray-500 dark:text-gray-400"
                  >
                    {{ t('contacts.phonePreview') }}: {{ formatDisplayPhoneUniversal(editPhone) }}
                  </p>
                  <div class="flex items-center gap-2">
                    <UButton
                      size="xs"
                      color="primary"
                      variant="soft"
                      @click.stop="saveEditPrimaryPhone(client.client.id)"
                    >
                      {{ t('common.save') }}
                    </UButton>
                    <UButton
                      size="xs"
                      color="gray"
                      variant="ghost"
                      @click.stop="cancelEditPrimaryPhone"
                    >
                      {{ t('common.cancel') }}
                    </UButton>
                  </div>
                </div>
                <div
                  v-else
                  class="flex items-center gap-2"
                >
                  <span class="font-medium">{{ getPrimaryPhoneDisplay(client) }}</span>
                  <UButton
                    icon="lucide:pencil"
                    size="xs"
                    color="gray"
                    variant="ghost"
                    @click.stop="startEditPrimaryPhone(client.client.id)"
                  />
                </div>

                <div
                  v-if="getOtherContacts(client).length > 0"
                  class="flex flex-wrap gap-1"
                >
                  <span
                    v-for="contact in getOtherContacts(client)"
                    :key="`${client.client.id}-${contact.type}-${contact.value}`"
                    class="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                    :title="contact.value"
                  >
                    <template v-if="contact.type === 'company' || contact.type === 'contact_person'">{{ contact.value }}</template>
                    <template v-else>{{ contactTypeLabel(contact.type) }}: {{ contact.value }}</template>
                  </span>
                </div>
              </div>
            </td>

            <!-- Identifier (BIN/IIN) -->
            <td
              :style="{ width: `${columns[4].width}px` }"
              class="px-4 py-3 text-sm text-gray-600 dark:text-gray-300"
            >
              <div class="truncate font-mono">
                {{ getClientIdentifier(client) }}
              </div>
            </td>

            <!-- Additional Info -->
            <td
              :style="{ width: `${columns[5].width}px` }"
              class="px-4 py-3 text-sm text-gray-600 dark:text-gray-300"
            >
              <div class="truncate">
                {{ getAdditionalInfo(client) }}
              </div>
            </td>

            <!-- Status -->
            <td
              :style="{ width: `${columns[6].width}px` }"
              class="px-4 py-3 text-sm"
            >
              <span :class="getStatusBadgeClass(client.client.status)">
                {{ getStatusLabel(client.client.status) }}
              </span>
            </td>

            <!-- Tags -->
            <td
              :style="{ width: `${columns[7].width}px` }"
              class="px-3 py-2 text-sm group/tags"
              @click.stop
            >
              <div class="flex flex-wrap gap-1 items-center min-h-[24px]">
                <!-- Tag badges -->
                <button
                  v-for="tag in getClientTags(client)"
                  :key="tag.id"
                  class="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors cursor-pointer max-w-[110px]"
                  :title="`Filter by: ${tag.name}`"
                  @click.stop="addTagToFilter(tag.id, tag.name)"
                >
                  <span class="truncate">{{ tag.name }}</span>
                </button>

                <!-- Add tag button: no tags → text pill; has tags → icon on hover -->
                <button
                  v-if="getClientTags(client).length === 0"
                  class="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border border-dashed border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500 hover:border-emerald-400 hover:text-emerald-500 dark:hover:border-emerald-500 dark:hover:text-emerald-400 transition-colors"
                  title="Add tag"
                  @click.stop="openTagsModal(client.client.id)"
                >
                  <UIcon
                    name="lucide:plus"
                    class="w-3 h-3"
                  />
                  <span>tag</span>
                </button>
                <button
                  v-else
                  class="inline-flex items-center justify-center w-5 h-5 rounded-full border border-dashed border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500 hover:border-emerald-400 hover:text-emerald-500 dark:hover:border-emerald-500 dark:hover:text-emerald-400 transition-colors opacity-0 group-hover/tags:opacity-100"
                  title="Add tag"
                  @click.stop="openTagsModal(client.client.id)"
                >
                  <UIcon
                    name="lucide:plus"
                    class="w-3 h-3"
                  />
                </button>
              </div>
            </td>

            <!-- Updated At -->
            <td
              :style="{ width: `${columns[8].width}px` }"
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
            {{ t('contacts.clients').toLowerCase() }}
          </span>
        </div>

        <!-- Right: Pagination controls -->
        <div class="flex items-center gap-3">
          <!-- Page size selector -->
          <div class="flex items-center gap-2">
            <span class="text-xs text-gray-600 dark:text-gray-400">{{ t('common.rowsPerPage') }}</span>
            <USelect 
              :model-value="localPageSize" 
              :options="pageSizeOptions"
              option-attribute="label" 
              value-attribute="value"
              size="xs"
              class="w-20"
              @update:model-value="(val) => localPageSize = typeof val === 'number' ? val : parseInt(String(val), 10)"
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
