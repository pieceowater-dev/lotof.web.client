<script lang="ts" setup>
import { computed } from 'vue';

interface Props {
  title?: string;
  address?: string;
  qrImage?: string | null;
  loading?: boolean;
  postId?: string;
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  address: '',
  qrImage: null,
  loading: false,
  postId: '',
});

const emit = defineEmits<{
  (e: 'print'): void;
  (e: 'close'): void;
}>();

const hasContent = computed(() => !!props.title || !!props.address);
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 bg-black/50 dark:bg-black/70 z-[9999] flex items-center justify-center p-4">
      <div class="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full p-8 relative">
      <!-- Close button -->
      <button
        @click="$emit('close')"
        class="absolute top-4 right-4 p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
      >
        <UIcon name="i-lucide-x" class="w-5 h-5 text-gray-500 dark:text-gray-400" />
      </button>

      <div class="flex flex-col items-center">
        <!-- Header -->
        <div class="flex items-center gap-2 mb-6">
          <UIcon name="i-lucide-printer" class="w-6 h-6 text-blue-500 dark:text-blue-400" />
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white">QR для печати</h2>
        </div>

        <!-- Content -->
        <div class="w-full flex flex-col items-center">
          <!-- Title and Address -->
          <div v-if="hasContent" class="text-center mb-6 w-full">
            <div v-if="props.title" class="text-lg font-semibold text-gray-900 dark:text-white mb-1">
              {{ props.title }}
            </div>
            <div v-if="props.address" class="text-sm text-gray-600 dark:text-gray-300">
              {{ props.address }}
            </div>
          </div>

          <!-- QR Code -->
          <div v-if="props.qrImage" class="bg-gray-50 dark:bg-gray-800 rounded-xl p-6 mb-4 flex flex-col items-center justify-center w-full">
            <img
              :src="props.qrImage"
              alt="QR Code"
              class="qr-image w-full max-w-xs h-auto aspect-square object-contain"
              style="max-width: 200px; min-width: 160px;"
            />
            <!-- Post ID всегда показываем -->
            <div class="post-id mt-3 text-xs text-gray-500 dark:text-gray-400 font-mono">
              ID: {{ props.postId || 'N/A' }}
            </div>
          </div>

          <!-- Loading state -->
          <div v-else-if="props.loading" class="flex items-center justify-center py-12">
            <div class="flex flex-col items-center gap-3">
              <UIcon name="i-lucide-loader" class="w-8 h-8 text-blue-500 dark:text-blue-400 animate-spin" />
              <p class="text-sm text-gray-600 dark:text-gray-400">Генерирую QR...</p>
            </div>
          </div>

          <!-- Info text -->
          <div class="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg p-3 mb-6 text-sm text-center w-full">
            <div class="flex items-start gap-2">
              <UIcon name="i-lucide-info" class="w-4 h-4 mt-0.5 flex-shrink-0" />
              <p>
                Проверь информацию перед печатью.
                <br />
                QR содержит статический код.
              </p>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex gap-3 w-full">
            <UButton
              color="primary"
              variant="soft"
              class="flex-1"
              @click="$emit('close')"
            >
              Отмена
            </UButton>
            <UButton
              color="primary"
              icon="i-lucide-printer"
              class="flex-1"
              :disabled="!props.qrImage || props.loading"
              @click="$emit('print')"
            >
              Печать
            </UButton>
          </div>
        </div>
      </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.animate-spin {
  animation: spin 1s linear infinite;
}

.dark .qr-image {
  filter: invert(0.8) hue-rotate(180deg);
}

@media print {
  /* Скрыть оверлей и сделать модальное окно статичным */
  :deep(.fixed.inset-0) {
    position: static !important;
    background: white !important;
  }
  
  /* Убрать все кнопки при печати */
  :deep(button) {
    display: none !important;
  }
  
  /* Скрыть информационный блок */
  :deep(.bg-blue-50),
  :deep([class*="bg-blue-900"]) {
    display: none !important;
  }
  
  /* Убрать декоративные стили */
  :deep(.rounded-2xl),
  :deep(.shadow-2xl),
  :deep(.rounded-xl) {
    border-radius: 0 !important;
    box-shadow: none !important;
  }
  
  /* Оптимизация отступов для печати */
  :deep(.p-8) {
    padding: 10mm !important;
  }
  
  :deep(.mb-6),
  :deep(.mb-4) {
    margin-bottom: 5mm !important;
  }
  
  /* Заголовок */
  :deep(.text-xl) {
    font-size: 14pt !important;
    margin-bottom: 5mm !important;
  }
  
  /* Адрес и текст */
  :deep(.text-sm) {
    font-size: 10pt !important;
  }
  
  :deep(.text-lg) {
    font-size: 12pt !important;
  }
  
  /* QR код - фиксированный размер для печати */
  .qr-image {
    max-width: 50mm !important;
    width: 50mm !important;
    height: auto !important;
    filter: none !important;
  }
  
  /* Контейнер QR */
  :deep(.bg-gray-50) {
    background: transparent !important;
    padding: 5mm !important;
  }
  
  /* Post ID - гарантировать отображение */
  .post-id,
  :deep(.post-id),
  :deep(.font-mono),
  .font-mono {
    display: block !important;
    font-size: 10pt !important;
    margin-top: 3mm !important;
    color: #000 !important;
    visibility: visible !important;
    text-align: center !important;
  }
  
  /* Текст ID должен быть виден */
  :deep(.text-xs) {
    font-size: 10pt !important;
  }
  
  /* Настройки страницы */
  @page {
    size: A4 portrait;
    margin: 15mm;
  }
  
  /* Убрать лишние отступы */
  body {
    margin: 0;
    padding: 0;
  }
}
</style>

<!-- Глобальные стили для печати (без scoped) -->
<style>
@media print {
  /* Убрать все лишнее */
  body * {
    visibility: hidden !important;
  }
  
  /* Показать только контейнер печати */
  .fixed.inset-0,
  .fixed.inset-0 *,
  .bg-white,
  .bg-white *,
  .qr-image,
  .post-id {
    visibility: visible !important;
  }
  
  /* Post ID - максимально агрессивные стили */
  .post-id {
    display: block !important;
    font-size: 14pt !important;
    margin-top: 5mm !important;
    color: #000 !important;
    visibility: visible !important;
    text-align: center !important;
    font-family: monospace !important;
    font-weight: bold !important;
    opacity: 1 !important;
    position: relative !important;
  }
}
</style>
