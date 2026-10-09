<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import type { Route } from '@/api/atrace/route/list';

const props = defineProps<{
  activeTab: string;
  routes: Route[];
  routesLoading: boolean;
  routesError: string | null;
  canCreateRoute?: boolean;
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
    <div class="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2">
      <button
        class="pill-filter"
        :class="activeTabModel === 'attendance' ? 'pill-filter--active' : ''"
        @click="activeTabModel = 'attendance'"
      >
        {{ t('app.attendance') || 'Посещаемость' }}
      </button>
      <button
        v-for="r in routes"
        :key="r.id"
        class="pill-filter whitespace-nowrap"
        :class="activeTabModel === `route:${r.id}` ? 'pill-filter--active' : ''"
        @click="activeTabModel = `route:${r.id}`"
      >
        {{ r.title || (t('app.route.label') || 'Маршрут') }}
      </button>
      <button
        v-if="canCreateRoute"
        type="button"
        class="at-btn at-btn--blue flex-shrink-0"
        @click="emit('add-route')"
      >
        <UIcon name="lucide:plus" class="h-4 w-4" />
        {{ t('app.route.add') || 'Добавить маршрут' }}
      </button>
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
