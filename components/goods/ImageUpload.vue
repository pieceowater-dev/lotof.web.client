<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { useGoodsToken } from '@/composables/useGoodsToken';
import { logError } from '@/utils/logger';
import { getErrorMessage } from '@/utils/types/errors';

const { t } = useI18n();

const props = withDefaults(defineProps<{
  modelValue?: string | null;
  nsSlug: string;
}>(), {});

const emit = defineEmits<{
  (e: 'update:modelValue', v: string): void;
}>();

const fileInput = ref<HTMLInputElement | null>(null);
const uploading = ref(false);

function pickFile() {
  fileInput.value?.click();
}

async function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  uploading.value = true;
  try {
    const { current } = useGoodsToken();
    const goodsToken = current();
    if (!goodsToken) throw new Error('No goods token');
    const { goodsUploadImage } = await import('@/api/goods/media/upload');
    const result = await goodsUploadImage(goodsToken, props.nsSlug, file);
    emit('update:modelValue', result.url);
  } catch (err) {
    logError('[goods/ImageUpload] upload failed', err);
    useToast().add({ title: getErrorMessage(err, t) || t('goods.uploadFailed'), color: 'red' });
  } finally {
    uploading.value = false;
    if (fileInput.value) fileInput.value.value = '';
  }
}

function clearImage() {
  emit('update:modelValue', '');
}
</script>

<template>
  <div>
    <input
      ref="fileInput"
      type="file"
      accept="image/*"
      class="hidden"
      @change="onFileChange"
    >

    <div
      v-if="modelValue"
      class="group relative flex-shrink-0 w-28 h-28 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40"
    >
      <img :src="modelValue" class="w-full h-full object-cover">
      <div class="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex flex-col items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
        <UButton square size="2xs" color="white" variant="solid" :loading="uploading" @click="pickFile">
          <Icon name="lucide:upload" class="h-3.5 w-3.5" />
        </UButton>
        <UButton square size="2xs" color="red" variant="solid" @click="clearImage">
          <Icon name="lucide:trash-2" class="h-3.5 w-3.5" />
        </UButton>
      </div>
      <div v-if="uploading" class="absolute inset-0 bg-black/50 flex items-center justify-center">
        <Icon name="lucide:loader-2" class="h-5 w-5 text-white animate-spin" />
      </div>
    </div>

    <button
      v-else
      type="button"
      class="flex flex-shrink-0 flex-col items-center justify-center gap-1.5 w-28 h-28 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-primary-400 dark:hover:border-primary-600 text-gray-400 hover:text-primary-500 transition-colors"
      :disabled="uploading"
      @click="pickFile"
    >
      <Icon :name="uploading ? 'lucide:loader-2' : 'lucide:image-plus'" class="h-6 w-6" :class="{ 'animate-spin': uploading }" />
      <span class="text-xs font-medium">{{ uploading ? t('common.loading') : t('goods.uploadImage') }}</span>
    </button>
  </div>
</template>
