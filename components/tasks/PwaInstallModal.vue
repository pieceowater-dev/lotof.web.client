<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { usePwaInstall } from '@/composables/usePwaInstall';

const { t } = useI18n();
const { platform, canPromptInstall, promptInstall } = usePwaInstall();

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>();

const isOpen = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
});

const installing = ref(false);
async function handleInstallClick() {
  installing.value = true;
  try {
    const accepted = await promptInstall();
    if (accepted) isOpen.value = false;
  } finally {
    installing.value = false;
  }
}

const qrDataUrl = ref('');
watch([isOpen, platform], async ([open, p]) => {
  if (!open || p !== 'desktop' || typeof window === 'undefined') return;
  const QRCode = (await import('qrcode')).default;
  qrDataUrl.value = await QRCode.toDataURL(window.location.href, { width: 176, margin: 1 });
}, { immediate: true });
</script>

<template>
  <UModal v-model="isOpen" :ui="{ width: 'sm:max-w-sm' }">
    <UCard :ui="{ ring: '' }">
      <template #header>
        <h3 class="text-lg font-semibold">{{ t('tasks.installApp') || 'Install app' }}</h3>
      </template>

      <!-- Desktop: this PWA is meant to run on the courier's phone, so the
           most useful thing we can offer here is a way to get the link onto
           one -- a scannable QR code beats asking them to type a URL. -->
      <div v-if="platform === 'desktop'" class="flex flex-col items-center text-center gap-3 py-2">
        <UIcon name="lucide:smartphone" class="w-8 h-8 text-gray-400" />
        <p class="text-sm text-gray-600 dark:text-gray-300">
          {{ t('tasks.pwaDesktopHint') || 'Open this page on your phone to install the app.' }}
        </p>
        <img v-if="qrDataUrl" :src="qrDataUrl" alt="QR" class="rounded-lg border border-gray-200 dark:border-gray-800" width="176" height="176" />
      </div>

      <!-- Android with the native install prompt available: skip the manual
           steps entirely. -->
      <div v-else-if="platform === 'android' && canPromptInstall" class="flex flex-col items-center text-center gap-3 py-2">
        <UIcon name="lucide:download" class="w-8 h-8 text-primary-500" />
        <p class="text-sm text-gray-600 dark:text-gray-300">
          {{ t('tasks.pwaAndroidPromptHint') || 'Install this app for quick, full-screen access from your home screen.' }}
        </p>
        <UButton color="primary" :loading="installing" icon="lucide:download" @click="handleInstallClick">
          {{ t('tasks.pwaInstallNow') || 'Install' }}
        </UButton>
      </div>

      <!-- Android fallback / no native prompt fired yet. -->
      <ol v-else-if="platform === 'android'" class="space-y-3 text-sm">
        <li class="flex items-start gap-2.5">
          <span class="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 text-xs font-semibold">1</span>
          <span class="flex items-center gap-1.5 flex-wrap">{{ t('tasks.pwaAndroidStep1') || 'Tap the menu button' }} <UIcon name="lucide:more-vertical" class="w-4 h-4 inline" /> {{ t('tasks.pwaAndroidStep1b') || 'in your browser' }}</span>
        </li>
        <li class="flex items-start gap-2.5">
          <span class="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 text-xs font-semibold">2</span>
          <span>{{ t('tasks.pwaAndroidStep2') || 'Tap "Install app" or "Add to Home screen"' }}</span>
        </li>
        <li class="flex items-start gap-2.5">
          <span class="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 text-xs font-semibold">3</span>
          <span>{{ t('tasks.pwaAndroidStep3') || 'Confirm to add it to your home screen' }}</span>
        </li>
      </ol>

      <!-- iOS Safari never exposes an install API -- these steps are the
           only way. -->
      <ol v-else class="space-y-3 text-sm">
        <li class="flex items-start gap-2.5">
          <span class="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 text-xs font-semibold">1</span>
          <span class="flex items-center gap-1.5 flex-wrap">{{ t('tasks.pwaIosStep1') || 'Tap the Share button' }} <UIcon name="lucide:square-arrow-up" class="w-4 h-4 inline" /> {{ t('tasks.pwaIosStep1b') || 'in Safari\'s toolbar' }}</span>
        </li>
        <li class="flex items-start gap-2.5">
          <span class="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 text-xs font-semibold">2</span>
          <span>{{ t('tasks.pwaIosStep2') || 'Scroll down and tap "Add to Home Screen"' }}</span>
        </li>
        <li class="flex items-start gap-2.5">
          <span class="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 text-xs font-semibold">3</span>
          <span>{{ t('tasks.pwaIosStep3') || 'Tap "Add" in the top-right corner' }}</span>
        </li>
      </ol>

      <template #footer>
        <div class="flex justify-end">
          <UButton color="gray" variant="ghost" :label="t('app.close') || 'Close'" @click="isOpen = false" />
        </div>
      </template>
    </UCard>
  </UModal>
</template>
