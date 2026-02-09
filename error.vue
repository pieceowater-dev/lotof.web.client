<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{ error?: NuxtError }>()

const handleError = () => clearError({ redirect: '/' })

import { useI18n } from '@/composables/useI18n';
const { t, tm } = useI18n();

function pick(list: any): string {
  if (!Array.isArray(list) || !list.length) return '';
  return list[Math.floor(Math.random()*list.length)];
}

const randomMessage = computed(() => pick(tm('app.errorMessages')));
const randomSubtitle = computed(() => pick(tm('app.errorSubtitles')));

const isServerError = computed(() => (props.error?.statusCode ?? 500) >= 500);

function retryAfterResume() {
  if (!process.client) return;
  // Hard reload to reset any stale error state after background sleep
  window.location.reload();
}

// Auto-handle 401 errors (expired tokens) by clearing cookies and redirecting
onMounted(() => {
  if (props.error?.statusCode === 401) {
    console.log('[error.vue] 401 detected, clearing auth state and redirecting');
    try {
      // Clear cookies
      const cookies = ['token', 'atrace-token'];
      cookies.forEach(name => {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/;`;
      });
    } catch {}
    // Redirect to home after brief delay
    setTimeout(() => {
      clearError({ redirect: '/' });
    }, 500);
  }

  if (isServerError.value && process.client) {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        retryAfterResume();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    onBeforeUnmount(() => {
      document.removeEventListener('visibilitychange', onVisibility);
    });
  }
});
</script>

<template>
  <div class="flex flex-col items-center justify-center min-h-screen dark:bg-gray-900 dark:text-white text-center">
    <div class="max-w-lg p-8 rounded-xl bg-gray-50 dark:bg-gray-800 shadow-lg">
      <h1 class="text-6xl font-bold text-red-500">{{ props.error?.statusCode ?? 500 }}</h1>
      <p class="text-xl font-semibold mt-3">{{ randomMessage }}</p>
      <p class="text-lg mt-2 opacity-80">{{ randomSubtitle }}</p>

      <UButton @click="handleError" class="mt-5" :label="t('app.errorBack')" color="primary" variant="outline">
        <template #leading>
          <UIcon name="i-lucide-arrow-left" class="w-5 h-5" />
        </template>
      </UButton>
    </div>
  </div>
</template>