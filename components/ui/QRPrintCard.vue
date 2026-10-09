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
    <div
      class="fixed inset-0 z-[9999] flex items-center justify-center bg-gray-900/30 p-4 backdrop-blur-sm dark:bg-gray-950/60"
      @click.self="$emit('close')"
    >
      <div class="relative max-h-full w-full max-w-md overflow-y-auto rounded-[2rem] bg-white p-6 shadow-2xl ring-1 ring-black/5 dark:bg-[#1a1a1a] dark:ring-white/10 sm:p-8">
        <!-- Header -->
        <div class="mb-5 flex items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <span class="icon-tile !h-10 !w-10 !rounded-xl"><UIcon
              name="i-lucide-printer"
              class="h-5 w-5"
            /></span>
            <h2 class="text-lg font-extrabold tracking-tight text-gray-900 dark:text-white">
              QR для печати
            </h2>
          </div>
          <button
            type="button"
            class="hdr-icon-btn"
            aria-label="Close"
            @click="$emit('close')"
          >
            <UIcon
              name="i-lucide-x"
              class="h-4 w-4"
            />
          </button>
        </div>

        <div class="flex w-full flex-col items-center">
          <!-- Title and Address -->
          <div
            v-if="hasContent"
            class="mb-4 w-full text-center"
          >
            <div
              v-if="props.title"
              class="text-lg font-extrabold tracking-tight text-gray-900 dark:text-white"
            >
              {{ props.title }}
            </div>
            <div
              v-if="props.address"
              class="mt-0.5 text-sm text-gray-500 dark:text-gray-400"
            >
              {{ props.address }}
            </div>
          </div>

          <!-- QR Code: always on white so it stays scannable in dark mode -->
          <div
            v-if="props.qrImage"
            class="mb-4 flex w-full flex-col items-center justify-center rounded-[1.6rem] bg-white p-5 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.08),0_18px_36px_-28px_rgba(15,23,42,0.25)]"
          >
            <img
              :src="props.qrImage"
              alt="QR Code"
              class="qr-image w-full object-contain"
              style="max-width: 280px; min-width: 200px; aspect-ratio: 1 / 1;"
            >
            <!-- Post ID всегда показываем -->
            <div class="post-id mt-3 font-mono text-xs text-gray-500">
              ID: {{ props.postId || 'N/A' }}
            </div>
          </div>

          <!-- Loading state -->
          <div
            v-else-if="props.loading"
            class="flex items-center justify-center py-12"
          >
            <div class="flex flex-col items-center gap-3">
              <UIcon
                name="i-lucide-loader"
                class="h-8 w-8 animate-spin text-blue-500 dark:text-blue-300"
              />
              <p class="text-sm text-gray-600 dark:text-gray-400">
                Генерирую QR...
              </p>
            </div>
          </div>

          <!-- Info text -->
          <div class="at-banner mb-5 w-full !flex-row !items-start gap-2 !py-3 text-sm text-blue-700 dark:text-blue-200">
            <UIcon
              name="i-lucide-info"
              class="mt-0.5 h-4 w-4 flex-shrink-0"
            />
            <p>
              Проверь информацию перед печатью. QR содержит статический код.
            </p>
          </div>

          <!-- Actions -->
          <div class="flex w-full gap-3">
            <button
              type="button"
              class="at-btn flex-1 !py-2.5"
              @click="$emit('close')"
            >
              Отмена
            </button>
            <button
              type="button"
              class="at-btn at-btn--primary flex-1 !py-2.5 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="!props.qrImage || props.loading"
              @click="$emit('print')"
            >
              <UIcon
                name="i-lucide-printer"
                class="h-4 w-4"
              />
              Печать
            </button>
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
  :deep(.bg-emerald-50),
  :deep([class*="bg-emerald-900"]) {
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
    max-width: 80mm !important;
    width: 80mm !important;
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
