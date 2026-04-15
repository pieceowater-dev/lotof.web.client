<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
import type { ClientRow } from '@/api/contacts/listClients';

interface Props {
  client: ClientRow | null;
  namespace?: string;
}

interface Emits {
  back: [];
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();
const { t } = useI18n();
const { titleBySlug } = useNamespace();

const displayName = computed(() => {
  if (!props.client) return '';
  const c = props.client;
  if (c.client.clientType === 'INDIVIDUAL' && c.individual) {
    const parts = [c.individual.lastName, c.individual.firstName, c.individual.middleName].filter(Boolean);
    return parts.join(' ');
  }
  return c.legalEntity?.legalName || '---';
});

const nsTitle = computed(() => titleBySlug(props.namespace || '') || props.namespace || '');
const pageTitle = computed(() => {
  return displayName.value ? `${displayName.value} — ${nsTitle.value}` : t('common.loading');
});

const statusBadgeClass = computed(() => {
  const status = props.client?.client.status;
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
});

const statusLabel = computed(() => {
  const status = props.client?.client.status;
  const statusMap: Record<string, string> = {
    'ACTIVE': t('contacts.active') || 'Active',
    'BLOCKED': t('contacts.blocked') || 'Blocked',
    'ARCHIVED': t('contacts.archived') || 'Archived',
  };
  return statusMap[status!] || status;
});

useHead(() => ({
  title: pageTitle.value,
}));
</script>

<template>
  <div class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div class="flex items-center justify-between">
        <!-- Name & Type -->
        <div class="flex-1 min-w-0">
          <h1
            v-if="displayName"
            class="text-2xl font-bold text-gray-900 dark:text-white"
          >
            {{ displayName }}
          </h1>
          <div
            v-if="client"
            class="mt-1 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400"
          >
            <span>{{ client.client.clientType === 'INDIVIDUAL' ? t('contacts.individual') : t('contacts.legalEntity') }}</span>
            <span>•</span>
            <span :class="statusBadgeClass">
              {{ statusLabel }}
            </span>
          </div>
        </div>
        <!-- Back Button -->
        <UButton
          icon="i-heroicons-arrow-left"
          size="xs"
          color="primary"
          variant="soft"
          class="min-w-fit gap-2"
          @click="emit('back')"
        >
          <span class="hidden sm:inline">{{ t('app.back') || t('common.back') }}</span>
        </UButton>
      </div>
    </div>
  </div>
</template>
