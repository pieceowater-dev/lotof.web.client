<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import type { StaffRole } from '@/api/menu/staff/list';
import StaffRoleModal from '@/components/StaffRoleModal.vue';

const { t } = useI18n();

const props = defineProps<{
  modelValue: boolean;
  member?: { userId: string; username: string; email: string; nickname?: string | null } | null;
  currentRole?: StaffRole | null;
  saving?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
  (e: 'submit', payload: { userId: string; role: StaffRole | null }): void;
}>();

const NONE = 'NONE';

// OWNER is deliberately not offered here — it's auto-provisioned for the
// confirmed namespace owner on first login and can't be granted or changed
// through this modal (the backend rejects it either way; see
// StaffService.CreateStaff/UpdateStaffRole in menu.msvc.core).
const roleOptions = computed(() => [
  { label: t('menu.noRole') || 'No role', value: NONE },
  { label: t('menu.roleManager') || 'Manager', value: 'MANAGER' },
  { label: t('menu.roleCook') || 'Specialist', value: 'COOK' },
  { label: t('menu.roleOperator') || 'Operator', value: 'OPERATOR' },
  { label: t('menu.roleCourier') || 'Courier', value: 'COURIER' },
]);

const ROLE_DESCRIPTION_KEYS: Record<string, string> = {
  MANAGER: 'menu.roleManagerDesc',
  COOK: 'menu.roleCookDesc',
  OPERATOR: 'menu.roleOperatorDesc',
  COURIER: 'menu.roleCourierDesc',
};
const roleDescriptions = computed(() =>
  Object.fromEntries(Object.entries(ROLE_DESCRIPTION_KEYS).map(([value, key]) => [value, t(key)])),
);

function handleSubmit(payload: { userId: string; role: string | null }) {
  emit('submit', payload as { userId: string; role: StaffRole | null });
}
</script>

<template>
  <StaffRoleModal
    :model-value="props.modelValue"
    :member="props.member"
    :current-role="props.currentRole"
    :saving="props.saving"
    :role-options="roleOptions"
    :role-descriptions="roleDescriptions"
    :title="t('menu.changeRole') || 'Change role'"
    :role-label="t('menu.role') || 'Role'"
    :cancel-label="t('app.cancel')"
    :save-label="t('app.save') || 'Save'"
    :loading-label="t('app.loading') || 'Loading...'"
    @update:model-value="emit('update:modelValue', $event)"
    @submit="handleSubmit"
  />
</template>
