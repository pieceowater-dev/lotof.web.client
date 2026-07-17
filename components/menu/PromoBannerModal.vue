<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import ImageUpload from '@/components/menu/ImageUpload.vue';
import type { MenuPromoBanner } from '@/api/menu/promobanner/list';

const { t } = useI18n();

const props = defineProps<{
  modelValue: boolean;
  nsSlug: string;
  banner?: MenuPromoBanner | null;
  saving?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
  (e: 'submit', payload: Record<string, any>): void;
}>();

const isOpen = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
});

const form = reactive({
  title: '',
  description: '',
  imageUrl: '',
  imageAlt: '',
  targetUrl: '',
  startDate: '',
  endDate: '',
  // This field didn't exist here at all before — every edit silently sent
  // no isActive at all, and the backend's Updates() call writes it
  // unconditionally, so every single edit was quietly turning banners off
  // (isActive defaults to false on save unless something sets it true).
  // New banners default to true to match what create() already does
  // server-side.
  isActive: true,
});

watch(() => [props.modelValue, props.banner], () => {
  if (!props.modelValue) return;
  const b = props.banner;
  form.title = b?.title || '';
  form.description = b?.description || '';
  form.imageUrl = b?.imageUrl || '';
  form.imageAlt = b?.imageAlt || '';
  form.targetUrl = b?.targetUrl || '';
  form.startDate = b?.startDate ? b.startDate.slice(0, 10) : '';
  form.endDate = b?.endDate ? b.endDate.slice(0, 10) : '';
  form.isActive = b ? b.isActive : true;
}, { immediate: true });

const isFormValid = computed(() => form.title.trim().length > 0 && form.imageUrl.trim().length > 0);

function handleClose() {
  isOpen.value = false;
}

function handleSubmit() {
  if (!isFormValid.value) return;
  emit('submit', {
    title: form.title.trim(),
    description: form.description.trim() || undefined,
    imageUrl: form.imageUrl.trim(),
    imageAlt: form.imageAlt.trim() || undefined,
    targetUrl: form.targetUrl.trim() || undefined,
    startDate: form.startDate || undefined,
    endDate: form.endDate || undefined,
    isActive: form.isActive,
  });
}
</script>

<template>
  <UModal v-model="isOpen" :ui="{ width: 'sm:max-w-xl' }" @close="handleClose">
    <UCard :ui="{ ring: '', divide: 'divide-y divide-gray-100 dark:divide-gray-800' }">
      <template #header>
        <h3 class="text-lg font-semibold">
          {{ banner ? (t('menu.editBanner') || 'Edit banner') : (t('menu.addBanner') || 'Add banner') }}
        </h3>
      </template>

      <div class="space-y-4">
        <!-- Live preview, matches the storefront card exactly -->
        <div>
          <div class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
            {{ t('menu.preview') || 'Preview' }}
          </div>
          <div class="w-64 h-28 rounded-xl overflow-hidden relative bg-gray-100 dark:bg-gray-800 mx-auto">
            <img v-if="form.imageUrl" :src="form.imageUrl" :alt="form.imageAlt || form.title" class="w-full h-full object-cover">
            <div v-else class="w-full h-full flex items-center justify-center text-gray-400">
              <Icon name="lucide:image" class="h-6 w-6" />
            </div>
            <div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-3">
              <span class="text-white text-sm font-semibold truncate">{{ form.title || (t('menu.bannerTitlePlaceholder') || 'Banner title') }}</span>
            </div>
          </div>
        </div>

        <UFormGroup :label="t('menu.image') || 'Image'" required>
          <ImageUpload v-model="form.imageUrl" :ns-slug="nsSlug" aspect="wide" />
        </UFormGroup>
        <UFormGroup :label="t('menu.name') || 'Title'" required>
          <UInput v-model="form.title" size="lg" />
        </UFormGroup>
        <UFormGroup :label="t('menu.description') || 'Description'">
          <UTextarea v-model="form.description" :rows="2" />
        </UFormGroup>
        <UFormGroup :label="t('menu.imageAlt') || 'Image alt text'">
          <UInput v-model="form.imageAlt" size="lg" />
        </UFormGroup>
        <UFormGroup :label="t('menu.targetUrl') || 'Target URL'">
          <UInput v-model="form.targetUrl" size="lg" />
        </UFormGroup>
        <div class="grid grid-cols-2 gap-4">
          <UFormGroup :label="t('menu.startDate') || 'Start date'">
            <UInput v-model="form.startDate" type="date" size="lg" />
          </UFormGroup>
          <UFormGroup :label="t('menu.endDate') || 'End date'">
            <UInput v-model="form.endDate" type="date" size="lg" />
          </UFormGroup>
        </div>
        <label class="flex items-center justify-between rounded-xl border border-gray-200 dark:border-gray-800 px-3.5 py-2.5 cursor-pointer">
          <span class="flex items-center gap-2 text-sm font-medium">
            <Icon name="lucide:eye" class="h-4 w-4 text-gray-400" />
            {{ t('menu.bannerActive') || 'Shown on storefront' }}
          </span>
          <UToggle v-model="form.isActive" />
        </label>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton color="gray" variant="ghost" :label="t('app.cancel')" @click="handleClose" />
          <UButton
            color="primary"
            :label="saving ? (t('app.loading') || 'Loading...') : (t('app.save') || 'Save')"
            :loading="saving"
            :disabled="!isFormValid || saving"
            @click="handleSubmit"
          />
        </div>
      </template>
    </UCard>
  </UModal>
</template>
