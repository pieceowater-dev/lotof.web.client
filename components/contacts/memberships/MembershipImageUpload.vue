<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { compressImageForUpload } from '@/utils/imageCompression';
import { logError } from '@/utils/logger';
import { getErrorMessage } from '@/utils/types/errors';

// Same UX as components/menu/ImageUpload.vue (drop target, hover replace/
// remove, loading state). The Contacts domain has no S3/upload endpoint, so
// instead of POSTing to a gateway this compresses the file in the browser and
// stores it inline as a base64 data: URI — good enough for a logo/cover and
// it renders everywhere with no extra infra.
const { t } = useI18n();

const props = withDefaults(defineProps<{
  modelValue?: string | null;
  aspect?: 'square' | 'wide';
  /** 'cover' fills the frame (photos); 'contain' never crops (logos). */
  fit?: 'cover' | 'contain';
  /** max pixel dimension for the stored image */
  maxDimension?: number;
}>(), {
  modelValue: '',
  aspect: 'wide',
  fit: 'cover',
  maxDimension: 900,
});

const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>();

const fileInput = ref<HTMLInputElement | null>(null);
const uploading = ref(false);

function pickFile() {
  fileInput.value?.click();
}

function readAsDataURL(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error || new Error('read failed'));
    reader.readAsDataURL(file);
  });
}

async function onFileChange(e: Event) {
  const picked = (e.target as HTMLInputElement).files?.[0];
  if (!picked) return;
  uploading.value = true;
  try {
    const compressed = await compressImageForUpload(picked, {
      t,
      maxDimension: props.maxDimension,
      quality: 0.74,
    });
    const dataUrl = await readAsDataURL(compressed);
    // Guard: keep the stored blob modest (~180 KB of base64).
    if (dataUrl.length > 240_000) {
      useToast().add({ title: t('membership.imageTooHeavy') || 'Картинка слишком тяжёлая даже после сжатия — выберите проще или меньше', color: 'red' });
      return;
    }
    emit('update:modelValue', dataUrl);
  } catch (err) {
    logError('[MembershipImageUpload] failed', err);
    useToast().add({ title: getErrorMessage(err, t) || 'Не удалось загрузить изображение', color: 'red' });
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
      class="group relative flex-shrink-0 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40"
      :class="aspect === 'square' ? 'w-28 h-28' : 'aspect-video w-full'"
    >
      <img
        :src="modelValue"
        class="w-full h-full"
        :class="fit === 'contain' ? 'object-contain p-2' : 'object-cover'"
      >
      <div
        class="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100"
        :class="aspect === 'square' ? 'flex-col gap-1' : 'flex-row gap-2'"
      >
        <UButton
          :icon="aspect === 'square' ? undefined : 'lucide:upload'"
          :square="aspect === 'square'"
          :size="aspect === 'square' ? '2xs' : 'xs'"
          color="white"
          variant="solid"
          :loading="uploading"
          @click="pickFile"
        >
          <UIcon
            v-if="aspect === 'square'"
            name="lucide:upload"
            class="h-3.5 w-3.5"
          />
          <template v-else>
            {{ t('membership.replaceImage') || 'Заменить' }}
          </template>
        </UButton>
        <UButton
          icon="lucide:trash-2"
          :square="aspect === 'square'"
          :size="aspect === 'square' ? '2xs' : 'xs'"
          color="red"
          variant="solid"
          @click="clearImage"
        />
      </div>
      <div
        v-if="uploading"
        class="absolute inset-0 bg-black/50 flex items-center justify-center"
      >
        <UIcon
          name="lucide:loader-2"
          class="h-5 w-5 text-white animate-spin"
        />
      </div>
    </div>

    <button
      v-else
      type="button"
      class="flex flex-shrink-0 flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-primary-400 dark:hover:border-primary-600 text-gray-400 hover:text-primary-500 transition-colors"
      :class="aspect === 'square' ? 'w-28 h-28' : 'aspect-video w-full'"
      :disabled="uploading"
      @click="pickFile"
    >
      <UIcon
        :name="uploading ? 'lucide:loader-2' : 'lucide:image-plus'"
        class="h-6 w-6"
        :class="{ 'animate-spin': uploading }"
      />
      <span class="text-xs font-medium">{{ uploading ? (t('app.loading') || 'Загрузка…') : (t('membership.uploadImage') || 'Загрузить фото') }}</span>
    </button>
  </div>
</template>
