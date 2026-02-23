<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useI18n } from '@/composables/useI18n';
import { logError } from '@/utils/logger';
import { contactsUpdateClientStatus } from '@/api/contacts/mutations';
import type { ClientRow } from '@/api/contacts/listClients';

const router = useRouter();
const route = useRoute();
const toast = useToast();
const { t } = useI18n();
const { token } = useAuth();
const { selected: selectedNS } = useNamespace();

const client = ref<ClientRow | null>(null);
const loading = ref(true);
const statusChangeLoading = ref(false);

const clientId = computed(() => route.params.id as string);
const displayName = computed(() => {
  if (!client.value) return '';
  const c = client.value;
  if (c.client.clientType === 'INDIVIDUAL' && c.individual) {
    return `${c.individual.lastName} ${c.individual.firstName}`;
  }
  return c.legalEntity?.legalName || 'Unknown';
});

const statusColor = computed(() => {
  const status = client.value?.client.status;
  const colors: Record<string, string> = {
    ACTIVE: 'green',
    ARCHIVED: 'gray',
    BLOCKED: 'red',
  };
  return colors[status!] || 'gray';
});

onMounted(async () => {
  await loadClient();
});

async function loadClient() {
  if (!token.value) return;

  try {
    loading.value = true;
    // For now, we'll use a simplified approach
    // In a real app, you'd want a getClient query
    client.value = {
      client: {
        id: clientId.value,
        clientType: 'INDIVIDUAL',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      individual: {
        firstName: 'John',
        lastName: 'Doe',
        middleName: '',
        birthDate: '',
        gender: '',
      },
    };
  } catch (error) {
    logError('Failed to load client:', error);
    toast.add({
      title: t('common.error'),
      description: t('common.contacts.loadError'),
      color: 'red',
    });
  } finally {
    loading.value = false;
  }
}

async function updateStatus(newStatus: 'ACTIVE' | 'ARCHIVED' | 'BLOCKED') {
  if (!token.value || !selectedNS.value || !client.value) return;

  try {
    statusChangeLoading.value = true;
    await contactsUpdateClientStatus(token.value, selectedNS.value, clientId.value, newStatus);
    client.value.client.status = newStatus;
    toast.add({
      title: t('common.success'),
      description: t('common.contacts.statusUpdated'),
      color: 'green',
    });
  } catch (error) {
    logError('Failed to update client status:', error);
    toast.add({
      title: t('common.error'),
      description: t('common.contacts.updateError'),
      color: 'red',
    });
  } finally {
    statusChangeLoading.value = false;
  }
}

function handleBack() {
  router.back();
}
</script>

<template>
  <div class="space-y-6 px-4 py-6">
    <!-- Header -->
    <div class="flex items-center gap-3">
      <UButton
        icon="lucide:chevron-left"
        color="gray"
        variant="ghost"
        @click="handleBack"
      />
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
          {{ displayName || t('common.contacts.clients') }}
        </h1>
        <p class="text-sm text-gray-600 dark:text-gray-400 mt-1" v-if="client">
          {{ t('common.contacts.type') }}:
          {{ client.client.clientType === 'INDIVIDUAL'
            ? t('common.contacts.individual')
            : t('common.contacts.legalEntity') }}
        </p>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center py-16">
      <div class="text-center">
        <UIcon name="lucide:loader" class="w-8 h-8 mx-auto text-gray-400 animate-spin mb-4" />
        <p class="text-gray-600 dark:text-gray-400">{{ t('common.loading') }}</p>
      </div>
    </div>

    <!-- Content -->
    <div v-else-if="client" class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Information Card -->
      <div class="lg:col-span-2">
        <UCard class="bg-white dark:bg-gray-900 rounded-xl shadow-lg ring-1 ring-gray-200 dark:ring-gray-800">
          <template #header>
            <h2 class="text-xl font-semibold text-gray-900 dark:text-white">
              {{ t('common.contacts.information') }}
            </h2>
          </template>

          <div class="space-y-6">
            <!-- Individual Details -->
            <div v-if="client.individual" class="space-y-4">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                    {{ t('common.contacts.firstName') }}
                  </p>
                  <p class="mt-1 text-lg text-gray-900 dark:text-white">
                    {{ client.individual.firstName }}
                  </p>
                </div>

                <div>
                  <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                    {{ t('common.contacts.lastName') }}
                  </p>
                  <p class="mt-1 text-lg text-gray-900 dark:text-white">
                    {{ client.individual.lastName }}
                  </p>
                </div>

                <div v-if="client.individual.middleName">
                  <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                    {{ t('common.contacts.middleName') }}
                  </p>
                  <p class="mt-1 text-lg text-gray-900 dark:text-white">
                    {{ client.individual.middleName }}
                  </p>
                </div>

                <div v-if="client.individual.birthDate">
                  <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                    {{ t('common.contacts.birthDate') }}
                  </p>
                  <p class="mt-1 text-lg text-gray-900 dark:text-white">
                    {{ new Date(client.individual.birthDate).toLocaleDateString('ru-RU') }}
                  </p>
                </div>
              </div>
            </div>

            <!-- Legal Entity Details -->
            <div v-if="client.legalEntity" class="space-y-4">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div class="sm:col-span-2">
                  <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                    {{ t('common.contacts.legalName') }}
                  </p>
                  <p class="mt-1 text-lg text-gray-900 dark:text-white">
                    {{ client.legalEntity.legalName }}
                  </p>
                </div>

                <div v-if="client.legalEntity.brandName">
                  <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                    {{ t('common.contacts.brandName') }}
                  </p>
                  <p class="mt-1 text-lg text-gray-900 dark:text-white">
                    {{ client.legalEntity.brandName }}
                  </p>
                </div>

                <div v-if="client.legalEntity.binIin">
                  <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                    {{ t('common.contacts.binIin') }}
                  </p>
                  <p class="mt-1 text-lg text-gray-900 dark:text-white">
                    {{ client.legalEntity.binIin }}
                  </p>
                </div>

                <div v-if="client.legalEntity.registrationCountry">
                  <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                    {{ t('common.contacts.registrationCountry') }}
                  </p>
                  <p class="mt-1 text-lg text-gray-900 dark:text-white">
                    {{ client.legalEntity.registrationCountry }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </UCard>
      </div>

      <!-- Status Card -->
      <div>
        <UCard class="bg-white dark:bg-gray-900 rounded-xl shadow-lg ring-1 ring-gray-200 dark:ring-gray-800">
          <template #header>
            <h2 class="text-xl font-semibold text-gray-900 dark:text-white">
              {{ t('common.contacts.status') }}
            </h2>
          </template>

          <div class="space-y-4">
            <!-- Current Status -->
            <div>
              <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">
                {{ t('common.contacts.status') }}
              </p>
              <UBadge :color="statusColor" size="lg" class="justify-center w-full">
                {{ client.client.status }}
              </UBadge>
            </div>

            <!-- Status Buttons -->
            <div class="pt-4 border-t border-gray-200 dark:border-gray-800">
              <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-3">
                {{ t('common.actions') }}
              </p>
              <div class="space-y-2 flex flex-col">
                <UButton
                  v-for="status in ['ACTIVE', 'ARCHIVED', 'BLOCKED']"
                  :key="status"
                  @click="updateStatus(status as any)"
                  :loading="statusChangeLoading && client.client.status !== status"
                  :disabled="statusChangeLoading || client.client.status === status"
                  :variant="client.client.status === status ? 'soft' : 'outline'"
                  block
                >
                  {{ status }}
                </UButton>
              </div>
            </div>

            <!-- Metadata -->
            <div class="pt-4 border-t border-gray-200 dark:border-gray-800 space-y-3">
              <div>
                <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                  {{ t('common.contacts.createdAt') }}
                </p>
                <p class="mt-1 text-sm text-gray-900 dark:text-white">
                  {{ new Date(client.client.createdAt).toLocaleDateString('ru-RU') }}
                </p>
              </div>
              <div>
                <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                  {{ t('common.contacts.updatedAt') }}
                </p>
                <p class="mt-1 text-sm text-gray-900 dark:text-white">
                  {{ new Date(client.client.updatedAt).toLocaleDateString('ru-RU') }}
                </p>
              </div>
            </div>
          </div>
        </UCard>
      </div>
    </div>
  </div>
</template>
