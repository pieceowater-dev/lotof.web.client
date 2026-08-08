<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { useAtraceMembers } from '@/composables/useAtraceMembers';

const props = defineProps<{
  modelValue: boolean;
  nsSlug: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'created'): void;
}>();

const { t } = useI18n();
const nsSlugRef = computed(() => props.nsSlug);
const { members, loadMembers } = useAtraceMembers(nsSlugRef);
// Only active employees can cover or be covered -- an inactive/deactivated
// member showing up here would let someone request a swap involving
// someone who no longer works here.
const activeMembers = computed(() => members.value.filter((m) => m.isActive));

const isOpen = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
});

const formDate = ref(new Date().toISOString().split('T')[0]);
const formOriginalUserId = ref('');
const formCoveringUserId = ref('');
const formComment = ref('');
const saving = ref(false);
const error = ref<string | null>(null);

watch(isOpen, async (open) => {
  if (!open) return;
  formDate.value = new Date().toISOString().split('T')[0];
  formOriginalUserId.value = '';
  formCoveringUserId.value = '';
  formComment.value = '';
  error.value = null;
  if (members.value.length === 0) await loadMembers();
});

async function submitRequest() {
  if (!formOriginalUserId.value || !formCoveringUserId.value) return;
  saving.value = true;
  error.value = null;
  try {
    const { atraceRequestShiftCoverage } = await import('@/api/atrace/schedule/coverage');
    await atraceRequestShiftCoverage(formDate.value, formOriginalUserId.value, formCoveringUserId.value, formComment.value, props.nsSlug);
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
          {{ t('app.requestCoverage') || 'Запросить подмену' }}
        </h3>
      </template>

      <div class="flex flex-col gap-3">
        <div
          v-if="error"
          class="p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-700 dark:text-red-200"
        >
          {{ error }}
        </div>
        <UFormGroup :label="t('app.date') || 'Дата'">
          <input
            v-model="formDate"
            type="date"
            class="w-full px-2 py-1.5 border rounded dark:bg-gray-800 dark:border-gray-700 text-sm"
          >
        </UFormGroup>
        <UFormGroup :label="t('app.coverageOriginal') || 'Кого подменяют'">
          <USelectMenu
            v-model="formOriginalUserId"
            :options="activeMembers.map(m => ({ value: m.userId, label: m.username || m.email }))"
            value-attribute="value"
            option-attribute="label"
            searchable
          />
        </UFormGroup>
        <UFormGroup :label="t('app.coverageCovering') || 'Кто подменяет'">
          <USelectMenu
            v-model="formCoveringUserId"
            :options="activeMembers.map(m => ({ value: m.userId, label: m.username || m.email }))"
            value-attribute="value"
            option-attribute="label"
            searchable
          />
        </UFormGroup>
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
            :disabled="!formOriginalUserId || !formCoveringUserId"
            @click="submitRequest"
          >
            {{ t('app.save') }}
          </UButton>
        </div>
      </template>
    </UCard>
  </UModal>
</template>
