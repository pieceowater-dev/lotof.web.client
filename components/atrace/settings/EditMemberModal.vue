<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import type { Role } from '@/api/atrace/role/getRoles';
import type { AtraceMember } from '@/composables/useAtraceMembers';

const props = defineProps<{
  modelValue: boolean;
  member: AtraceMember | null;
  roles: Role[];
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'save'): void;
}>();

const editForm = defineModel<{ roleId: string; requiredWorkingDays: number; requiredWorkingHours: number }>('form', { required: true });

const { t } = useI18n();

const isOpen = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
});
</script>

<template>
  <UModal
    v-model="isOpen"
    :ui="{ container: 'items-center' }"
  >
    <UCard :ui="{ ring: '', divide: 'divide-y divide-gray-100 dark:divide-gray-800' }">
      <template #header>
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-semibold leading-6 text-gray-900 dark:text-white">
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
        <!-- Member Info -->
        <div class="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
          <div class="grid grid-cols-1 gap-3">
            <div>
              <span class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                {{ t('common.username') }}
              </span>
              <p class="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                {{ member.username }}
              </p>
            </div>
            <div>
              <span class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                {{ t('common.email') }}
              </span>
              <p class="mt-1 text-sm text-gray-700 dark:text-gray-300">
                {{ member.email }}
              </p>
            </div>
          </div>
        </div>

        <!-- Role Selection -->
        <UFormGroup
          :label="t('common.role') || 'Role'"
          :help="t('app.roleHint') || 'Assign a role to control access permissions'"
          class="space-y-2"
        >
          <USelect
            v-model="editForm.roleId"
            size="lg"
            :options="[
              { label: t('app.noRole') || 'No role', value: '' },
              ...roles.map(r => ({ label: r.name, value: r.id }))
            ]"
            option-attribute="label"
            value-attribute="value"
          />
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
