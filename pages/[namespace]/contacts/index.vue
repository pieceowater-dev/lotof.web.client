<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useContactsToken } from '@/composables/useContactsToken';
import { useRouter } from 'vue-router';
import { logError } from '@/utils/logger';
import type { ClientRow } from '@/api/contacts/listClients';
import { contactsListClients } from '@/api/contacts/listClients';
import AppTable from '@/components/ui/AppTable.vue';

const router = useRouter();
const toast = useToast();
const { t } = useI18n();
const { token } = useAuth();
const { selected: selectedNS } = useNamespace();

const clients = ref<ClientRow[]>([]);
const loading = ref(false);
const isModalOpen = ref(false);
const clientTypeFilter = ref<'ALL' | 'INDIVIDUAL' | 'LEGAL'>('ALL');

const filteredClients = computed(() => {
  if (clientTypeFilter.value === 'ALL') return clients.value;
  return clients.value.filter((c) => c.client.clientType === clientTypeFilter.value);
});

const columns = computed(() => [
  {
    accessorKey: 'name',
    header: t('contacts.name'),
    cell: (info: any) => {
      const row = info.row.original as ClientRow;
      if (row.client.clientType === 'INDIVIDUAL' && row.individual) {
        return `${row.individual.lastName} ${row.individual.firstName}`;
      }
      return row.legalEntity?.legalName || 'N/A';
    },
  },
  {
    accessorKey: 'type',
    header: t('contacts.type'),
    cell: (info: any) => {
      const row = info.row.original as ClientRow;
      return row.client.clientType === 'INDIVIDUAL' ? t('contacts.individual') : t('contacts.legalEntity');
    },
  },
  {
    accessorKey: 'status',
    header: t('contacts.status'),
    cell: (info: any) => {
      const row = info.row.original as ClientRow;
      const statusColors: Record<string, string> = {
        ACTIVE: 'green',
        ARCHIVED: 'gray',
        BLOCKED: 'red',
      };
      return h(
        UBadge,
        { color: statusColors[row.client.status] || 'gray' },
        { default: () => row.client.status }
      );
    },
  },
  {
    accessorKey: 'createdAt',
    header: t('contacts.createdAt'),
    cell: (info: any) => {
      const row = info.row.original as ClientRow;
      return new Date(row.client.createdAt).toLocaleDateString('ru-RU');
    },
  },
]);

onMounted(async () => {
  await loadClients();
});

async function loadClients() {
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
      title: t('app.error'),
      description: t('contacts.loadError'),
      color: 'red',
    });
  } finally {
    loading.value = false;
  }
}

function handleRowClick(row: ClientRow) {
  router.push(`/${selectedNS.value}/contacts/${row.client.id}`);
}

async function handleClientCreated() {
  isModalOpen.value = false;
  await loadClients();
  toast.add({
    title: t('app.success'),
    description: t('contacts.clientCreated'),
    color: 'green',
  });
}
</script>

<template>
  <div class="space-y-6 px-4 py-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
          {{ t('contacts.clients') }}
        </h1>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {{ t('contacts.allClients') }}
        </p>
      </div>
      <UButton
        icon="lucide:plus"
        size="lg"
        color="primary"
        :label="t('contacts.createClient')"
        @click="isModalOpen = true"
      />
    </div>

    <!-- Filters -->
    <div v-if="!loading && clients.length > 0" class="flex flex-wrap gap-2">
      <UButton
        v-for="type in ['ALL', 'INDIVIDUAL', 'LEGAL']"
        :key="type"
        @click="clientTypeFilter = type as any"
        :variant="clientTypeFilter === type ? 'solid' : 'outline'"
        :color="clientTypeFilter === type ? 'primary' : 'gray'"
        size="sm"
      >
        {{
          type === 'ALL'
            ? t('contacts.all')
            : type === 'INDIVIDUAL'
              ? t('contacts.individual')
              : t('contacts.legalEntity')
        }}
      </UButton>
      <div class="text-sm text-gray-600 dark:text-gray-400 ml-auto flex items-center">
        {{ filteredClients.length }} {{ t('contacts.clients').toLowerCase() }}
      </div>
    </div>

    <!-- Table or Empty State -->
    <div v-if="loading" class="flex items-center justify-center py-16">
      <div class="text-center">
        <UIcon name="lucide:loader" class="w-8 h-8 mx-auto text-gray-400 animate-spin mb-4" />
        <p class="text-gray-600 dark:text-gray-400">{{ t('app.loading') }}</p>
      </div>
    </div>

    <div v-else-if="clients.length === 0" class="flex items-center justify-center py-16">
      <div class="text-center">
        <UIcon name="lucide:inbox" class="w-12 h-12 mx-auto text-gray-400 mb-4" />
        <p class="text-gray-600 dark:text-gray-400 mb-4">{{ t('contacts.noClients') }}</p>
        <UButton
          icon="lucide:plus"
          color="primary"
          :label="t('contacts.createClient')"
          @click="isModalOpen = true"
        />
      </div>
    </div>

    <div v-else class="overflow-hidden rounded-xl shadow-lg ring-1 ring-gray-200 dark:ring-gray-800">
      <AppTable
        :columns="columns"
        :data="filteredClients"
        :hover="true"
        @row-click="handleRowClick"
      />
    </div>

    <!-- Create Modal -->
    <ClientCreateModal
      v-if="isModalOpen"
      @close="isModalOpen = false"
      @created="handleClientCreated"
    />
  </div>
</template>
