<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router';
import { onMounted } from 'vue';

const router = useRouter();
const route = useRoute();

const nsSlug = route.params.namespace as string;

// Redirect immediately
onMounted(() => {
  router.replace(`/${nsSlug}/contacts/all/1-20`);
});
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-white dark:bg-gray-950">
    <div class="flex flex-col items-center gap-3 text-center">
      <UIcon name="lucide:loader-2" class="w-7 h-7 animate-spin text-gray-500 dark:text-gray-400" />
      <p class="text-sm text-gray-600 dark:text-gray-400">Загрузка контактов...</p>
    </div>
  </div>
</template>
