<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { useAtraceMembers } from '@/composables/useAtraceMembers';
import { useAuth } from '@/composables/useAuth';
import type { AtraceLeaveType } from '@/api/atrace/schedule/leave';

const props = defineProps<{
  modelValue: boolean;
  nsSlug: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'created'): void;
}>();

const { t } = useI18n();
const { user } = useAuth();
const nsSlugRef = computed(() => props.nsSlug);
const { members, loadMembers } = useAtraceMembers(nsSlugRef);
// Only active employees can take leave -- an inactive/deactivated member
// showing up here would let someone request leave for someone who no longer
// works here.
const activeMembers = computed(() => members.value.filter((m) => m.isActive));

const isOpen = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
});

const typeOptions = computed(() => [
  { value: 'day_off' as AtraceLeaveType, label: t('app.leaveTypeDayOff') || 'Отгул' },
  { value: 'vacation' as AtraceLeaveType, label: t('app.leaveTypeVacation') || 'Отпуск' },
]);

const formUserId = ref('');
const formType = ref<AtraceLeaveType>('day_off');
const formStartDate = ref(new Date().toISOString().split('T')[0]);
const formEndDate = ref(new Date().toISOString().split('T')[0]);
const formComment = ref('');
const saving = ref(false);
const error = ref<string | null>(null);

watch(isOpen, async (open) => {
  if (!open) return;
  const today = new Date().toISOString().split('T')[0];
  formStartDate.value = today;
  formEndDate.value = today;
  formType.value = 'day_off';
  // The common case by far is someone requesting their own leave -- default
  // to the current user instead of making them find themselves in the list
  // every time. Still just a default: a manager filing this on someone
  // else's behalf can change it.
  formUserId.value = user.value?.id || '';
  formComment.value = '';
  error.value = null;
  if (members.value.length === 0) await loadMembers();
});

const isRangeValid = computed(() => !formStartDate.value || !formEndDate.value || formStartDate.value <= formEndDate.value);

async function submitRequest() {
  if (!formUserId.value || !formStartDate.value || !formEndDate.value || !isRangeValid.value) return;
  saving.value = true;
  error.value = null;
  try {
    const { atraceRequestLeave } = await import('@/api/atrace/schedule/leave');
    await atraceRequestLeave(formUserId.value, formStartDate.value, formEndDate.value, formType.value, formComment.value, props.nsSlug);
    isOpen.value = false;
    emit('created');
  } catch (e: any) {
    error.value = t('app.saveFailed') || 'Не удалось создать запрос';
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <UModal
    v-model="isOpen"
    :ui="{ width: 'w-full sm:max-w-lg' }"
  >
    <UCard>
      <template #header>
        <h3 class="text-base font-semibold">
          {{ t('app.requestLeave') || 'Запросить отгул/отпуск' }}
        </h3>
      </template>

      <div class="flex flex-col gap-3">
        <div
          v-if="error"
          class="p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-700 dark:text-red-200"
        >
          {{ error }}
        </div>
        <UFormGroup :label="t('app.leaveEmployee') || 'Сотрудник'">
          <USelectMenu
            v-model="formUserId"
            :options="activeMembers.map(m => ({ value: m.userId, label: m.username || m.email }))"
            value-attribute="value"
            option-attribute="label"
            searchable
          />
        </UFormGroup>
        <UFormGroup :label="t('app.leaveType') || 'Тип'">
          <USelectMenu
            v-model="formType"
            :options="typeOptions"
            value-attribute="value"
            option-attribute="label"
          />
        </UFormGroup>
        <div class="grid grid-cols-2 gap-3">
          <UFormGroup :label="t('app.leaveStartDate') || 'С'">
            <input
              v-model="formStartDate"
              type="date"
              class="w-full px-2 py-1.5 border rounded dark:bg-gray-800 dark:border-gray-700 text-sm"
            >
          </UFormGroup>
          <UFormGroup :label="t('app.leaveEndDate') || 'По'">
            <input
              v-model="formEndDate"
              type="date"
              class="w-full px-2 py-1.5 border rounded dark:bg-gray-800 dark:border-gray-700 text-sm"
            >
          </UFormGroup>
        </div>
        <p
          v-if="!isRangeValid"
          class="text-xs text-red-600 dark:text-red-400"
        >
          {{ t('app.leaveRangeInvalid') || 'Дата окончания раньше даты начала' }}
        </p>
        <UFormGroup :label="t('common.comment') || 'Комментарий'">
          <UInput v-model="formComment" />
        </UFormGroup>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton
            variant="soft"
            color="gray"
            @click="isOpen = false"
          >
            {{ t('common.cancel') }}
          </UButton>
          <UButton
            color="primary"
            :loading="saving"
            :disabled="!formUserId || !formStartDate || !formEndDate || !isRangeValid"
            @click="submitRequest"
          >
            {{ t('app.save') }}
          </UButton>
        </div>
      </template>
    </UCard>
  </UModal>
</template>
