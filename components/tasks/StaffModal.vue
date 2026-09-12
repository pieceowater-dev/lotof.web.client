<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import type { TasksStaffRoleValue } from '@/api/tasks/staff/list';
import StaffRoleModal from '@/components/ui/StaffRoleModal.vue';

const { t } = useI18n();

const props = defineProps<{
  modelValue: boolean;
  member?: { userId: string; username: string; email: string; nickname?: string | null } | null;
  currentRole?: TasksStaffRoleValue | null;
  saving?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
  (e: 'submit', payload: { userId: string; role: TasksStaffRoleValue | null }): void;
}>();

const NONE = 'NONE';

// OWNER is deliberately not offered here — it's auto-provisioned for the
// confirmed namespace owner on first login and can't be granted or changed
// through this modal (the backend rejects it either way).
const roleOptions = computed(() => [
  { label: t('tasks.noRole') || 'No role', value: NONE },
  { label: t('tasks.roleManager') || 'Manager', value: 'MANAGER' },
  { label: t('tasks.roleAssignee') || 'Assignee', value: 'ASSIGNEE' },
  { label: t('tasks.roleViewer') || 'Viewer', value: 'VIEWER' },
]);

const ROLE_DESCRIPTION_KEYS: Record<string, string> = {
  MANAGER: 'tasks.roleManagerDesc',
  ASSIGNEE: 'tasks.roleAssigneeDesc',
  VIEWER: 'tasks.roleViewerDesc',
};
const roleDescriptions = computed(() =>
  Object.fromEntries(Object.entries(ROLE_DESCRIPTION_KEYS).map(([value, key]) => [value, t(key)])),
);

function handleSubmit(payload: { userId: string; role: string | null }) {
  emit('submit', payload as { userId: string; role: TasksStaffRoleValue | null });
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
    :title="t('tasks.changeRole') || 'Change role'"
    :role-label="t('tasks.role') || 'Role'"
    :cancel-label="t('app.cancel')"
    :save-label="t('app.save') || 'Save'"
    :loading-label="t('app.loading') || 'Loading...'"
    @update:model-value="emit('update:modelValue', $event)"
    @submit="handleSubmit"
  />
</template>
