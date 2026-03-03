<script setup lang="ts">
interface Props {
  tags: Array<{ id: string; name: string }>;
}

defineProps<Props>();
const { t } = useI18n();
</script>

<template>
  <div v-if="tags.length > 0" class="bg-white dark:bg-gray-800 rounded-lg shadow ring-1 ring-gray-200 dark:ring-gray-700 overflow-hidden">
    <div class="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
      <UIcon name="i-heroicons-tag" class="w-5 h-5 text-rose-500 dark:text-rose-400" />
      <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('common.contacts.tags') }}</h2>
    </div>
    <div class="px-5 py-5 flex flex-wrap gap-2">
      <UBadge v-for="tag in tags" :key="tag.id" variant="subtle" color="gray">
        {{ tag.name }}
      </UBadge>
    </div>
  </div>
</template>
