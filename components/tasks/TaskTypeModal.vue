<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import IconPicker from '@/components/tasks/IconPicker.vue';
import { TASK_TYPE_COLOR_PRESETS, ESTIMATION_TYPE_OPTIONS } from '@/utils/taskDisplay';
import type { TaskType } from '@/api/tasks/tasktype/list';

const { t } = useI18n();

const props = defineProps<{
  modelValue: boolean;
  taskType?: TaskType | null;
  memberOptions?: { label: string; value: string }[];
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

const estimationOptions = computed(() => ESTIMATION_TYPE_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) || o.value })));

const form = reactive({
  name: '',
  color: TASK_TYPE_COLOR_PRESETS[0].hex,
  icon: '',
  requiresLocation: false,
  slaMinutes: undefined as number | undefined,
  escalationUserId: '',
  estimationType: 'default',
});

watch(() => [props.modelValue, props.taskType], () => {
  if (!props.modelValue) return;
  const tt = props.taskType;
  form.name = tt?.name || '';
  form.color = tt?.color || TASK_TYPE_COLOR_PRESETS[0].hex;
  form.icon = tt?.icon || '';
  form.requiresLocation = tt?.requiresLocation || false;
  form.slaMinutes = tt?.slaMinutes ?? undefined;
  form.escalationUserId = tt?.escalationUserId || '';
  form.estimationType = tt?.estimationType || 'default';
}, { immediate: true });

const isFormValid = computed(() => form.name.trim().length > 0);

function handleClose() {
  isOpen.value = false;
}

function handleSubmit() {
  if (!isFormValid.value) return;
  emit('submit', {
    name: form.name.trim(),
    color: form.color || undefined,
    icon: form.icon.trim() || undefined,
    requiresLocation: form.requiresLocation,
    slaMinutes: form.slaMinutes || undefined,
    escalationUserId: form.slaMinutes ? (form.escalationUserId || undefined) : undefined,
    estimationType: form.estimationType,
  });
}
</script>

<template>
  <UModal v-model="isOpen" @close="handleClose" :ui="{ width: 'sm:max-w-md' }">
    <UCard :ui="{ ring: '' }">
      <template #header>
        <h3 class="text-lg font-semibold">
          {{ taskType ? (t('tasks.editTaskType') || 'Edit issue type') : (t('tasks.createTaskType') || 'Add issue type') }}
        </h3>
      </template>

      <div class="space-y-4">
        <div class="flex items-end gap-2">
          <IconPicker v-model="form.icon" />
          <UFormGroup :label="t('tasks.name') || 'Name'" required class="flex-1">
            <UInput v-model="form.name" size="lg" autofocus :placeholder="t('tasks.taskTypeNamePlaceholder') || 'Delivery, Procurement, Repair...'" />
          </UFormGroup>
        </div>

        <UFormGroup :label="t('tasks.color') || 'Color'">
          <div class="flex items-center gap-2">
            <button
              v-for="preset in TASK_TYPE_COLOR_PRESETS"
              :key="preset.name"
              type="button"
              class="h-7 w-7 rounded-full flex-shrink-0 ring-offset-2 ring-offset-white dark:ring-offset-gray-900 transition-shadow"
              :class="form.color === preset.hex && 'ring-2 ring-primary-500'"
              :style="{ backgroundColor: preset.hex }"
              :title="preset.name"
              @click="form.color = preset.hex"
            />
          </div>
        </UFormGroup>

        <div class="flex items-center justify-between gap-3 pt-1">
          <label class="flex items-center gap-2 text-sm cursor-pointer">
            <UToggle v-model="form.requiresLocation" />
            {{ t('tasks.requiresLocation') || 'Prompt for a location on this issue type' }}
          </label>
        </div>

        <div class="flex items-end gap-3">
          <UFormGroup :label="t('tasks.slaMinutes') || 'SLA (minutes)'" :hint="t('tasks.slaMinutesHint') || 'Optional escalation timer'">
            <UInput v-model.number="form.slaMinutes" type="number" min="1" size="lg" class="w-28" />
          </UFormGroup>
          <UFormGroup v-if="form.slaMinutes" :label="t('tasks.escalateTo') || 'Escalate to'" class="flex-1 min-w-0">
            <USelectMenu
              v-model="form.escalationUserId"
              :options="[{ label: t('tasks.noEscalation') || 'No one', value: '' }, ...(memberOptions || [])]"
              value-attribute="value"
              option-attribute="label"
              searchable
              size="lg"
              :popper="{ strategy: 'fixed' }"
            />
          </UFormGroup>
        </div>

        <UFormGroup :label="t('tasks.estimationType') || 'Report as'" :hint="t('tasks.estimationTypeHint') || 'How this issue type counts toward sprint burndown reports'">
          <USelectMenu
            v-model="form.estimationType"
            :options="estimationOptions"
            value-attribute="value"
            option-attribute="label"
            :popper="{ strategy: 'fixed' }"
          />
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
