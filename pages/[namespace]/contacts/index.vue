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
  <div class="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
    <div class="flex flex-col items-center justify-center space-y-6">
      <!-- Animated Loader -->
      <div class="relative w-16 h-16">
        <div class="absolute inset-0 rounded-full bg-gradient-to-r from-blue-400 to-indigo-600 opacity-75 blur animate-pulse"></div>
        <div class="absolute inset-2 rounded-full bg-white dark:bg-gray-900 flex items-center justify-center">
          <UIcon name="lucide:loader" class="w-8 h-8 text-indigo-600 animate-spin" />
        </div>
      </div>
      
      <!-- Loading Text -->
      <div class="text-center space-y-2">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Загружаю контакты...</h2>
        <p class="text-sm text-gray-600 dark:text-gray-400">Это займет всего пару секунд</p>
      </div>
      
      <!-- Progress Dots -->
      <div class="flex items-center justify-center gap-2">
        <div class="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" style="animation-delay: 0s;"></div>
        <div class="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" style="animation-delay: 0.1s;"></div>
        <div class="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" style="animation-delay: 0.2s;"></div>
      </div>
    </div>
  </div>
</template>
