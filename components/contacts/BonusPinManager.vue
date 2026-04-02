<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { changeBonusPin, type ChangePinInput } from '@/api/contacts/loyalty';

interface Props {
  clientId?: string;
  loading?: boolean;
  error?: string | null;
  token: string;
}

interface Emits {
  (e: 'success', message: string): void;
  (e: 'error', message: string): void;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  error: null,
  clientId: undefined,
});

const emit = defineEmits<Emits>();
const { t } = useI18n();

const isModalOpen = ref(false);
const formError = ref<string | null>(null);
const isSubmitting = ref(false);
const showOldPin = ref(false);
const showNewPin = ref(false);
const showConfirmPin = ref(false);

const formData = ref({
  oldPin: '',
  newPin: '',
  confirmPin: '',
});

const hasOldPin = computed(() => {
  // If clientId is provided, we assume the client might have an old PIN
  // For global settings, we don't require old PIN
  return !!props.clientId;
});

function openModal() {
  formData.value = {
    oldPin: '',
    newPin: '',
    confirmPin: '',
  };
  formError.value = null;
  isModalOpen.value = true;
}

function closeModal() {
  isModalOpen.value = false;
  formError.value = null;
  formData.value = {
    oldPin: '',
    newPin: '',
    confirmPin: '',
  };
}

function validatePin(pin: string): boolean {
  // PIN must be exactly 4 digits
  return /^\d{4}$/.test(pin);
}

function validateForm(): boolean {
  if (hasOldPin.value && !formData.value.oldPin.trim()) {
    formError.value = t('common.error.currentPinRequired');
    return false;
  }

  if (hasOldPin.value && !validatePin(formData.value.oldPin)) {
    formError.value = t('common.error.currentPinInvalid');
    return false;
  }

  if (!formData.value.newPin.trim()) {
    formError.value = t('common.error.newPinRequired');
    return false;
  }

  if (!validatePin(formData.value.newPin)) {
    formError.value = t('common.error.newPinInvalid');
    return false;
  }

  if (formData.value.newPin !== formData.value.confirmPin) {
    formError.value = t('common.error.pinsMustMatch');
    return false;
  }

  if (hasOldPin.value && formData.value.oldPin === formData.value.newPin) {
    formError.value = t('common.error.newPinSameAsOld');
    return false;
  }

  formError.value = null;
  return true;
}

async function savePin() {
  if (!validateForm()) return;

  isSubmitting.value = true;
  formError.value = null;

  try {
    const input: ChangePinInput = {
      clientId: props.clientId || 'global', // Use 'global' for system-wide settings
      newPin: formData.value.newPin,
    };

    if (hasOldPin.value && formData.value.oldPin) {
      input.oldPin = formData.value.oldPin;
    }

    const result = await changeBonusPin(props.token, input);

    if (result.success) {
      emit('success', t('common.pinChanged'));
      closeModal();
    } else {
      formError.value = result.message || t('common.error.pinChangeFailed');
      emit('error', formError.value);
    }
  } catch (error: any) {
    const errorMessage = error?.message || t('common.error.pinChangeFailed');
    formError.value = errorMessage;
    emit('error', errorMessage);
  } finally {
    isSubmitting.value = false;
  }
}

defineExpose({
  openModal,
});
</script>

<template>
  <div>
    <!-- Header with Add Button -->
    <div class="flex items-center justify-between mb-4">
      <div>
        <h3 class="font-semibold text-gray-900 dark:text-gray-100">
          {{ t('contacts.loyalty.bonusPin') }}
        </h3>
        <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
          {{ t('contacts.loyalty.bonusPinDescription') }}
        </p>
      </div>
      <UButton 
        icon="lucide:lock" 
        size="xs" 
        color="primary"
        @click="openModal"
      >
        {{ hasOldPin ? t('common.changePin') : t('common.setPin') }}
      </UButton>
    </div>

    <!-- Error State -->
    <div
      v-if="error"
      class="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 text-sm"
    >
      {{ error }}
    </div>

    <!-- Info Box -->
    <div class="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
      <div class="flex items-start gap-3">
        <UIcon
          name="lucide:info"
          class="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5"
        />
        <div class="text-sm text-blue-800 dark:text-blue-200">
          <p class="font-medium mb-1">
            {{ t('contacts.loyalty.aboutBonusPin') }}
          </p>
          <ul class="list-disc list-inside space-y-1 text-blue-700 dark:text-blue-300">
            <li>{{ t('contacts.loyalty.bonusPinInfo1') }}</li>
            <li>{{ t('contacts.loyalty.bonusPinInfo2') }}</li>
            <li>{{ t('contacts.loyalty.bonusPinInfo3') }}</li>
          </ul>
        </div>
      </div>
    </div>

    <!-- Change/Set PIN Modal -->
    <UModal
      v-model="isModalOpen"
      @close="closeModal"
    >
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold">
              {{ hasOldPin ? t('common.changePin') : t('common.setPin') }}
            </h3>
          </div>
        </template>

        <div class="space-y-4">
          <!-- Error Alert -->
          <div
            v-if="formError"
            class="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 text-sm"
          >
            {{ formError }}
          </div>

          <!-- Old PIN Field (only if client has existing PIN) -->
          <div
            v-if="hasOldPin"
            class="space-y-2"
          >
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {{ t('common.currentPin') }}
            </label>
            <div class="relative">
              <input
                v-model="formData.oldPin"
                :type="showOldPin ? 'text' : 'password'"
                maxlength="4"
                placeholder="••••"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                :disabled="isSubmitting"
                @keydown.enter.prevent="savePin"
              >
              <button
                type="button"
                class="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                @click="showOldPin = !showOldPin"
              >
                <UIcon
                  :name="showOldPin ? 'lucide:eye-off' : 'lucide:eye'"
                  class="w-4 h-4"
                />
              </button>
            </div>
          </div>

          <!-- New PIN Field -->
          <div class="space-y-2">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {{ t('common.newPin') }}
            </label>
            <div class="relative">
              <input
                v-model="formData.newPin"
                :type="showNewPin ? 'text' : 'password'"
                maxlength="4"
                placeholder="••••"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                :disabled="isSubmitting"
                @keydown.enter.prevent="savePin"
              >
              <button
                type="button"
                class="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                @click="showNewPin = !showNewPin"
              >
                <UIcon
                  :name="showNewPin ? 'lucide:eye-off' : 'lucide:eye'"
                  class="w-4 h-4"
                />
              </button>
            </div>
            <p class="text-xs text-gray-500 dark:text-gray-400">
              {{ t('contacts.loyalty.pinFormat') }}
            </p>
          </div>

          <!-- Confirm PIN Field -->
          <div class="space-y-2">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {{ t('common.confirmPin') }}
            </label>
            <div class="relative">
              <input
                v-model="formData.confirmPin"
                :type="showConfirmPin ? 'text' : 'password'"
                maxlength="4"
                placeholder="••••"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                :disabled="isSubmitting"
                @keydown.enter.prevent="savePin"
              >
              <button
                type="button"
                class="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                @click="showConfirmPin = !showConfirmPin"
              >
                <UIcon
                  :name="showConfirmPin ? 'lucide:eye-off' : 'lucide:eye'"
                  class="w-4 h-4"
                />
              </button>
            </div>
          </div>
        </div>

        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton
              type="button"
              color="gray"
              variant="ghost"
              :disabled="isSubmitting"
              @click="closeModal"
            >
              {{ t('common.cancel') }}
            </UButton>
            <UButton
              type="submit"
              color="primary"
              :loading="isSubmitting"
              :disabled="isSubmitting"
              @click="savePin"
            >
              {{ t('common.save') }}
            </UButton>
          </div>
        </template>
      </UCard>
    </UModal>
  </div>
</template>

<style scoped>
input[type="password"],
input[type="text"] {
  font-family: monospace;
  letter-spacing: 0.5em;
  text-align: center;
  font-size: 1.5rem;
}
</style>
