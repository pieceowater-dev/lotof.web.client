<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import type { GoodsStaffRole } from '@/composables/useGoodsStaffRole';
import { memberDisplayName } from '@/utils/memberDisplayName';

const { t } = useI18n();

const props = defineProps<{
  modelValue: boolean;
  member?: { userId: string; username: string; email: string; nickname?: string | null } | null;
  currentRole?: GoodsStaffRole | null;
  saving?: boolean;
}>();

// role: null means "No role" — the caller deletes the staff record (if any)
// to revoke access to this app entirely, rather than assigning a role.
const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
  (e: 'submit', payload: { userId: string; role: GoodsStaffRole | null }): void;
}>();

const isOpen = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
});

const NONE = 'NONE' as const;
type RoleSelection = GoodsStaffRole | typeof NONE;

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

const role = ref<RoleSelection>(NONE);

const ROLE_DESCRIPTION_KEYS: Record<string, string> = {
  MANAGER: 'goods.roleManagerDesc',
  CASHIER: 'goods.roleCashierDesc',
  STOCKKEEPER: 'goods.roleStockkeeperDesc',
  VIEWER: 'goods.roleViewerDesc',
};
const roleDescription = computed(() => {
  const key = ROLE_DESCRIPTION_KEYS[role.value];
  return key ? t(key) : '';
});

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
          <h3 class="text-lg font-semibold">{{ t('goods.changeRole') }}</h3>
          <p v-if="member" class="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {{ memberDisplayName(member) }} · {{ member.email }}
          </p>
        </div>
      </template>

      <div class="space-y-4">
        <UFormGroup :label="t('goods.role')" required>
          <USelectMenu
            v-model="role"
            :options="roleOptions"
            value-attribute="value"
            option-attribute="label"
            :popper="{ strategy: 'fixed' }"
          />
          <p v-if="roleDescription" class="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {{ roleDescription }}
          </p>
        </UFormGroup>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton color="gray" variant="ghost" :label="t('common.cancel')" @click="handleClose" />
          <UButton
            color="primary"
            :label="saving ? t('common.loading') : t('common.save')"
            :loading="saving"
            :disabled="saving"
            @click="handleSubmit"
          />
        </div>
      </template>
    </UCard>
  </UModal>
</template>
