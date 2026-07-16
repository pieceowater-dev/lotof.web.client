<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import type { MenuCategory } from '@/api/menu/category/list';

const { t } = useI18n();

const props = defineProps<{
  modelValue: boolean;
  category?: MenuCategory | null;
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
  name: '',
});

watch(() => [props.modelValue, props.category], () => {
  if (!props.modelValue) return;
  form.name = props.category?.name || '';
}, { immediate: true });

const isFormValid = computed(() => form.name.trim().length > 0);

function handleClose() {
  isOpen.value = false;
}

function handleSubmit() {
  if (!isFormValid.value) return;
  emit('submit', {
    name: form.name.trim(),
  });
}
</script>

<template>
  <UModal v-model="isOpen" @close="handleClose">
    <UCard :ui="{ ring: '', divide: 'divide-y divide-gray-100 dark:divide-gray-800' }">
      <template #header>
        <h3 class="text-lg font-semibold">
          {{ category ? (t('menu.editCategory') || 'Edit category') : (t('menu.createCategory') || 'Add category') }}
        </h3>
      </template>

      <div class="space-y-4">
        <UFormGroup :label="t('menu.name') || 'Name'" required>
          <UInput v-model="form.name" size="lg" />
        </UFormGroup>
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
