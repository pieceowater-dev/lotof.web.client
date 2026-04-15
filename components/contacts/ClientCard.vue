<script lang="ts" setup>
import { computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
import type { ClientRow } from '@/api/contacts/listClients';

const { t } = useI18n();

const props = withDefaults(
  defineProps<{
    client: ClientRow;
    selected?: boolean;
  }>(),
  { selected: false }
);

const emit = defineEmits<{
  (e: 'select', client: ClientRow): void;
}>();

const clientName = computed(() => {
  if (props.client.client.clientType === 'INDIVIDUAL' && props.client.individual) {
    return `${props.client.individual.lastName} ${props.client.individual.firstName}`;
  }
  return props.client.legalEntity?.legalName || 'N/A';
});

const clientType = computed(() => {
  return props.client.client.clientType === 'INDIVIDUAL'
    ? t('contacts.individual')
    : t('contacts.legalEntity');
});

const statusColor = computed(() => {
  switch (props.client.client.status) {
    case 'ACTIVE':
      return 'emerald';
    case 'BLOCKED':
      return 'red';
    default:
      return 'gray';
  }
});
</script>

<template>
  <div
    class="bg-white dark:bg-gray-900 shadow-lg p-4 rounded-xl w-60 min-h-[120px] cursor-pointer transition-all duration-200 flex-shrink-0 border-2"
    :class="
      selected
        ? 'border-emerald-500 dark:border-emerald-400 ring-2 ring-emerald-200 dark:ring-emerald-900/50'
        : 'border-transparent hover:border-gray-300 dark:hover:border-gray-700 hover:shadow-xl'
    "
    @click="emit('select', client)"
  >
    <div class="flex flex-col h-full">
      <div class="flex items-start justify-between mb-2">
        <div class="flex-1 min-w-0">
          <h3 class="font-semibold text-base text-gray-900 dark:text-white truncate">
            {{ clientName }}
          </h3>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {{ clientType }}
          </p>
        </div>
        <UBadge
          :color="statusColor"
          size="xs"
          class="ml-2 flex-shrink-0"
        >
          {{ client.client.status }}
        </UBadge>
      </div>

      <div class="mt-auto">
        <div class="text-xs text-gray-400 dark:text-gray-500">
          {{ new Date(client.client.createdAt).toLocaleDateString('ru-RU') }}
        </div>
      </div>
    </div>
  </div>
</template>
