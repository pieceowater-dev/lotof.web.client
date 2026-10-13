<script setup lang="ts">
import AppSkeleton from '@/components/ui/AppSkeleton.vue';
definePageMeta({ layout: 'workspace' });

import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useContactsToken } from '@/composables/useContactsToken';
import { useRouter, useRoute } from 'vue-router';
import { logError } from '@/utils/logger';
import type { ClientRow } from '@/api/contacts/listClients';
import { contactsListClients } from '@/api/contacts/listClients';
import { contactsCan } from '@/api/contacts/access';
import { exportClientsToXlsx } from '@/utils/exportClients';
import { getClientsBatch } from '@/api/contacts/getClient';
import { contactsUpdateIndividualClient, contactsUpdateLegalEntityClient } from '@/api/contacts/mutations';
import { updateIdentity, createIdentity } from '@/api/contacts/identities';
import { normalizePhoneForStorage, isPhoneInputValid } from '@/utils/phone';
import { listTags, applyContactTagsPreset } from '@/api/contacts/tags';
import { subscribeClientChanged } from '@/api/contacts/subscriptions';
import ClientsTable from '@/components/contacts/ClientsTable.vue';
import TagsModal from '@/components/contacts/TagsModal.vue';
import SegmentsModal from '@/components/contacts/SegmentsModal.vue';
import IdentitiesModal from '@/components/contacts/IdentitiesModal.vue';
import { useNamespace } from '@/composables/useNamespace';
import { useOnboarding } from '@/composables/useOnboarding';
import { contactsTour } from '@/config/tours';
import { mockClients } from '@/mock/contacts-clients';
import QuickSetupButton from '@/components/onboarding/QuickSetupButton.vue';
import type { BusinessType } from '@/config/businessTypes';

const router = useRouter();
const route = useRoute();
const toast = useToast();
const { t, locale } = useI18n();
const { token, user } = useAuth();
const { selected: selectedNS, titleBySlug, idBySlug } = useNamespace();
const { isCompleted, startTour } = useOnboarding();

const clients = ref<ClientRow[]>([]);
const totalCount = ref(0);
const loading = ref(false);
const resolvedNames = ref<Record<string, string>>({});
const isTagsModalOpen = ref(false);
const isSegmentsModalOpen = ref(false);
const isIdentitiesModalOpen = ref(false);
const selectedClientId = ref<string | null>(null);
const selectedClientIdForTagsModal = ref<string | null>(null);
// The search survives leaving the list and coming back (kept per namespace for the browser tab).
const searchMemoryKey = `contacts-search:${route.params.namespace}`;
const rememberedSearch = (): string => {
  try { return process.client ? sessionStorage.getItem(searchMemoryKey) || '' : ''; } catch { return ''; }
};
const searchQuery = ref((route.query.s as string) || rememberedSearch());
watch(searchQuery, (v) => {
  try { if (process.client) { if (v) sessionStorage.setItem(searchMemoryKey, v); else sessionStorage.removeItem(searchMemoryKey); } } catch { /* storage may be blocked */ }
});
const selectedTags = ref<Array<{ id: string; name: string }>>([]);
const isInitializingFromUrl = ref(false);
const useMockData = ref(false);
const sortField = ref('createdAt');
const sortDirection = ref<'ASC' | 'DESC'>('DESC');
const hasRemoteChanges = ref(false);

let stopClientsSubscription: (() => void) | null = null;

const nsSlug = computed(() => route.params.namespace as string);
const namespaceId = computed(() => idBySlug(nsSlug.value));

// Valid page sizes
const validPageSizes = [10, 20, 50, 100];

// Parse client type from route
const currentClientType = computed(() => {
  const type = (route.params.clientType as string | undefined) || 'all';
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

const page = computed<number>(() => pageParts.value.page);

const pageSize = computed<number>(() => pageParts.value.pageSize);

const markFilter = ref<'' | 'supplier' | 'vip' | 'problematic'>('');
watch(markFilter, () => { loadClients(); });

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

// Build URL query params from current filter state
function buildUrlQuery(): Record<string, string | string[]> {
  const query: Record<string, string | string[]> = {};
  const s = searchQuery.value.trim();
  if (s) query.s = s;
  if (selectedTags.value.length > 0) {
    query.t = selectedTags.value.map(tag => tag.name);
  }
  return query;
}

// Export copies the client list out of the system, so it is a capability of
// admins and owners only (the server decides; the button just follows).
const canExport = ref(false);
async function loadCapabilities(contactsToken: string | null) {
  if (!contactsToken || !selectedNS.value) return;
  try {
    canExport.value = !!(await contactsCan(contactsToken, selectedNS.value, ['contacts.client.export']))['contacts.client.export'];
  } catch (e) {
    logError('[contacts] capabilities failed', e);
  }
}
function exportClients() {
  if (!clients.value.length) return;
  exportClientsToXlsx(clients.value, {
    type: t('contacts.exportType'), name: t('contacts.exportName'), phones: t('contacts.exportPhones'), emails: t('contacts.exportEmails'),
    tags: t('contacts.exportTags'), status: t('contacts.exportStatus'), created: t('contacts.exportCreated'), notes: t('contacts.exportNotes'),
    individual: t('contacts.individual'), legal: t('contacts.legalEntity'), sheet: t('contacts.exportSheet'),
  });
}

onMounted(async () => {
  const { ensure } = useContactsToken();

  // Get token once and reuse across all init steps
  const contactsToken = (token.value && selectedNS.value)
    ? await ensure(selectedNS.value, token.value)
    : null;
  loadCapabilities(contactsToken);

  // Initialize selectedTags from ?t= URL params
  const t = route.query.t;
  if (t && contactsToken && selectedNS.value) {
    const tagNames = (Array.isArray(t) ? t : [t]) as string[];
    if (tagNames.length > 0) {
      isInitializingFromUrl.value = true;
      try {
        const data = await listTags(contactsToken, selectedNS.value);
        const allTags = data.tags.rows;
        const matched = tagNames
          .map(name => allTags.find(tag => tag.name === name))
          .filter(Boolean) as Array<{ id: string; name: string }>;
        if (matched.length > 0) selectedTags.value = matched;
      } catch {
        // ignore tag init errors
      } finally {
        isInitializingFromUrl.value = false;
      }
    }
  }

  await loadClients();
  await initClientsSubscription();

  if (process.client && !isCompleted(contactsTour.id)) {
    setTimeout(() => {
      startTour(contactsTour);
    }, 900);
  }
});

onBeforeUnmount(() => {
  if (stopClientsSubscription) {
    stopClientsSubscription();
    stopClientsSubscription = null;
  }
});

async function initClientsSubscription() {
  if (!token.value || !selectedNS.value) return;

  const { ensure } = useContactsToken();
  const contactsToken = await ensure(selectedNS.value, token.value);
  if (!contactsToken) return;

  if (stopClientsSubscription) {
    stopClientsSubscription();
    stopClientsSubscription = null;
  }

  stopClientsSubscription = subscribeClientChanged(
    contactsToken,
    selectedNS.value,
    (signal) => {
      const currentUserId = user.value?.id || '';
      if (signal.changedBy && currentUserId && signal.changedBy === currentUserId) return;
      hasRemoteChanges.value = true;
    },
    () => {
      // Keep page functional even if WS is temporarily unavailable.
    },
  );
}

// Watch for invalid pagination and redirect to valid URL
watch([isValidPagination, isPageOutOfBounds], ([invalidPagination, outOfBounds]) => {
  // Skip redirects if document is hidden to prevent view transition errors (client-side only)
  if (process.client && document.visibilityState !== 'visible') return;
  
  if (invalidPagination === false) {
    // Invalid pagination format/values
    router.replace({ 
      path: `/${nsSlug.value}/contacts/${clientTypeFilter.value.toLowerCase()}/1-20`,
      query: { ...route.query },
    });
  } else if (outOfBounds) {
    // Page is beyond available pages
    const maxPage = totalPages.value || 1;
    router.replace({ 
      path: `/${nsSlug.value}/contacts/${clientTypeFilter.value.toLowerCase()}/${maxPage}-${pageSize.value}`,
      query: { ...route.query },
    });
  }
}, { immediate: true });

// Watch for search query changes - update URL and reload
watch(searchQuery, async (newQuery) => {
  if (isInitializingFromUrl.value) return;
  if (process.client && document.visibilityState !== 'visible') return;

  // Reset to page 1 when search changes
  if (page.value !== 1) {
    await router.push({
      path: `/${nsSlug.value}/contacts/${clientTypeFilter.value.toLowerCase()}/1-${pageSize.value}`,
      query: buildUrlQuery(),
    });
    return;
  }

  await router.replace({ query: buildUrlQuery() });
  await loadClients();
});

// Watch for route changes (pagination, filtering) - reload clients
watch(() => route.params, async () => {
  await loadClients();
}, { deep: true });

watch([() => token.value, () => selectedNS.value], async () => {
  await initClientsSubscription();
});

// Watch for selected tags changes - update URL and reload
watch(selectedTags, async () => {
  if (isInitializingFromUrl.value) return;
  if (process.client && document.visibilityState !== 'visible') return;

  // Reset to page 1 when tag filter changes
  if (page.value !== 1) {
    await router.push({
      path: `/${nsSlug.value}/contacts/${clientTypeFilter.value.toLowerCase()}/1-${pageSize.value}`,
      query: buildUrlQuery(),
    });
    return;
  }

  await router.replace({ query: buildUrlQuery() });
  await loadClients();
}, { deep: true });

function getClientDisplayName(row: ClientRow | null | undefined): string {
  if (!row) return '';

  if (row.client.clientType === 'INDIVIDUAL' && row.individual) {
    return [row.individual.lastName, row.individual.firstName, row.individual.middleName]
      .filter(Boolean).join(' ').trim();
  }
  return (
    row.legalEntity?.legalName ||
    row.legalEntity?.brandName ||
    ''
  );
}

async function resolveRelatedClientNames(contactsToken: string, namespace: string, rows: ClientRow[]) {
  const uuids = Array.from(new Set(
    rows.flatMap((row) =>
      (row.contacts || [])
        .filter((c) => (c.type === 'company' || c.type === 'contact_person') && !c.comments?.trim() && c.value)
        .map((c) => c.value),
    ),
  ));
  if (uuids.length === 0) return;

  const uncached = uuids.filter((uuid) => !resolvedNames.value[uuid]);
  if (uncached.length === 0) return;

  try {
    const results = await getClientsBatch(contactsToken, namespace, uncached);
    const next: Record<string, string> = { ...resolvedNames.value };
    for (const [uuid, related] of Object.entries(results)) {
      const name = getClientDisplayName(related);
      if (name) next[uuid] = name;
    }
    resolvedNames.value = next;
  } catch {
    // ignore
  }
}

async function applyTagsPreset(businessType: BusinessType) {
  if (!token.value || !selectedNS.value) throw new Error('Not authenticated');
  const { ensure } = useContactsToken();
  const contactsToken = await ensure(selectedNS.value, token.value);
  if (!contactsToken) throw new Error('Not authenticated');
  await applyContactTagsPreset(contactsToken, selectedNS.value, businessType, locale.value);
}

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
    
    if (markFilter.value) {
      filter.mark = markFilter.value;
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

    // Resolve UUIDs for company/contact_person identities (fire-and-forget)
    resolveRelatedClientNames(contactsToken, selectedNS.value, data.rows);
  } catch (error) {
    logError('Failed to load clients:', error);
    toast.add({
      title: t('common.error'),
      description: t('contacts.loadError'),
      color: 'red',
    });
  } finally {
    loading.value = false;
  }
}

async function handleInlineSaveName(payload: {
  clientId: string;
  clientType: 'INDIVIDUAL' | 'LEGAL';
  firstName?: string;
  lastName?: string;
  middleName?: string;
  legalName?: string;
}) {
  if (!token.value || !selectedNS.value) return;

  const row = clients.value.find((item) => item.client.id === payload.clientId);
  if (!row) return;

  try {
    const { ensure } = useContactsToken();
    const contactsToken = await ensure(selectedNS.value, token.value);
    if (!contactsToken) return;

    if (payload.clientType === 'INDIVIDUAL') {
      await contactsUpdateIndividualClient(contactsToken, selectedNS.value, payload.clientId, {
        firstName: payload.firstName?.trim() || row.individual?.firstName || '',
        lastName: payload.lastName?.trim() || row.individual?.lastName || '',
        middleName: payload.middleName?.trim() || undefined,
        birthDate: row.individual?.birthDate || undefined,
        gender: row.individual?.gender ?? undefined,
      });
    } else {
      await contactsUpdateLegalEntityClient(contactsToken, selectedNS.value, payload.clientId, {
        legalName: payload.legalName?.trim() || row.legalEntity?.legalName || '',
        brandName: row.legalEntity?.brandName || undefined,
        binIin: row.legalEntity?.binIin || undefined,
        registrationCountry: row.legalEntity?.registrationCountry || undefined,
        registrationDate: row.legalEntity?.registrationDate || undefined,
      });
    }

    await loadClients();
    hasRemoteChanges.value = false;
    toast.add({ title: t('common.success'), description: t('contacts.clientDataUpdated'), color: 'emerald' });
  } catch (error) {
    logError('Failed to inline save name:', error);
    toast.add({ title: t('common.error'), description: t('contacts.updateError'), color: 'red' });
  }
}

async function handleInlineSavePrimaryPhone(payload: { clientId: string; phone: string }) {
  if (!token.value || !selectedNS.value) return;

  if (!payload.phone.trim() || !isPhoneInputValid(payload.phone)) {
    toast.add({ title: t('common.error'), description: t('contacts.invalidPhone'), color: 'red' });
    return;
  }

  try {
    const { ensure } = useContactsToken();
    const contactsToken = await ensure(selectedNS.value, token.value);
    if (!contactsToken) return;

    const row = clients.value.find((item) => item.client.id === payload.clientId);
    const identities = row?.contacts || [];
    const primaryPhone = identities.find((item) => item.type === 'phone' && item.isPrimary) || identities.find((item) => item.type === 'phone');
    const storedPhone = normalizePhoneForStorage(payload.phone);

    if (primaryPhone) {
      await updateIdentity(contactsToken, selectedNS.value, primaryPhone.id, storedPhone, primaryPhone.comments);
    } else {
      await createIdentity(contactsToken, selectedNS.value, payload.clientId, 'phone', storedPhone, true);
    }

    await loadClients();
    hasRemoteChanges.value = false;
    toast.add({ title: t('common.success'), description: t('contacts.contactDataUpdated'), color: 'emerald' });
  } catch (error) {
    logError('Failed to inline save primary phone:', error);
    toast.add({ title: t('common.error'), description: t('contacts.updateError'), color: 'red' });
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
    path: `/${nsSlug.value}/contacts/${clientTypeFilter.value.toLowerCase()}/${newPage}-${newPageSize}`,
    query: buildUrlQuery(),
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
  hasRemoteChanges.value = false;
  toast.add({
    title: t('common.success'),
    description: t('contacts.clientCreated'),
    color: 'emerald',
  });
}

async function handleRefreshFromRemote() {
  await loadClients();
  hasRemoteChanges.value = false;
}
</script>

<template>
  <div class="at-scope ct-scope h-full overflow-y-auto flex flex-col">
    <div class="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center mb-4 mt-4 px-4 flex-shrink-0">
      <div
        class="text-left min-w-0"
        data-tour="contacts-title"
      >
        <h1 class="text-2xl sm:text-3xl font-extrabold tracking-tight">
          {{ t('app.contacts') }}
        </h1>
        <span class="text-sm text-gray-600 dark:text-gray-400">{{ t('app.contactsSubtitle') }}</span>
      </div>
      <div class="min-w-0">
        <div class="flex flex-wrap gap-2">
          <UButton 
            icon="lucide:tag" 
            size="xs"
            color="primary" 
            variant="soft"
            @click="isTagsModalOpen = true"
          >
            {{ t('contacts.tags') }}
          </UButton>
          <!-- <UButton 
            icon="lucide:boxes" 
            size="xs"
            color="primary" 
            variant="soft"
            @click="isSegmentsModalOpen = true"
          >
            {{ t('contacts.segments') }}
          </UButton> -->
          <UButton
            icon="lucide:phone-call"
            size="xs"
            color="primary"
            variant="soft"
            :to="`/${nsSlug}/contacts/calls`"
          >
            {{ t('contacts.callsTitle') }}
          </UButton>
          <UButton
            icon="lucide:ticket"
            size="xs"
            color="primary"
            variant="soft"
            :to="`/${nsSlug}/contacts/memberships`"
          >
            {{ t('membership.nav') || 'Абонементы' }}
          </UButton>
          <UButton
            icon="lucide:settings"
            size="xs"
            color="primary"
            variant="soft"
            data-tour="contacts-settings-btn"
            :to="`/${nsSlug}/contacts/settings`"
          >
            {{ t('common.settings.title') }}
          </UButton>
        </div>
      </div>
    </div>

    <!-- Filters and Create Button -->
    <div class="px-4 py-4 flex-shrink-0">
      <div class="flex items-center justify-between gap-4 flex-wrap">
        <div
          class="flex items-center gap-2 overflow-x-auto"
          data-tour="contacts-type-filter"
        >
          <button
            v-for="type in ['ALL', 'INDIVIDUAL', 'LEGAL']"
            :key="type"
            class="pill-filter"
            :class="clientTypeFilter === type ? 'pill-filter--active' : ''"
            @click="clientTypeFilter = type as any"
          >
            {{
              type === 'ALL'
                ? t('contacts.all')
                : type === 'INDIVIDUAL'
                  ? t('contacts.individual')
                  : t('contacts.legalEntity')
            }}
          </button>
          <span class="w-px h-5 bg-gray-300 dark:bg-gray-600 mx-1" />
          <button
            v-for="m in (['supplier', 'vip', 'problematic'] as const)"
            :key="m"
            class="pill-filter"
            :class="markFilter === m ? 'pill-filter--active' : ''"
            @click="markFilter = markFilter === m ? '' : m"
          >
            {{ t(m === 'supplier' ? 'contacts.markSupplier' : m === 'vip' ? 'contacts.markVip' : 'contacts.markProblematic') }}
          </button>
        </div>
        <div class="flex items-center gap-2">
          <UButton
            v-if="hasRemoteChanges"
            icon="lucide:refresh-cw"
            size="sm"
            color="amber"
            variant="soft"
            @click="handleRefreshFromRemote"
          >
            {{ t('contacts.refreshUpdates') || 'Обновить' }}
          </UButton>
          <UButton
            v-if="canExport"
            icon="lucide:file-spreadsheet"
            size="sm"
            color="gray"
            variant="soft"
            class="hidden sm:inline-flex"
            :disabled="!clients.length"
            @click="exportClients"
          >
            {{ t('contacts.exportExcel') }}
          </UButton>
          <UButton
            icon="lucide:plus"
            size="sm"
            color="primary"
            variant="solid"
            data-tour="contacts-create-btn"
            :to="`/${nsSlug}/contacts/new`"
          >
            {{ t('contacts.createClient') }}
          </UButton>
        </div>
      </div>
    </div>

    <!-- Loading State (only on initial load, not while having search) -->
    <div
      v-if="loading && clients.length === 0 && searchQuery === ''"
      class="px-4 pb-4"
    >
      <AppSkeleton variant="table" :rows="8" :cols="6" />
    </div>

    <!-- Empty State (only when no clients exist AND no search) -->
    <div
      v-else-if="totalCount === 0 && searchQuery === '' && !loading"
      data-tour="contacts-empty-state"
      class="flex-1 flex items-center justify-center px-4 py-12 sm:py-16"
    >
      <div class="bezel w-full max-w-2xl">
        <div class="bezel-core px-6 py-10 sm:px-12 sm:py-12 text-center">
          <div class="icon-tile mx-auto mb-6 !h-16 !w-16 !rounded-[1.4rem]">
            <UIcon
              name="lucide:users"
              class="w-8 h-8"
            />
          </div>

          <h2 class="at-title !text-2xl sm:!text-3xl mb-3">
            {{ t('contacts.noClients') }}
          </h2>
          <p class="at-hint mx-auto !text-base mb-6">
            {{ t('contacts.noClientsDescription') }}
          </p>

          <div class="mb-8 flex flex-wrap justify-center gap-2">
            <span class="at-chip !px-3 !py-1.5 !text-sm"><UIcon name="lucide:phone" class="w-3.5 h-3.5 text-blue-600" />{{ t('contacts.emptyHintContacts') }}</span>
            <span class="at-chip !px-3 !py-1.5 !text-sm"><UIcon name="lucide:tag" class="w-3.5 h-3.5 text-blue-600" />{{ t('contacts.emptyHintTags') }}</span>
            <span class="at-chip !px-3 !py-1.5 !text-sm"><UIcon name="lucide:file-spreadsheet" class="w-3.5 h-3.5 text-blue-600" />{{ t('contacts.emptyHintImport') }}</span>
          </div>

          <div class="flex flex-wrap justify-center gap-3">
            <NuxtLink
              class="at-btn at-btn--primary !px-6 !py-3 !text-sm"
              data-tour="contacts-create-empty"
              :to="`/${nsSlug}/contacts/new`"
            >
              <UIcon name="lucide:plus" class="w-4 h-4" />
              {{ t('contacts.createClient') }}
            </NuxtLink>
            <QuickSetupButton
              v-if="namespaceId"
              :namespace-id="namespaceId"
              :on-apply="applyTagsPreset"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Table (always shown when there's data or active search) -->
    <div
      v-else
      data-tour="contacts-table"
      class="px-4 pb-safe-or-4 flex-1 min-h-0 flex flex-col"
    >
      <ClientsTable 
        v-model:search-query="searchQuery" 
        v-model:selected-tags="selectedTags"
        :clients="filteredClients"
        :loading="loading"
        :page="page"
        :page-size="pageSize"
        :total-pages="totalPages"
        :total-items="totalCount"
        :sort-field="sortField"
        :sort-direction="sortDirection === 'ASC' ? 'asc' : 'desc'"
        :ns-slug="nsSlug"
        :resolved-names="resolvedNames"
        @update:page="(newPage) => updateRoute(newPage, pageSize)"
        @update:page-size="(newPageSize) => updateRoute(1, newPageSize)"
        @update:sort="handleSortUpdate"
        @row-click="handleRowClick"
        @open-tags-modal="handleOpenTagsModal"
        @save-name="handleInlineSaveName"
        @save-primary-phone="handleInlineSavePrimaryPhone"
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
