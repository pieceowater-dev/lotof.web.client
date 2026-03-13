<script setup lang="ts">
const route = useRoute();

const nsSlug = route.params.namespace as string;

await navigateTo(`/${nsSlug}/contacts/all/1-20`, { replace: true });
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-white dark:bg-gray-950">
    <div class="flex flex-col items-center gap-3 text-center">
      <UIcon name="lucide:loader-2" class="w-7 h-7 animate-spin text-gray-500 dark:text-gray-400" />
      <p class="text-sm text-gray-600 dark:text-gray-400">Загрузка контактов...</p>
    </div>
  </div>
</template>
