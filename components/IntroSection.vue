<template>
  <div class="flex flex-col items-center justify-center min-h-[65vh] text-center">
    <div class="flex flex-col items-center justify-center my-10">
      <img
        src="/assets/logo.png"
        alt="Logo"
        class="h-20 w-20"
      >
      <span class="text-5xl font-thin text-primary">{{ title || t('app.title') }}</span>
    </div>
    <span class="text-3xl font-bold mr-2 ml-2 bg-gradient-to-r from-blue-600 to-emerald-600 text-transparent bg-clip-text">{{ subtitle || t('app.tagline') }}</span>
    <span class="text-xl text-gray-600 dark:text-gray-400 mr-2 ml-2">{{ description || t('app.description') }}</span>

    <button
      class="mt-8 px-6 py-3 rounded-lg bg-white border border-gray-300 shadow-sm hover:shadow-md hover:border-gray-400 transition-all flex items-center justify-center gap-2 font-medium text-gray-700 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200 dark:hover:border-gray-500"
      :disabled="isLoading"
      @click="handleClick"
    >
      <USpinner v-if="isLoading" size="sm" />
      <svg v-else class="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
      {{ buttonText || t('app.loginWithGoogle') }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue';
import { useI18n } from '@/composables/useI18n';

const { t } = useI18n();
const isLoading = ref(false);

const props = defineProps({
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  description: { type: String, default: '' },
  buttonText: { type: String, default: '' },
  onAction: { type: Function as PropType<(...args: any[]) => void>, default: () => { } }
});

const handleClick = async () => {
  isLoading.value = true;
  await nextTick(); // Дайте DOM время перерендериться и показать спиннер
  try {
    await props.onAction();
  } finally {
    isLoading.value = false;
  }
};
</script>