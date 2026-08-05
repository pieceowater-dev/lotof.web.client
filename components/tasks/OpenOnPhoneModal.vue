<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';

const { t } = useI18n();

const props = defineProps<{ modelValue: boolean; url: string }>();
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>();

const isOpen = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
});

const qrDataUrl = ref('');
watch([isOpen, () => props.url], async ([open, url]) => {
  if (!open || !url || typeof window === 'undefined') return;
  const QRCode = (await import('qrcode')).default;
  qrDataUrl.value = await QRCode.toDataURL(url, { width: 176, margin: 1 });
}, { immediate: true });
</script>

<template>
  <UModal v-model="isOpen" :ui="{ width: 'sm:max-w-sm' }">
    <UCard :ui="{ ring: '' }">
      <template #header>
        <h3 class="text-lg font-semibold">{{ t('tasks.openOnPhone') || 'Open on your phone' }}</h3>
      </template>
      <div class="flex flex-col items-center text-center gap-3 py-2">
        <UIcon name="lucide:smartphone" class="w-8 h-8 text-gray-400" />
        <p class="text-sm text-gray-600 dark:text-gray-300">
          {{ t('tasks.pwaDesktopHint') || 'Open this page on your phone to install the app.' }}
        </p>
        <img v-if="qrDataUrl" :src="qrDataUrl" alt="QR" class="rounded-lg border border-gray-200 dark:border-gray-800" width="176" height="176" />
      </div>
      <template #footer>
        <div class="flex justify-end">
          <UButton color="gray" variant="ghost" :label="t('app.close') || 'Close'" @click="isOpen = false" />
        </div>
      </template>
    </UCard>
  </UModal>
</template>
