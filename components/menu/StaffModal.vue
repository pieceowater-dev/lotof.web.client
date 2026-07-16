<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import type { MenuStaff, StaffRole } from '@/api/menu/staff/list';

const { t } = useI18n();

const props = defineProps<{
  modelValue: boolean;
  staff?: MenuStaff | null;
  members?: Array<{ userId: string; username: string; email: string }>;
  existingStaffIds?: string[];
  saving?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
  (e: 'submit', payload: { userId: string; role: StaffRole }): void;
}>();

const isOpen = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
});

const roleOptions = computed(() => [
  { label: t('menu.roleOwner') || 'Owner', value: 'OWNER' },
  { label: t('menu.roleManager') || 'Manager', value: 'MANAGER' },
  { label: t('menu.roleCook') || 'Cook', value: 'COOK' },
  { label: t('menu.roleOperator') || 'Operator', value: 'OPERATOR' },
  { label: t('menu.roleCourier') || 'Courier', value: 'COURIER' },
]);

// Only offer namespace members who aren't already on the staff list (unless
// we're editing that exact member's role).
const memberOptions = computed(() => {
  const taken = new Set((props.existingStaffIds || []).filter((id) => id !== props.staff?.userId));
  return (props.members || [])
    .filter((m) => !taken.has(m.userId))
    .map((m) => ({ label: m.username || m.email || (t('menu.unknownMember') || 'Unknown member'), value: m.userId }));
});

const editingMemberName = computed(() => {
  if (!props.staff) return '';
  return props.members?.find((m) => m.userId === props.staff!.userId)?.username || (t('menu.unknownMember') || 'Unknown member');
});

const form = reactive({
  userId: '',
  role: 'OPERATOR' as StaffRole,
});

watch(() => [props.modelValue, props.staff], () => {
  if (!props.modelValue) return;
  form.userId = props.staff?.userId || '';
  form.role = props.staff?.role || 'OPERATOR';
}, { immediate: true });

const isFormValid = computed(() => form.userId.trim().length > 0);

function handleClose() {
  isOpen.value = false;
}

function handleSubmit() {
  if (!isFormValid.value) return;
  emit('submit', { userId: form.userId.trim(), role: form.role });
}
</script>

<template>
  <UModal v-model="isOpen" @close="handleClose">
    <UCard :ui="{ ring: '', divide: 'divide-y divide-gray-100 dark:divide-gray-800' }">
      <template #header>
        <h3 class="text-lg font-semibold">
          {{ staff ? (t('menu.role') || 'Role') : (t('menu.addStaff') || 'Add staff') }}
        </h3>
      </template>

      <div class="space-y-4">
        <UFormGroup :label="t('menu.staffMember') || 'Staff member'" required>
          <UInput v-if="staff" :model-value="editingMemberName" size="lg" disabled />
          <USelectMenu
            v-else
            v-model="form.userId"
            :options="memberOptions"
            value-attribute="value"
            option-attribute="label"
            searchable
            :placeholder="t('menu.selectMember') || 'Select a member'"
          />
        </UFormGroup>
        <UFormGroup :label="t('menu.role') || 'Role'" required>
          <USelectMenu
            v-model="form.role"
            :options="roleOptions"
            value-attribute="value"
            option-attribute="label"
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
