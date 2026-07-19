<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import type { StaffRole } from '@/api/menu/staff/list';

const { t } = useI18n();

const props = defineProps<{
  modelValue: boolean;
  member?: { userId: string; username: string; email: string } | null;
  currentRole?: StaffRole | null;
  saving?: boolean;
}>();

// role: null means "No role" — the caller deletes the staff record (if any)
// to revoke access to this app entirely, rather than assigning a role.
const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
  (e: 'submit', payload: { userId: string; role: StaffRole | null }): void;
}>();

const isOpen = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
});

const NONE = 'NONE' as const;
type RoleSelection = StaffRole | typeof NONE;

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

const role = ref<RoleSelection>(NONE);

watch(() => [props.modelValue, props.member], () => {
  if (!props.modelValue) return;
  role.value = props.currentRole || NONE;
}, { immediate: true });

function handleClose() {
  isOpen.value = false;
}

function handleSubmit() {
  if (!props.member) return;
  emit('submit', { userId: props.member.userId, role: role.value === NONE ? null : role.value });
}
</script>

<template>
  <UModal v-model="isOpen" @close="handleClose">
    <UCard :ui="{ ring: '', divide: 'divide-y divide-gray-100 dark:divide-gray-800' }">
      <template #header>
        <div>
          <h3 class="text-lg font-semibold">
            {{ t('menu.changeRole') || 'Change role' }}
          </h3>
          <p v-if="member" class="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {{ member.username }} · {{ member.email }}
          </p>
        </div>
      </template>

      <div class="space-y-4">
        <UFormGroup :label="t('menu.role') || 'Role'" required>
          <USelectMenu
            v-model="role"
            :options="roleOptions"
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
            :disabled="saving"
            @click="handleSubmit"
          />
        </div>
      </template>
    </UCard>
  </UModal>
</template>
