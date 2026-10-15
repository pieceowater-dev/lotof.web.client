<template>
  <div class="mb-3 flex flex-shrink-0 items-start justify-between gap-3">
    <div class="min-w-0" :data-tour="tourTitle">
      <h1 class="truncate text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl dark:text-white">{{ title }}</h1>
      <p v-if="subtitle" class="mt-0.5 hidden truncate text-sm text-gray-600 sm:block dark:text-gray-400">{{ subtitle }}</p>
    </div>
    <div class="flex flex-shrink-0 items-center gap-1.5 pt-0.5">
      <slot name="primary" />
      <slot name="actions" />
      <UDropdown v-if="menu && menu.length" :items="menu" :popper="{ placement: 'bottom-end', strategy: 'fixed' }">
        <button type="button" class="at-btn !px-2.5" :aria-label="moreLabel" :title="moreLabel">
          <Icon name="lucide:ellipsis" class="h-4 w-4" />
        </button>
        <template #item="{ item }">
          <UIcon v-if="item.icon" :name="item.icon" class="h-4 w-4 flex-shrink-0 text-gray-400" />
          <span class="truncate">{{ item.label }}</span>
          <UIcon v-if="item.external" name="lucide:arrow-up-right" class="ml-auto h-3.5 w-3.5 flex-shrink-0 text-gray-300" />
        </template>
      </UDropdown>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from '@/composables/useI18n';

// The standard header of a workspace list page (DESIGN.md §U3.1 / §U18): title (+ subtitle on wider screens)
// on the left; on the right at most one primary action, optional inline icon actions, and everything else
// behind a single "more" menu. Never a row of equal-weight buttons.
interface MenuItem { label: string; icon?: string; to?: string; target?: string; external?: boolean; disabled?: boolean; click?: (...args: any[]) => void }
defineProps<{
  title: string;
  subtitle?: string;
  tourTitle?: string;
  menu?: MenuItem[][];
}>();
const { t } = useI18n();
const moreLabel = t('tasks.moreActions') || 'More';
</script>
