<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useContactsToken } from '@/composables/useContactsToken';
import { useRouter, useRoute } from 'vue-router';
import { logError } from '@/utils/logger';
import type { ClientRow } from '@/api/contacts/listClients';
import { contactsListClients } from '@/api/contacts/listClients';
import ClientsTable from '@/components/contacts/ClientsTable.vue';
import TagsModal from '@/components/contacts/TagsModal.vue';
import SegmentsModal from '@/components/contacts/SegmentsModal.vue';
import IdentitiesModal from '@/components/contacts/IdentitiesModal.vue';
import { useNamespace } from '@/composables/useNamespace';
import { mockClients } from '@/mock/contacts-clients';

const router = useRouter();
const route = useRoute();
const toast = useToast();
const { t } = useI18n();
const { token } = useAuth();
const { selected: selectedNS, titleBySlug } = useNamespace();

const clients = ref<ClientRow[]>([]);
const totalCount = ref(0);
const loading = ref(false);
const isTagsModalOpen = ref(false);
const isSegmentsModalOpen = ref(false);
const isIdentitiesModalOpen = ref(false);
const selectedClientId = ref<string | null>(null);
const selectedClientIdForTagsModal = ref<string | null>(null);
const searchQuery = ref('');
const selectedTags = ref<Array<{ id: string; name: string }>>([]);
const useMockData = ref(false);
const sortField = ref('createdAt');
const sortDirection = ref<'ASC' | 'DESC'>('DESC');

const nsSlug = computed(() => route.params.namespace as string);

// Valid page sizes
const validPageSizes = [10, 20, 50, 100];

// Parse client type from route
const currentClientType = computed(() => {
  const type = route.params.clientType as string;
  return type.toUpperCase() as 'ALL' | 'INDIVIDUAL' | 'LEGAL';
});

// Parse pagination from route: "1-20" becomes page=1, pageSize=20
const pageParts = computed(() => {
  const params = route.params.params as string[] | undefined;
  if (!params || params.length === 0) return { page: 1, pageSize: 20 };
  
  const pagination = params[0];
  const [pageStr, pageSizeStr] = pagination.split('-');
  let page = parseInt(pageStr, 10) || 1;
  let pageSize = parseInt(pageSizeStr, 10) || 20;
  
  // Validate pageSize - only allow predefined values
  if (!validPageSizes.includes(pageSize)) {
    pageSize = 20;
  }
  
  // Validate page - must be positive
  if (page < 1) {
    page = 1;
  }
  
  return { page, pageSize };
});

// Validate and redirect if pagination is invalid
const isValidPagination = computed(() => {
  const params = route.params.params as string[] | undefined;
  if (!params || params.length === 0) return true;
  
  const pagination = params[0];
  const [pageStr, pageSizeStr] = pagination.split('-');
  const page = parseInt(pageStr, 10);
  const pageSize = parseInt(pageSizeStr, 10);
  
  // Check if both parts are valid numbers
  if (isNaN(page) || isNaN(pageSize)) return false;
  // Check if page is positive
  if (page < 1) return false;
  // Check if pageSize is in valid list
  if (!validPageSizes.includes(pageSize)) return false;
  
  return true;
});

const page = computed({
  get: () => pageParts.value.page,
});

const pageSize = computed({
  get: () => pageParts.value.pageSize,
});

const clientTypeFilter = computed({
  get: () => currentClientType.value,
  set: (newType: 'ALL' | 'INDIVIDUAL' | 'LEGAL') => {
    // Check visibility before navigation (client-side only)
    if (process.client && document.visibilityState !== 'visible') return;
    
    // Preserve search query in URL
    const query = { ...route.query };
    router.push({ 
      path: `/${nsSlug.value}/contacts/${newType.toLowerCase()}/1-20`,
      query
    });
  },
});

// Backend handles filtering, so no need for local filtering
const filteredClients = computed(() => clients.value);

// Calculate total pages from backend count
const totalPages = computed(() => Math.ceil(totalCount.value / pageSize.value));

// Validate page against total pages
const isPageOutOfBounds = computed(() => {
  return page.value > totalPages.value && totalPages.value > 0;
});

const appTitle = computed(() => t('app.contacts') || 'Contacts');
const nsTitle = computed(() => titleBySlug(nsSlug.value) || nsSlug.value || '');
const pageTitle = computed(() => {
  return nsTitle.value ? `${appTitle.value} — ${nsTitle.value}` : appTitle.value;
});

useHead(() => ({
  title: pageTitle.value,
}));

onMounted(async () => {
  await loadClients();
});

// Watch for invalid pagination and redirect to valid URL
watch([isValidPagination, isPageOutOfBounds], ([invalidPagination, outOfBounds]) => {
  // Skip redirects if document is hidden to prevent view transition errors (client-side only)
  if (process.client && document.visibilityState !== 'visible') return;
  
  if (invalidPagination === false) {
    // Invalid pagination format/values
    router.replace({ 
      path: `/${nsSlug.value}/contacts/${clientTypeFilter.value.toLowerCase()}/1-20`
    });
  } else if (outOfBounds) {
    // Page is beyond available pages
    const maxPage = totalPages.value || 1;
    router.replace({ 
      path: `/${nsSlug.value}/contacts/${clientTypeFilter.value.toLowerCase()}/${maxPage}-${pageSize.value}`
    });
  }
}, { immediate: true });

// Watch for search query changes - reload clients from backend with new search
watch(searchQuery, async (newQuery) => {
  if (process.client && document.visibilityState !== 'visible') return;
  
  // Reset to page 1 when search changes
  if (page.value !== 1) {
    await router.push({ 
      path: `/${nsSlug.value}/contacts/${clientTypeFilter.value.toLowerCase()}/1-${pageSize.value}`
    });
    return;
  }

  await loadClients();
});

// Watch for route changes (pagination, filtering) - reload clients
watch(() => route.params, async () => {
  await loadClients();
}, { deep: true });

// Watch for selected tags changes - reload clients
watch(selectedTags, async () => {
  if (process.client && document.visibilityState !== 'visible') return;
  
  // Reset to page 1 when tag filter changes
  if (page.value !== 1) {
    await router.push({ 
      path: `/${nsSlug.value}/contacts/${clientTypeFilter.value.toLowerCase()}/1-${pageSize.value}`
    });
    return;
  }

  await loadClients();
}, { deep: true });

async function loadClients() {
  if (useMockData.value) {
    clients.value = mockClients;
    totalCount.value = mockClients.length;
    return;
  }
  
  if (!token.value || !selectedNS.value) return;
  const { ensure } = useContactsToken();
  const contactsToken = await ensure(selectedNS.value, token.value);
  if (!contactsToken) return;
  
  try {
    loading.value = true;
    const filter: any = {};
    
    // Add search if present
    const normalizedSearch = searchQuery.value.trim();
    if (normalizedSearch.length >= 2) {
      filter.search = normalizedSearch;
    }
    
    // Add client type filter (pass to backend)
    if (clientTypeFilter.value !== 'ALL') {
      filter.clientType = clientTypeFilter.value;
    }
    
    // Add tag filter if tags are selected
    if (selectedTags.value && selectedTags.value.length > 0) {
      filter.tagIds = selectedTags.value.map(t => t.id);
    }
    
    // Add pagination
    filter.pagination = {
      page: page.value,
      length: pageSize.value === 10 ? 'TEN' :
              pageSize.value === 20 ? 'TWENTY' :
              pageSize.value === 50 ? 'FIFTY' :
              pageSize.value === 100 ? 'ONE_HUNDRED' : 'TWENTY',
    };

    // Add sorting (server-side)
    filter.sort = {
      field: sortField.value,
      by: sortDirection.value,
    };
    
    const data = await contactsListClients(contactsToken, selectedNS.value, filter);
    clients.value = data.rows;
    totalCount.value = data.info?.count || 0;
  } catch (error) {
    logError('Failed to load clients:', error);
    toast.add({
      title: t('common.error'),
      description: t('common.contacts.loadError'),
      color: 'red',
    });
  } finally {
    loading.value = false;
  }
}

async function handleSortUpdate(payload: { field: string; direction: 'asc' | 'desc' }) {
  sortField.value = payload.field;
  sortDirection.value = payload.direction === 'asc' ? 'ASC' : 'DESC';

  if (page.value !== 1) {
    await updateRoute(1, pageSize.value);
    return;
  }

  await loadClients();
}

function handleOpenTagsModal(clientId: string) {
  selectedClientIdForTagsModal.value = clientId;
  isTagsModalOpen.value = true;
}

function handleTagsModalClose() {
  isTagsModalOpen.value = false;
  selectedClientIdForTagsModal.value = null;
}

function updateRoute(newPage: number, newPageSize: number) {
  // Validate pageSize
  if (!validPageSizes.includes(newPageSize)) {
    newPageSize = 20;
  }
  
  // Validate page is positive
  if (newPage < 1) {
    newPage = 1;
  }
  
  // Validate page is not beyond available pages
  const validTotalPages = totalPages.value || 1;
  if (newPage > validTotalPages) {
    newPage = validTotalPages;
  }
  
  // Check if document is visible to prevent view transition errors (client-side only)
  if (process.client && document.visibilityState !== 'visible') {
    // Skip navigation if document is hidden
    return;
  }
  
  router.push({ 
    path: `/${nsSlug.value}/contacts/${clientTypeFilter.value.toLowerCase()}/${newPage}-${newPageSize}`
  });
}

function handleRowClick(row: ClientRow) {
  // Check visibility before navigation (client-side only)
  if (process.client && document.visibilityState !== 'visible') return;
  
  // Use shortId if available, fallback to UUID
  const clientId = row.client.shortId || row.client.id;
  router.push(`/${nsSlug.value}/contacts/${clientId}`);
}

async function handleClientCreated() {
  await loadClients();
  toast.add({
    title: t('common.success'),
    description: t('common.contacts.clientCreated'),
    color: 'green',
  });
}
</script>

<template>
  <div class="flex flex-col">
  
    <div class="flex justify-between items-center mb-4 mt-4 px-4 flex-shrink-0">
      <div class="text-left">
        <h1 class="text-2xl font-semibold">{{ t('app.contacts') }}</h1>
        <span class="text-sm text-gray-600 dark:text-gray-400">{{ t('app.contactsSubtitle') }}</span>
      </div>
      <div>
        <div class="flex gap-2">
          <UButton 
            icon="lucide:tag" 
            size="xs"
            color="primary" 
            variant="soft"
            @click="isTagsModalOpen = true"
          >
            {{ t('common.contacts.tags') }}
          </UButton>
          <UButton 
            icon="lucide:boxes" 
            size="xs"
            color="primary" 
            variant="soft"
            @click="isSegmentsModalOpen = true"
          >
            {{ t('common.contacts.segments') }}
          </UButton>
          <UButton 
            icon="lucide:settings" 
            size="xs" 
            color="primary" 
            variant="soft"
            :to="`/${nsSlug}/contacts/settings`"
          >
            {{ t('common.settings') }}
          </UButton>
        </div>
      </div>
    </div>

    <!-- Filters and Create Button -->
    <div class="px-4 py-4 flex-shrink-0">
      <div class="flex items-center justify-between gap-4 flex-wrap">
        <div class="flex items-center gap-2 overflow-x-auto">
          <button
            v-for="type in ['ALL', 'INDIVIDUAL', 'LEGAL']"
            :key="type"
            @click="clientTypeFilter = type as any"
            class="px-3 py-1.5 rounded-full text-sm font-medium border transition whitespace-nowrap"
            :class="clientTypeFilter === type
              ? 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-100 dark:border-blue-900/60'
              : 'bg-gray-50 dark:bg-gray-900/60 border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300'"
          >
            {{
              type === 'ALL'
                ? t('common.contacts.all')
                : type === 'INDIVIDUAL'
                  ? t('common.contacts.individual')
                  : t('common.contacts.legalEntity')
            }}
          </button>
        </div>
        <UButton
          icon="lucide:plus"
          size="sm"
          color="primary"
          variant="soft"
          :to="`/${nsSlug}/contacts/new`"
        >
          {{ t('common.contacts.createClient') }}
        </UButton>
      </div>
    </div>

    <!-- Loading State (only on initial load, not while having search) -->
    <div v-if="loading && clients.length === 0 && searchQuery === ''" class="flex items-center justify-center py-16 px-4">
      <div class="text-center">
        <UIcon name="lucide:loader" class="w-8 h-8 mx-auto text-gray-400 animate-spin mb-4" />
        <p class="text-gray-600 dark:text-gray-400">{{ t('common.loading') }}</p>
      </div>
    </div>

    <!-- Empty State (only when no clients exist AND no search) -->
    <div v-else-if="totalCount === 0 && searchQuery === '' && !loading" class="flex-1 flex items-center justify-center px-4 py-16">
      <div class="max-w-md w-full text-center">
        <!-- Icon with gradient background -->
        <div class="mb-6 flex justify-center">
          <div class="relative">
            <div class="absolute inset-0 bg-gradient-to-r from-blue-400 to-indigo-500 rounded-full blur-lg opacity-40"></div>
            <div class="relative bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-full p-6 border border-blue-200 dark:border-blue-800/50">
              <UIcon name="lucide:users" class="w-12 h-12 text-blue-600 dark:text-blue-400 mx-auto" />
            </div>
          </div>
        </div>
        
        <!-- Text content -->
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          {{ t('common.contacts.noClients') }}
        </h2>
        <p class="text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">
          {{ t('common.contacts.noClientsDescription') || 'Создавайте новых клиентов и управляйте всеми деталями их контактной информации в одном месте' }}
        </p>
        
        <!-- CTA Button -->
        <UButton
          icon="lucide:plus-circle"
          size="lg"
          color="primary"
          class="w-full"
          :to="`/${nsSlug}/contacts/new`"
        >
          {{ t('common.contacts.createFirstClient') || t('common.contacts.createClient') }}
        </UButton>
      </div>
    </div>

    <!-- Table (always shown when there's data or active search) -->
    <div v-else class="px-4 pb-safe-or-4">
      <ClientsTable 
        :clients="filteredClients" 
        :loading="loading"
        :page="page"
        :page-size="pageSize"
        :total-pages="totalPages"
        :total-items="totalCount"
        :sort-field="sortField"
        :sort-direction="sortDirection === 'ASC' ? 'asc' : 'desc'"
        :ns-slug="nsSlug"
        v-model:search-query="searchQuery"
        v-model:selected-tags="selectedTags"
        @update:page="(newPage) => updateRoute(newPage, pageSize)"
        @update:page-size="(newPageSize) => updateRoute(1, newPageSize)"
        @update:sort="handleSortUpdate"
        @row-click="handleRowClick"
        @open-tags-modal="handleOpenTagsModal"
      />
    </div>

    <!-- Tags Modal -->
    <TagsModal
      :is-open="isTagsModalOpen"
      mode="select"
      :client-id="selectedClientIdForTagsModal || undefined"
      @close="handleTagsModalClose"
      @tag-added="loadClients"
    />

    <!-- Segments Modal -->
    <SegmentsModal
      :is-open="isSegmentsModalOpen"
      @close="isSegmentsModalOpen = false"
    />

    <!-- Identities Modal -->
    <IdentitiesModal
      :is-open="isIdentitiesModalOpen"
      :client-id="selectedClientId || ''"
      @close="isIdentitiesModalOpen = false"
    />
  </div>
</template>

<style scoped>
.pb-safe-or-4 {
  padding-bottom: max(env(safe-area-inset-bottom), 1rem);
}
</style>
