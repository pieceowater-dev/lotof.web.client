<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import type { Role } from '@/api/atrace/role/getRoles';
import type { AtraceMember } from '@/composables/useAtraceMembers';
import { atraceRoleLabel, atraceRoleDescription } from '@/utils/atrace/roleLabel';
import { memberDisplayName } from '@/utils/memberDisplayName';

const props = defineProps<{
  modelValue: boolean;
  member: AtraceMember | null;
  roles: Role[];
  /** The member being edited is the signed-in user -- role must stay locked. */
  isSelf?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'save'): void;
}>();

const editForm = defineModel<{ roleId: string; nickname: string; requiredWorkingDays: number; requiredWorkingHours: number }>('form', { required: true });

const { t } = useI18n();

const isOpen = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
});

const editRoleDescription = computed(() => {
  const selected = props.roles.find(r => r.id === editForm.value.roleId);
  return selected ? atraceRoleDescription(selected.name, t) : '';
});
</script>

<template>
  <UModal class="at-modal"
    v-model="isOpen"
    :ui="{ ...atModalUi, container: 'items-center' }"
  >
    <UCard :ui="{ ...atCardUi }">
      <template #header>
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-extrabold tracking-tight leading-6 text-gray-900 dark:text-white">
            {{ t('app.editMember') || 'Edit Member' }}
          </h3>
          <UButton
            color="gray"
            variant="ghost"
            icon="lucide:x"
            class="-my-1"
            @click="isOpen = false"
          />
        </div>
      </template>

      <div
        v-if="member"
        class="space-y-6"
      >
        <!-- Member identity: editable team name (per-namespace nickname) + read-only account info -->
        <div class="at-row !p-4 space-y-3">
          <UFormGroup
            :label="t('app.memberNickname') || 'Имя в команде'"
            :help="t('app.memberNicknameHint') || 'Так коллеги видят человека в этом пространстве. Оставьте пустым — будет имя аккаунта.'"
          >
            <UInput
              v-model="editForm.nickname"
              size="lg"
              maxlength="64"
              icon="i-heroicons-user"
              :placeholder="member.username"
            />
          </UFormGroup>
          <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
            <span>{{ t('common.username') }}: <span class="font-medium text-gray-700 dark:text-gray-300">{{ member.username }}</span></span>
            <span>{{ t('common.email') }}: <span class="font-medium text-gray-700 dark:text-gray-300">{{ member.email }}</span></span>
          </div>
        </div>

        <!-- Role Selection -->
        <UFormGroup
          :label="t('common.role') || 'Role'"
          :help="isSelf
            ? (t('app.roleSelfLockedHint') || 'You cannot change your own role. Ask another administrator.')
            : (t('app.roleHint') || 'Assign a role to control access permissions')"
          class="space-y-2"
        >
          <USelectMenu
            v-model="editForm.roleId"
            size="lg"
            :disabled="isSelf"
            :options="[
              { label: t('app.noRole') || 'No role', value: '' },
              ...roles.map(r => ({ label: atraceRoleLabel(r.name, t), value: r.id }))
            ]"
            option-attribute="label"
            value-attribute="value"
          />
          <p v-if="editRoleDescription" class="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {{ editRoleDescription }}
          </p>
        </UFormGroup>

        <!-- Working Requirements -->
        <div class="space-y-4">
          <h4 class="text-sm font-semibold text-gray-900 dark:text-white">
            {{ t('app.workingRequirements') || 'Working Requirements' }}
          </h4>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormGroup
              :label="t('app.requiredWorkingDays') || 'Required Days/Month'"
              :help="t('app.requiredWorkingDaysHint') || 'Number of required working days per month'"
            >
              <UInput
                v-model.number="editForm.requiredWorkingDays"
                type="number"
                size="lg"
                min="0"
                max="31"
                step="1"
                inputmode="numeric"
                :placeholder="'22'"
              />
            </UFormGroup>

            <UFormGroup
              :label="t('app.requiredWorkingHours') || 'Required Hours/Day'"
              :help="t('app.requiredWorkingHoursHint') || 'Number of required working hours per day'"
            >
              <UInput
                v-model.number="editForm.requiredWorkingHours"
                type="number"
                size="lg"
                min="0"
                max="24"
                step="1"
                inputmode="numeric"
                :placeholder="'8'"
              />
            </UFormGroup>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton
            icon="lucide:x"
            color="primary"
            variant="soft"
            @click="isOpen = false"
          >
            {{ t('common.cancel') || 'Cancel' }}
          </UButton>
          <UButton
            icon="lucide:check"
            color="primary"
            @click="emit('save')"
          >
            {{ t('common.save') || 'Save' }}
          </UButton>
        </div>
      </template>
    </UCard>
  </UModal>
</template>
