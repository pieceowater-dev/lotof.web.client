<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';

const { t } = useI18n();

const props = defineProps<{
  modelValue: boolean;
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

// Creating a board only ever asks for a name -- everything else (columns,
// modules, integrations) gets a sensible server-side default and is edited
// later from Board settings once the board actually exists. Cuts a
// one-field decision down from a wall of toggles nobody has context for yet.
const form = reactive({ name: '' });

watch(() => props.modelValue, (open) => {
  if (open) form.name = '';
});

const isFormValid = computed(() => form.name.trim().length > 0);

function handleClose() {
  isOpen.value = false;
}

function handleSubmit() {
  if (!isFormValid.value) return;
  emit('submit', { name: form.name.trim() });
}
</script>

<template>
  <UModal v-model="isOpen" @close="handleClose" :ui="{ width: 'sm:max-w-md' }">
    <UCard :ui="{ ring: '' }">
      <template #header>
        <h3 class="text-lg font-semibold">{{ t('tasks.createBoard') || 'Create board' }}</h3>
      </template>

      <div class="space-y-3">
        <UFormGroup :label="t('tasks.boardName') || 'Name'" required>
          <UInput v-model="form.name" size="lg" autofocus :placeholder="t('tasks.boardNamePlaceholder') || 'Delivery, Marketing, IT...'" @keyup.enter="handleSubmit" />
        </UFormGroup>
        <p class="text-xs text-gray-400">
          {{ t('tasks.createBoardHint') || 'You can set up columns, modules and integrations afterwards, from Board settings.' }}
        </p>
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
