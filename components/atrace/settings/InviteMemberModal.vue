<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { useAtraceMembers } from '@/composables/useAtraceMembers';

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
}>();

const { t } = useI18n();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);

// Self-contained: fetches its own roles list and owns the invite form state,
// independent of the members table's own useAtraceMembers() instance.
const {
  roles, loadRoles,
  inviteEmail, inviteRoleId, inviteDays, inviteHours, inviteSubmitting, inviteError,
  isValidInviteEmail, inviteCanSubmit, submitInvite,
} = useAtraceMembers(nsSlug);

const isOpen = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
});

async function handleSubmit() {
  await submitInvite();
  if (!inviteError.value) {
    isOpen.value = false;
  }
}

onMounted(() => {
  loadRoles();
});
</script>

<template>
  <UModal
    v-model="isOpen"
    :ui="{ container: 'items-center justify-center' }"
  >
    <UCard :ui="{ ring: '', divide: 'divide-y divide-gray-100 dark:divide-gray-800', base: 'w-full max-w-2xl', body: { base: 'w-full' } }">
      <template #header>
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-lg font-semibold leading-6 text-gray-900 dark:text-white">
              {{ t('app.sendInvite') || 'Send Invitation' }}
            </h3>
            <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {{ t('app.namespace') || 'Namespace' }}: <span class="font-medium">{{ nsSlug }}</span>
            </p>
          </div>
          <UButton
            color="gray"
            variant="ghost"
            icon="lucide:x"
            class="-my-1"
            @click="isOpen = false"
          />
        </div>
      </template>

      <div class="space-y-6">
        <!-- Email -->
        <div>
          <UFormGroup
            :label="t('common.email') || 'Email'"
            :help="t('app.searchEmailPlaceholder')"
            class="space-y-2"
          >
            <UInput
              v-model="inviteEmail"
              type="email"
              size="lg"
              :placeholder="'name@lota.tools'"
              :state="inviteEmail && !isValidInviteEmail ? 'error' : 'success'"
            />
            <p
              v-if="inviteEmail && !isValidInviteEmail"
              class="text-xs text-red-500"
            >
              {{ t('app.invalidEmail') || 'Please enter a valid email' }}
            </p>
          </UFormGroup>
        </div>

        <!-- Role -->
        <div>
          <UFormGroup
            :label="t('common.role') || 'Role'"
            class="space-y-2"
          >
            <USelectMenu
              v-model="inviteRoleId"
              size="lg"
              :options="[
                { label: t('app.noRole') || 'No role', value: '' },
                ...roles.map(r => ({ label: r.name, value: r.id }))
              ]"
              option-attribute="label"
              value-attribute="value"
              :placeholder="t('app.selectRole') || 'Select a role'"
            />
          </UFormGroup>
        </div>

        <!-- Working Requirements -->
        <div>
          <div style="display: none">
            <h4 class="text-sm font-semibold text-gray-900 dark:text-white mb-4">
              {{ t('app.workingRequirements') || 'Working Requirements' }}
            </h4>
            <div class="grid grid-cols-2 gap-4">
              <UFormGroup
                :label="t('app.requiredWorkingDays') || 'Days per Month'"
                :help="t('app.requiredWorkingDaysHint') || '1–31 days'"
                class="space-y-2"
              >
                <UInput
                  v-model.number="inviteDays"
                  type="number"
                  size="lg"
                  min="0"
                  max="31"
                  step="1"
                  inputmode="numeric"
                />
              </UFormGroup>

              <UFormGroup
                :label="t('app.requiredWorkingHours') || 'Hours per Day'"
                :help="t('app.requiredWorkingHoursHint') || '0–24 hours'"
                class="space-y-2"
              >
                <UInput
                  v-model.number="inviteHours"
                  type="number"
                  size="lg"
                  min="0"
                  max="24"
                  step="1"
                  inputmode="numeric"
                />
              </UFormGroup>
            </div>
          </div>
        </div>

        <!-- Error message -->
        <div
          v-if="inviteError"
          class="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-md"
        >
          {{ inviteError }}
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
            :disabled="!inviteCanSubmit"
            :loading="inviteSubmitting"
            icon="lucide:send"
            color="primary"
            @click="handleSubmit"
          >
            {{ t('app.sendInvite') || 'Send Invitation' }}
          </UButton>
        </div>
      </template>
    </UCard>
  </UModal>
</template>
