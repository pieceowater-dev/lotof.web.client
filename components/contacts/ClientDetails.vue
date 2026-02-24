<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
import type { ClientRow } from '@/api/contacts/listClients';

const { t } = useI18n();

const props = defineProps<{
  client: ClientRow | null;
}>();

const clientName = computed(() => {
  if (!props.client) return '';
  if (props.client.client.clientType === 'INDIVIDUAL' && props.client.individual) {
    return `${props.client.individual.lastName} ${props.client.individual.firstName} ${props.client.individual.middleName || ''}`.trim();
  }
  return props.client.legalEntity?.legalName || 'N/A';
});

const statusColor = computed(() => {
  if (!props.client) return 'gray';
  switch (props.client.client.status) {
    case 'ACTIVE':
      return 'green';
    case 'BLOCKED':
      return 'red';
    default:
      return 'gray';
  }
});

const clientType = computed(() => {
  if (!props.client) return '';
  return props.client.client.clientType === 'INDIVIDUAL'
    ? t('common.contacts.individual')
    : t('common.contacts.legalEntity');
});
</script>

<template>
  <div v-if="!client" class="flex items-center justify-center h-full">
    <div class="text-center text-gray-500 dark:text-gray-400">
      <UIcon name="lucide:users" class="w-16 h-16 mx-auto mb-4 opacity-50" />
      <p>{{ t('common.contacts.selectClient') }}</p>
    </div>
  </div>

  <div v-else class="space-y-6">
    <!-- Header Card -->
    <div class="bg-white dark:bg-gray-900 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-800">
      <div class="flex items-start justify-between">
        <div class="flex-1">
          <div class="flex items-center gap-3 mb-2">
            <h2 class="text-2xl font-bold text-gray-900 dark:text-white">
              {{ clientName }}
            </h2>
            <UBadge :color="statusColor" size="md">
              {{ client.client.status }}
            </UBadge>
          </div>
          <p class="text-sm text-gray-600 dark:text-gray-400">
            {{ clientType }}
          </p>
        </div>
        <UButton
          icon="lucide:external-link"
          color="primary"
          variant="soft"
          size="sm"
          :to="`/${$route.params.namespace}/contacts/${client.client.id}`"
        >
          {{ t('common.contacts.viewDetails') }}
        </UButton>
      </div>
    </div>

    <!-- Details Card -->
    <div class="bg-white dark:bg-gray-900 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-800">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        {{ t('common.contacts.details') }}
      </h3>

      <div v-if="client.client.clientType === 'INDIVIDUAL' && client.individual" class="space-y-3">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
              {{ t('common.contacts.lastName') }}
            </p>
            <p class="text-sm font-medium text-gray-900 dark:text-white">
              {{ client.individual.lastName }}
            </p>
          </div>
          <div>
            <p class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
              {{ t('common.contacts.firstName') }}
            </p>
            <p class="text-sm font-medium text-gray-900 dark:text-white">
              {{ client.individual.firstName }}
            </p>
          </div>
          <div v-if="client.individual.middleName">
            <p class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
              {{ t('common.contacts.middleName') }}
            </p>
            <p class="text-sm font-medium text-gray-900 dark:text-white">
              {{ client.individual.middleName }}
            </p>
          </div>
          <div v-if="client.individual.birthDate">
            <p class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
              {{ t('common.contacts.birthDate') }}
            </p>
            <p class="text-sm font-medium text-gray-900 dark:text-white">
              {{ new Date(client.individual.birthDate).toLocaleDateString('ru-RU') }}
            </p>
          </div>
        </div>
      </div>

      <div v-else-if="client.legalEntity" class="space-y-3">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
              {{ t('common.contacts.legalName') }}
            </p>
            <p class="text-sm font-medium text-gray-900 dark:text-white">
              {{ client.legalEntity.legalName }}
            </p>
          </div>
          <div v-if="client.legalEntity.binIin">
            <p class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
              {{ t('common.contacts.binIin') }}
            </p>
            <p class="text-sm font-medium text-gray-900 dark:text-white">
              {{ client.legalEntity.binIin }}
            </p>
          </div>
          <div v-if="client.legalEntity.brandName">
            <p class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
              {{ t('common.contacts.brandName') }}
            </p>
            <p class="text-sm font-medium text-gray-900 dark:text-white">
              {{ client.legalEntity.brandName }}
            </p>
          </div>
          <div v-if="client.legalEntity.registrationCountry">
            <p class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
              {{ t('common.contacts.registrationCountry') }}
            </p>
            <p class="text-sm font-medium text-gray-900 dark:text-white">
              {{ client.legalEntity.registrationCountry }}
            </p>
          </div>
        </div>
      </div>

      <div class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
              {{ t('common.contacts.createdAt') }}
            </p>
            <p class="text-sm font-medium text-gray-900 dark:text-white">
              {{ new Date(client.client.createdAt).toLocaleString('ru-RU') }}
            </p>
          </div>
          <div>
            <p class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
              {{ t('common.contacts.updatedAt') }}
            </p>
            <p class="text-sm font-medium text-gray-900 dark:text-white">
              {{ new Date(client.client.updatedAt).toLocaleString('ru-RU') }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
