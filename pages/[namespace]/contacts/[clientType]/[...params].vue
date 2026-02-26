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
const loading = ref(false);
const isTagsModalOpen = ref(false);
const isSegmentsModalOpen = ref(false);
const isIdentitiesModalOpen = ref(false);
const selectedClientId = ref<string | null>(null);
const searchQuery = ref('');
const selectedTags = ref<string[]>([]);
const useMockData = ref(true);

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
    
    router.push(`/${nsSlug.value}/contacts/${newType.toLowerCase()}/1-20`);
  },
});

const filteredClients = computed(() => {
  let result = clients.value;
  
  // Filter by type
  if (clientTypeFilter.value !== 'ALL') {
    result = result.filter((c) => c.client.clientType === clientTypeFilter.value);
  }
  
  // Filter by search query
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter((c) => {
      const name = c.client.clientType === 'INDIVIDUAL' && c.individual
        ? `${c.individual.lastName} ${c.individual.firstName} ${c.individual.middleName || ''}`.toLowerCase()
        : (c.legalEntity?.legalName || '').toLowerCase();
      
      return name.includes(query) || 
             (c.legalEntity?.binIin || '').toLowerCase().includes(query);
    });
  }
  
  // Filter by tags (when implemented)
  if (selectedTags.value.length > 0) {
    // TODO: Filter by tags when backend supports it
  }
  
  return result;
});

// Calculate total pages for validation
const totalPages = computed(() => Math.ceil(filteredClients.value.length / pageSize.value));

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
    router.replace(`/${nsSlug.value}/contacts/${clientTypeFilter.value.toLowerCase()}/1-20`);
  } else if (outOfBounds) {
    // Page is beyond available pages
    const maxPage = totalPages.value || 1;
    router.replace(`/${nsSlug.value}/contacts/${clientTypeFilter.value.toLowerCase()}/${maxPage}-${pageSize.value}`);
  }
}, { immediate: true });

async function loadClients() {
  if (useMockData.value) {
    clients.value = mockClients;
    return;
  }
  
  if (!token.value || !selectedNS.value) return;
  const { ensure } = useContactsToken();
  const contactsToken = await ensure(selectedNS.value, token.value);
  if (!contactsToken) return;
  
  try {
    loading.value = true;
    const data = await contactsListClients(contactsToken, selectedNS.value);
    clients.value = data.rows;
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
  
  router.push(`/${nsSlug.value}/contacts/${clientTypeFilter.value.toLowerCase()}/${newPage}-${newPageSize}`);
}

function handleRowClick(row: ClientRow) {
  // Check visibility before navigation (client-side only)
  if (process.client && document.visibilityState !== 'visible') return;
  
  router.push(`/${selectedNS.value}/contacts/${row.client.id}`);
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
            @click="isTagsModalOpen = true"
          >
            {{ t('common.contacts.tags') }}
          </UButton>
          <UButton 
            icon="lucide:boxes" 
            size="xs"
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
          <span class="text-sm text-gray-500 dark:text-gray-400 ml-2">
            {{ t('common.contacts.clients').toLowerCase() }}: {{ filteredClients.length }} 
          </span>
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

    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center py-16 px-4">
      <div class="text-center">
        <UIcon name="lucide:loader" class="w-8 h-8 mx-auto text-gray-400 animate-spin mb-4" />
        <p class="text-gray-600 dark:text-gray-400">{{ t('common.loading') }}</p>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else-if="clients.length === 0" class="flex-1 h-full px-4 pb-safe-or-4 flex flex-col items-center justify-center">
      <div class="max-w-sm w-full bg-white dark:bg-gray-900 rounded-2xl shadow-lg p-6 flex flex-col items-center border border-gray-200 dark:border-gray-800">
        <div class="mb-3 flex flex-col items-center">
          <UIcon name="lucide:users" class="w-12 h-12 text-blue-400 dark:text-blue-300 mb-2" />
          <h2 class="text-xl font-bold text-center mb-1 text-gray-900 dark:text-white">
            {{ t('common.contacts.noClients') }}
          </h2>
          <p class="text-sm text-gray-600 dark:text-gray-400 text-center mb-3">
            {{ t('common.contacts.createClient') }}
          </p>
        </div>
        <UButton
          color="primary"
          size="md"
          class="w-full"
          :to="`/${nsSlug}/contacts/new`"
        >
          {{ t('common.contacts.createClient') }}
        </UButton>
      </div>
    </div>

    <!-- Table -->
    <div v-else class="px-4 pb-safe-or-4">
      <ClientsTable 
        :clients="filteredClients" 
        :loading="loading"
        :page="page"
        :page-size="pageSize"
        v-model:search-query="searchQuery"
        v-model:selected-tags="selectedTags"
        @update:page="(newPage) => updateRoute(newPage, pageSize)"
        @update:page-size="(newPageSize) => updateRoute(1, newPageSize)"
        @row-click="handleRowClick"
      />
    </div>

    <!-- Tags Modal -->
    <TagsModal
      :is-open="isTagsModalOpen"
      @close="isTagsModalOpen = false"
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
