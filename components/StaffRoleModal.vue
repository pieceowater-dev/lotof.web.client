<script lang="ts" setup>
// Shared body behind menu/StaffModal.vue, tasks/StaffModal.vue and
// goods/GoodsStaffModal.vue -- they were ~110 identical lines apiece,
// differing only in the per-product role list/descriptions and which i18n
// keys back the title/labels. Presentational strings are taken as
// already-resolved props (not resolved here via a hardcoded key namespace)
// specifically so each product's wrapper keeps using its own exact i18n
// keys/fallbacks unchanged -- this component has no opinion on i18n at all.
import { memberDisplayName } from '@/utils/memberDisplayName';

export type StaffRoleOption = { label: string; value: string };

const NONE = 'NONE';

const props = defineProps<{
  modelValue: boolean;
  member?: { userId: string; username: string; email: string; nickname?: string | null } | null;
  currentRole?: string | null;
  saving?: boolean;
  roleOptions: StaffRoleOption[]; // must include the "No role" entry, value NONE
  roleDescriptions: Record<string, string>; // role value -> already-translated description (may be '')
  title: string;
  roleLabel: string;
  cancelLabel: string;
  saveLabel: string;
  loadingLabel: string;
}>();

// role: null means "No role" — the caller deletes the staff record (if any)
// to revoke access to this app entirely, rather than assigning a role.
const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
  (e: 'submit', payload: { userId: string; role: string | null }): void;
}>();

const isOpen = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
});

const role = ref<string>(NONE);

const roleDescription = computed(() => props.roleDescriptions[role.value] || '');

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
            {{ title }}
          </h3>
          <p v-if="member" class="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {{ memberDisplayName(member) }} · {{ member.email }}
          </p>
        </div>
      </template>

      <div class="space-y-4">
        <UFormGroup :label="roleLabel" required>
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
          <UButton color="gray" variant="ghost" :label="cancelLabel" @click="handleClose" />
          <UButton
            color="primary"
            :label="saving ? loadingLabel : saveLabel"
            :loading="saving"
            :disabled="saving"
            @click="handleSubmit"
          />
        </div>
      </template>
    </UCard>
  </UModal>
</template>
