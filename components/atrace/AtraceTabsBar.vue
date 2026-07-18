<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import type { Route } from '@/api/atrace/route/list';

const props = defineProps<{
  activeTab: string;
  routes: Route[];
  routesLoading: boolean;
  routesError: string | null;
}>();

const emit = defineEmits<{
  (e: 'update:activeTab', value: string): void;
  (e: 'add-route'): void;
}>();

const { t } = useI18n();

const activeTabModel = computed({
  get: () => props.activeTab,
  set: (value: string) => emit('update:activeTab', value),
});
</script>

<template>
  <div class="px-4 flex-shrink-0">
    <div class="flex items-center gap-2 overflow-x-auto pb-2">
      <button
        class="px-3 py-1.5 rounded-full text-sm font-medium border transition"
        :class="activeTabModel === 'attendance'
          ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-100 dark:border-emerald-900/60'
          : 'bg-gray-50 dark:bg-gray-900/60 border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300'"
        @click="activeTabModel = 'attendance'"
      >
        {{ t('app.attendance') || 'Посещаемость' }}
      </button>
      <button
        v-for="r in routes"
        :key="r.id"
        class="px-3 py-1.5 rounded-full text-sm font-medium border transition whitespace-nowrap"
        :class="activeTabModel === `route:${r.id}`
          ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-100 dark:border-emerald-900/60'
          : 'bg-gray-50 dark:bg-gray-900/60 border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300'"
        @click="activeTabModel = `route:${r.id}`"
      >
        {{ r.title || (t('app.route.label') || 'Маршрут') }}
      </button>
      <UButton
        icon="lucide:plus"
        size="xs"
        color="emerald"
        variant="soft"
        class="flex-shrink-0"
        @click="emit('add-route')"
      >
        {{ t('app.route.add') || 'Добавить маршрут' }}
      </UButton>
      <span
        v-if="routesLoading"
        class="text-xs text-gray-500"
      >{{ t('app.loading') }}</span>
      <span
        v-else-if="routesError"
        class="text-xs text-red-500"
      >{{ routesError }}</span>
    </div>
  </div>
</template>
