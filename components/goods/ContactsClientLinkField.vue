<script lang="ts" setup>
// Replaces a raw "Contacts client ID" input (which no user could ever fill
// in by hand) with a live search over Contacts clients by name/phone/BIN,
// plus an optional auto-create when nothing matches. Falls back to a plain
// ID field only when Contacts isn't installed in this namespace at all --
// mirrors the Menu-item-id fallback pattern in goods/settings.vue.
import { useAuth } from '@/composables/useAuth';
import { useContactsToken } from '@/composables/useContactsToken';
import { useI18n } from '@/composables/useI18n';
import { logError } from '@/utils/logger';
import { getErrorMessage } from '@/utils/types/errors';
import type { ClientRow } from '@/api/contacts/listClients';

const props = defineProps<{
  modelValue: string;
  nsSlug: string;
  contactsIntegrationEnabled: boolean;
}>();
const emit = defineEmits<{ (e: 'update:modelValue', value: string): void }>();

const { t } = useI18n();
const { token: hubToken } = useAuth();

const contactsInstalled = ref<boolean | null>(null);
const selectedClient = ref<ClientRow | null>(null);
const resolvingSelected = ref(false);
const query = ref('');
const results = ref<ClientRow[]>([]);
const searching = ref(false);
const searched = ref(false);
const creating = ref(false);
const dropdownOpen = ref(false);
let searchTimer: ReturnType<typeof setTimeout> | null = null;

async function getContactsAuth(): Promise<string | null> {
  if (!props.nsSlug || !hubToken.value) return null;
  const { ensure } = useContactsToken();
  return ensure(props.nsSlug, hubToken.value);
}

async function checkInstalled() {
  if (!hubToken.value || !props.nsSlug) {
    contactsInstalled.value = false;
    return;
  }
  try {
    const { hubIsAppInNamespace } = await import('@/api/hub/namespaces/isAppInNamespace');
    contactsInstalled.value = await hubIsAppInNamespace(hubToken.value, props.nsSlug, 'pieceowater.contacts');
  } catch (e) {
    logError('[ContactsClientLinkField] hubIsAppInNamespace failed', e);
    contactsInstalled.value = false;
  }
}

async function resolveSelected() {
  selectedClient.value = null;
  if (!props.modelValue || !contactsInstalled.value) return;
  resolvingSelected.value = true;
  try {
    const token = await getContactsAuth();
    if (!token) return;
    const { getClient } = await import('@/api/contacts/getClient');
    selectedClient.value = await getClient(token, props.nsSlug, props.modelValue);
  } catch (e) {
    logError('[ContactsClientLinkField] resolveSelected failed', e);
  } finally {
    resolvingSelected.value = false;
  }
}

function clientLabel(row: ClientRow): string {
  if (row.legalEntity) return row.legalEntity.brandName || row.legalEntity.legalName;
  if (row.individual) return [row.individual.firstName, row.individual.lastName].filter(Boolean).join(' ');
  return row.client.shortId || row.client.id;
}
function clientSub(row: ClientRow): string {
  const phone = row.contacts?.find((c) => c.type === 'phone')?.value;
  const bin = row.legalEntity?.binIin;
  return [phone, bin].filter(Boolean).join(' · ');
}

function onQueryInput() {
  dropdownOpen.value = true;
  if (searchTimer) clearTimeout(searchTimer);
  const q = query.value.trim();
  if (!q) {
    results.value = [];
    searching.value = false;
    searched.value = false;
    return;
  }
  searching.value = true;
  searchTimer = setTimeout(runSearch, 300);
}

async function runSearch() {
  const q = query.value.trim();
  if (!q || !contactsInstalled.value) {
    results.value = [];
    searching.value = false;
    return;
  }
  try {
    const token = await getContactsAuth();
    if (!token) {
      results.value = [];
      return;
    }
    const { contactsListClients } = await import('@/api/contacts/listClients');
    const res = await contactsListClients(token, props.nsSlug, {
      search: q,
      pagination: { page: 1, length: 'TEN' },
    });
    results.value = res.rows;
  } catch (e) {
    logError('[ContactsClientLinkField] search failed', e);
    results.value = [];
  } finally {
    searching.value = false;
    searched.value = true;
  }
}

function pick(row: ClientRow) {
  selectedClient.value = row;
  emit('update:modelValue', row.client.id);
  dropdownOpen.value = false;
  query.value = '';
  results.value = [];
  searched.value = false;
}

function unlink() {
  selectedClient.value = null;
  emit('update:modelValue', '');
}

async function createFromQuery() {
  const name = query.value.trim();
  if (!name) return;
  creating.value = true;
  try {
    const token = await getContactsAuth();
    if (!token) throw new Error('No contacts token');
    const { contactsCreateLegalEntityClient } = await import('@/api/contacts/mutations');
    const created = await contactsCreateLegalEntityClient(token, props.nsSlug, {
      legalEntity: { legalName: name },
      status: 'ACTIVE',
    });
    pick(created);
    useToast().add({ title: t('goods.linkToContactsSelected'), color: 'primary' });
  } catch (e) {
    logError('[ContactsClientLinkField] createFromQuery failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to create client', color: 'red' });
  } finally {
    creating.value = false;
  }
}

onMounted(async () => {
  await checkInstalled();
  await resolveSelected();
});
watch(() => props.modelValue, resolveSelected);
watch(() => props.nsSlug, checkInstalled);
</script>

<template>
  <div>
    <UInput
      v-if="contactsInstalled === false"
      :model-value="modelValue"
      placeholder="Contacts client ID"
      @update:model-value="(v: string) => emit('update:modelValue', v)"
    />
    <p v-if="contactsInstalled === false" class="text-xs text-gray-400 mt-1">{{ t('goods.linkToContactsUnavailable') }}</p>

    <div v-else-if="contactsInstalled === null" class="h-8 flex items-center text-xs text-gray-400">
      <Icon name="lucide:loader" class="w-3.5 h-3.5 animate-spin mr-1.5" />{{ t('common.loading') }}
    </div>

    <template v-else>
      <div v-if="modelValue" class="flex items-center justify-between gap-2 rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2">
        <div class="min-w-0">
          <div class="text-sm font-medium truncate text-gray-900 dark:text-white">
            <Icon v-if="resolvingSelected" name="lucide:loader" class="w-3.5 h-3.5 animate-spin inline-block mr-1" />
            <template v-else>{{ selectedClient ? clientLabel(selectedClient) : modelValue }}</template>
          </div>
          <div v-if="selectedClient" class="text-xs text-gray-400 truncate">{{ clientSub(selectedClient) }}</div>
        </div>
        <UButton size="2xs" color="gray" variant="ghost" @click="unlink">{{ t('goods.linkToContactsUnlink') }}</UButton>
      </div>

      <div v-else class="relative">
        <UInput
          v-model="query"
          icon="lucide:search"
          :placeholder="t('goods.linkToContactsSearchPlaceholder')"
          @input="onQueryInput"
          @focus="dropdownOpen = true"
          @blur="dropdownOpen = false"
        />
        <div
          v-if="dropdownOpen && query.trim()"
          class="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-lg max-h-56 overflow-y-auto"
          @mousedown.prevent
        >
          <div v-if="searching" class="px-3 py-2 text-xs text-gray-400">{{ t('common.loading') }}</div>
          <template v-else>
            <button
              v-for="row in results" :key="row.client.id" type="button"
              class="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800"
              @click="pick(row)"
            >
              <div class="text-sm font-medium text-gray-900 dark:text-white">{{ clientLabel(row) }}</div>
              <div class="text-xs text-gray-400">{{ clientSub(row) }}</div>
            </button>
            <div v-if="searched && !results.length" class="px-3 py-2 text-xs text-gray-400 space-y-1.5">
              <div>{{ t('goods.linkToContactsNotFound') }}</div>
              <template v-if="contactsIntegrationEnabled">
                <div>{{ t('goods.linkToContactsCreateHint') }}</div>
                <UButton size="2xs" color="primary" variant="soft" :loading="creating" @click="createFromQuery">
                  {{ t('goods.linkToContactsCreate') }} "{{ query.trim() }}"
                </UButton>
              </template>
            </div>
          </template>
        </div>
      </div>
    </template>
  </div>
</template>
