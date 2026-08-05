<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import type { Cycle } from '@/api/tasks/cycle/list';

const { t } = useI18n();

const props = defineProps<{
  modelValue: boolean;
  cycle?: Cycle | null;
  saving?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
  (e: 'submit', payload: { name: string; startsAt?: string; endsAt?: string }): void;
}>();

const isOpen = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
});

const form = reactive({
  name: '',
  startsAt: '',
  endsAt: '',
});

watch(() => props.modelValue, (open) => {
  if (!open) return;
  form.name = props.cycle?.name || '';
  form.startsAt = props.cycle?.startsAt ? props.cycle.startsAt.slice(0, 10) : '';
  form.endsAt = props.cycle?.endsAt ? props.cycle.endsAt.slice(0, 10) : '';
}, { immediate: true });

const isFormValid = computed(() => form.name.trim().length > 0);

function handleClose() {
  isOpen.value = false;
}
function handleSubmit() {
  if (!isFormValid.value) return;
  emit('submit', {
    name: form.name.trim(),
    startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : undefined,
    endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : undefined,
  });
}
</script>

<template>
  <UModal v-model="isOpen" @close="handleClose">
    <UCard :ui="{ ring: '' }">
      <template #header>
        <h3 class="text-lg font-semibold">{{ cycle ? (t('tasks.editSprint') || 'Edit sprint') : (t('tasks.newSprint') || 'New sprint') }}</h3>
      </template>

      <div class="space-y-4">
        <UFormGroup :label="t('tasks.sprintName') || 'Name'" required>
          <UInput v-model="form.name" size="lg" autofocus :placeholder="t('tasks.sprintNamePlaceholder') || 'Sprint 1'" @keyup.enter="handleSubmit" />
        </UFormGroup>
        <div class="grid grid-cols-2 gap-3">
          <UFormGroup :label="t('tasks.sprintStart') || 'Start date'">
            <UInput v-model="form.startsAt" type="date" size="lg" />
          </UFormGroup>
          <UFormGroup :label="t('tasks.sprintEnd') || 'End date'">
            <UInput v-model="form.endsAt" type="date" size="lg" />
          </UFormGroup>
        </div>
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
