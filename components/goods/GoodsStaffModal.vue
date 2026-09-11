<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import type { GoodsStaffRole } from '@/composables/useGoodsStaffRole';
import StaffRoleModal from '@/components/StaffRoleModal.vue';

const { t } = useI18n();

const props = defineProps<{
  modelValue: boolean;
  member?: { userId: string; username: string; email: string; nickname?: string | null } | null;
  currentRole?: GoodsStaffRole | null;
  saving?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
  (e: 'submit', payload: { userId: string; role: GoodsStaffRole | null }): void;
}>();

const NONE = 'NONE';

// OWNER is deliberately not offered here — it's auto-provisioned for the
// confirmed namespace owner on first login and can't be granted or changed
// through this modal (the backend rejects it either way; see
// StaffService.UpdateStaffRole/DeleteStaff in goods.msvc.core).
const roleOptions = computed(() => [
  { label: t('goods.noRole'), value: NONE },
  { label: t('goods.roleManager'), value: 'MANAGER' },
  { label: t('goods.roleCashier'), value: 'CASHIER' },
  { label: t('goods.roleStockkeeper'), value: 'STOCKKEEPER' },
  { label: t('goods.roleViewer'), value: 'VIEWER' },
]);

const ROLE_DESCRIPTION_KEYS: Record<string, string> = {
  MANAGER: 'goods.roleManagerDesc',
  CASHIER: 'goods.roleCashierDesc',
  STOCKKEEPER: 'goods.roleStockkeeperDesc',
  VIEWER: 'goods.roleViewerDesc',
};
const roleDescriptions = computed(() =>
  Object.fromEntries(Object.entries(ROLE_DESCRIPTION_KEYS).map(([value, key]) => [value, t(key)])),
);

function handleSubmit(payload: { userId: string; role: string | null }) {
  emit('submit', payload as { userId: string; role: GoodsStaffRole | null });
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
    :title="t('goods.changeRole')"
    :role-label="t('goods.role')"
    :cancel-label="t('common.cancel')"
    :save-label="t('common.save')"
    :loading-label="t('common.loading')"
    @update:model-value="emit('update:modelValue', $event)"
    @submit="handleSubmit"
  />
</template>
