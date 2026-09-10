<script lang="ts" setup>
// Links a task to a lota Contacts client: live search by name/phone, an
// auto-create from whatever contact fields the task already has, plus
// unlink and a "refresh snapshot from Contacts" action. Mirrors the
// order-to-client widget in components/menu/OrderDetailModal.vue -- the
// backend (linkTaskClient) resolves and denormalizes the name/phone/VIP
// snapshot, so this component only drives the UI.
import { useAuth } from '@/composables/useAuth';
import { useContactsToken } from '@/composables/useContactsToken';
import { useTasksToken } from '@/composables/useTasksToken';
import { useI18n } from '@/composables/useI18n';
import { useConfirm } from '@/composables/useConfirm';
import { logError } from '@/utils/logger';
import { getErrorMessage } from '@/utils/types/errors';
import { normalizePhoneForStorage } from '@/utils/phone';
import type { TaskItem } from '@/api/tasks/task/list';
import type { ClientRow } from '@/api/contacts/listClients';

const props = defineProps<{
  task: TaskItem;
  nsSlug: string;
  // The owning board's integration_flags.contacts -- the widget stays hidden
  // upstream when this is off; here it only gates the auto-create hint.
  integrationEnabled: boolean;
}>();
const emit = defineEmits<{ (e: 'changed', task: TaskItem): void }>();

const { t } = useI18n();
const { token: hubToken } = useAuth();
const { confirm } = useConfirm();

const contactsInstalled = ref<boolean | null>(null);
const linkedClient = ref<ClientRow | null>(null);
const resolving = ref(false);

const query = ref('');
const results = ref<ClientRow[]>([]);
const searching = ref(false);
const searched = ref(false);
const dropdownOpen = ref(false);
const busy = ref(false); // link / unlink / create in flight
let searchTimer: ReturnType<typeof setTimeout> | null = null;

async function getTasksAuth(): Promise<string | null> {
  const { current } = useTasksToken();
  return current() || null;
}
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
    logError('[TaskClientLink] hubIsAppInNamespace failed', e);
    contactsInstalled.value = false;
  }
}

async function resolveLinked() {
  linkedClient.value = null;
  if (!props.task.clientId || !contactsInstalled.value) return;
  resolving.value = true;
  try {
    const token = await getContactsAuth();
    if (!token) return;
    const { getClient } = await import('@/api/contacts/getClient');
    linkedClient.value = await getClient(token, props.nsSlug, props.task.clientId);
  } catch (e) {
    logError('[TaskClientLink] resolveLinked failed', e);
  } finally {
    resolving.value = false;
  }
}

function clientLabel(row: ClientRow): string {
  if (row.legalEntity) return row.legalEntity.brandName || row.legalEntity.legalName;
  if (row.individual) return [row.individual.firstName, row.individual.lastName].filter(Boolean).join(' ').trim();
  return row.client.shortId || row.client.id;
}
function clientSub(row: ClientRow): string {
  const phone = row.contacts?.find((c) => c.type === 'phone')?.value;
  return [phone, row.legalEntity?.binIin].filter(Boolean).join(' · ');
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
    logError('[TaskClientLink] search failed', e);
    results.value = [];
  } finally {
    searching.value = false;
    searched.value = true;
  }
}

async function persistLink(clientId: string | null) {
  const token = await getTasksAuth();
  if (!token) throw new Error('No tasks token');
  const { tasksLinkTaskClient } = await import('@/api/tasks/task/update');
  const updated = await tasksLinkTaskClient(token, props.nsSlug, props.task.id, clientId);
  emit('changed', updated);
  return updated;
}

async function pick(row: ClientRow) {
  busy.value = true;
  try {
    await persistLink(row.client.id);
    linkedClient.value = row;
    dropdownOpen.value = false;
    query.value = '';
    results.value = [];
    searched.value = false;
    useToast().add({ title: t('tasks.clientLinkedToast') || 'Client linked', color: 'primary' });
  } catch (e) {
    logError('[TaskClientLink] pick failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to link client', color: 'red' });
  } finally {
    busy.value = false;
  }
}

async function unlink() {
  if (!(await confirm({ message: t('tasks.confirmUnlinkClient') || 'Unlink this client from the task?' }))) return;
  busy.value = true;
  try {
    await persistLink(null);
    linkedClient.value = null;
    useToast().add({ title: t('tasks.clientUnlinkedToast') || 'Client unlinked', color: 'primary' });
  } catch (e) {
    logError('[TaskClientLink] unlink failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to unlink client', color: 'red' });
  } finally {
    busy.value = false;
  }
}

// Splits "Иван Петров" into first/last -- the best this can do without a
// dedicated name field, same as OrderDetailModal.splitCustomerName.
function splitName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: t('menu.guestCustomer') || 'Client', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

async function createFromTask() {
  busy.value = true;
  try {
    const cToken = await getContactsAuth();
    if (!cToken) throw new Error('No contacts token');
    const seedName = query.value.trim() || props.task.clientNameSnapshot || '';
    const phone = (props.task.clientPhoneSnapshot || '').trim();
    const { firstName, lastName } = splitName(seedName);
    const { contactsCreateIndividualClient } = await import('@/api/contacts/mutations');
    const created = await contactsCreateIndividualClient(cToken, props.nsSlug, {
      individual: { firstName, lastName },
      status: 'ACTIVE',
    });
    if (phone) {
      const { createIdentity } = await import('@/api/contacts/identities');
      await createIdentity(cToken, props.nsSlug, created.client.id, 'phone', normalizePhoneForStorage(phone), true);
    }
    await persistLink(created.client.id);
    linkedClient.value = created;
    dropdownOpen.value = false;
    query.value = '';
    results.value = [];
    searched.value = false;
    useToast().add({ title: t('tasks.clientCreatedToast') || 'Client created', color: 'primary' });
  } catch (e) {
    logError('[TaskClientLink] createFromTask failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to create client', color: 'red' });
  } finally {
    busy.value = false;
  }
}

const refreshing = ref(false);
async function refreshSnapshot() {
  refreshing.value = true;
  try {
    const token = await getTasksAuth();
    if (!token) throw new Error('No tasks token');
    const { tasksRefreshClientSnapshot } = await import('@/api/tasks/task/update');
    const updated = await tasksRefreshClientSnapshot(token, props.nsSlug, props.task.id);
    emit('changed', updated);
  } catch (e) {
    logError('[TaskClientLink] refreshSnapshot failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to refresh from Contacts', color: 'red' });
  } finally {
    refreshing.value = false;
  }
}

onMounted(async () => {
  await checkInstalled();
  await resolveLinked();
});
watch(() => props.task.id, async () => {
  query.value = '';
  results.value = [];
  searched.value = false;
  await resolveLinked();
});
watch(() => props.task.clientId, resolveLinked);
watch(() => props.nsSlug, async () => {
  await checkInstalled();
  await resolveLinked();
});
</script>

<template>
  <div v-if="contactsInstalled !== false">
    <div v-if="contactsInstalled === null" class="h-8 flex items-center text-xs text-gray-400">
      <UIcon name="lucide:loader" class="w-3.5 h-3.5 animate-spin mr-1.5" />{{ t('app.loading') || 'Loading...' }}
    </div>

    <template v-else>
      <!-- Linked -->
      <div
        v-if="task.clientId"
        class="flex items-center justify-between gap-2 rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2"
      >
        <div class="min-w-0">
          <div class="flex items-center gap-1.5 text-sm font-medium text-gray-900 dark:text-white">
            <UIcon v-if="resolving" name="lucide:loader" class="w-3.5 h-3.5 animate-spin" />
            <NuxtLink
              v-else
              :to="`/${nsSlug}/contacts/${task.clientId}`"
              class="truncate hover:underline text-primary-600 dark:text-primary-400"
            >
              {{ linkedClient ? clientLabel(linkedClient) : (task.clientNameSnapshot || t('tasks.linkClientOpen') || 'Open in Contacts') }}
            </NuxtLink>
            <UBadge v-if="task.clientIsVipSnapshot" color="yellow" variant="soft" size="xs">{{ t('tasks.vip') || 'VIP' }}</UBadge>
          </div>
          <div v-if="linkedClient && clientSub(linkedClient)" class="text-xs text-gray-400 truncate">{{ clientSub(linkedClient) }}</div>
        </div>
        <div class="flex items-center flex-shrink-0">
          <UButton
            icon="lucide:refresh-cw" size="2xs" color="gray" variant="ghost"
            :loading="refreshing" :title="t('tasks.refreshFromContacts') || 'Refresh'"
            @click="refreshSnapshot"
          />
          <UButton size="2xs" color="gray" variant="ghost" :loading="busy" @click="unlink">
            {{ t('tasks.unlinkClient') || 'Unlink' }}
          </UButton>
        </div>
      </div>

      <!-- Not linked -->
      <div v-else class="relative">
        <UInput
          v-model="query"
          icon="lucide:search"
          size="sm"
          :placeholder="t('tasks.linkClientSearchPlaceholder') || 'Search Contacts by name or phone'"
          :loading="busy"
          @input="onQueryInput"
          @focus="dropdownOpen = true"
          @blur="dropdownOpen = false"
        />
        <div
          v-if="dropdownOpen && query.trim()"
          class="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-lg max-h-56 overflow-y-auto"
          @mousedown.prevent
        >
          <div v-if="searching" class="px-3 py-2 text-xs text-gray-400">{{ t('app.loading') || 'Loading...' }}</div>
          <template v-else>
            <button
              v-for="row in results" :key="row.client.id" type="button"
              class="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800"
              @click="pick(row)"
            >
              <div class="text-sm font-medium text-gray-900 dark:text-white">{{ clientLabel(row) }}</div>
              <div v-if="clientSub(row)" class="text-xs text-gray-400">{{ clientSub(row) }}</div>
            </button>
            <div v-if="searched && !results.length" class="px-3 py-2 text-xs text-gray-400 space-y-1.5">
              <div>{{ t('tasks.linkClientNotFound') || 'Nothing found' }}</div>
              <div>{{ t('tasks.linkClientCreateHint') || 'No match? Create a new client card.' }}</div>
              <UButton size="2xs" color="primary" variant="soft" :loading="busy" @click="createFromTask">
                {{ t('tasks.linkClientCreate') || 'Create client' }} "{{ query.trim() }}"
              </UButton>
            </div>
          </template>
        </div>
      </div>
    </template>
  </div>
</template>
