<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { usePhoneGate } from '@/composables/usePhoneGate';
import { hubUpdateMyPhone } from '@/api/hub/updateMyPhone';
import { CookieKeys } from '@/utils/storageKeys';
import { useAuth } from '@/composables/useAuth';
import { sanitizePhoneInput, isPhoneInputValid } from '@/utils/phone';

const { t } = useI18n();
const { state, onPhoneSaved, onDismiss } = usePhoneGate();
const { fetchUser } = useAuth();
const token = useCookie<string | null>(CookieKeys.TOKEN);

const phone = ref('');
const saving = ref(false);
const error = ref('');

// Same input mask + validity rule used across Contacts and Menu phone fields
// (utils/phone.ts) -- one consistent standard for every phone input in the app.
// Forces the DOM value back in sync too: when a stripped character (e.g. a
// letter) doesn't change the sanitized result vs. the previous keystroke,
// Vue's reactive `phone` ref sees no change and skips re-patching the input,
// leaving the raw unsanitized character sitting in the native DOM value.
function onPhoneInput(e: Event) {
  const target = e.target as HTMLInputElement;
  const sanitized = sanitizePhoneInput(target.value);
  if (target.value !== sanitized) target.value = sanitized;
  phone.value = sanitized;
  if (error.value) error.value = '';
}

const phoneLooksInvalid = computed(() => Boolean(phone.value.trim()) && !isPhoneInputValid(phone.value.trim()));

watch(() => state.value.open, (open) => {
  if (!open) return;
  phone.value = '';
  error.value = '';
});

const title = computed(() => t('admin.phoneGateTitle') || 'Подтвердите номер телефона');

async function submitPhone() {
  const trimmed = phone.value.trim();
  if (!trimmed || !isPhoneInputValid(trimmed)) {
    error.value = t('admin.phoneInvalid') || 'Введите корректный номер телефона';
    return;
  }
  if (!token.value) {
    error.value = t('common.notAuthenticated') || 'Не авторизован';
    return;
  }

  saving.value = true;
  error.value = '';
  try {
    await hubUpdateMyPhone(token.value, trimmed);
    await fetchUser(true);
    onPhoneSaved();
  } catch (e: any) {
    error.value = e?.message || (t('admin.phoneSaveFailed') || 'Не удалось сохранить номер');
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <Modal
    :model-value="state.open"
    :prevent-close="state.blocking"
    :header="title"
    @update:model-value="(v) => { if (!v) onDismiss(); }"
  >
    <template #header>
      <div class="flex items-center gap-3">
        <div class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-emerald-500 text-white shadow-sm">
          <Icon name="lucide:phone" class="h-5 w-5" />
        </div>
        <span class="font-semibold">{{ title }}</span>
      </div>
    </template>

    <div class="space-y-3">
      <p class="text-sm text-gray-600 dark:text-gray-300">
        {{ state.blocking
          ? (t('admin.phoneGateBlockingDesc') || 'Подтвердите ваш номер телефона, чтобы завершить регистрацию.')
          : (t('admin.phoneGateNudgeDesc') || 'Подтвердите ваш номер телефона, чтобы завершить регистрацию.') }}
      </p>
      <div>
        <input
          :value="phone"
          type="tel"
          autocomplete="tel"
          :placeholder="t('admin.phonePlaceholder') || '+7 700 000 00 00'"
          class="w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm outline-none transition-colors focus:ring-2 dark:bg-gray-950 dark:text-white"
          :class="phoneLooksInvalid
            ? 'border-red-300 focus:border-red-400 focus:ring-red-500/30 dark:border-red-800'
            : 'border-gray-200 focus:border-blue-400 focus:ring-blue-500/30 dark:border-gray-700'"
          @input="onPhoneInput($event)"
          @keyup.enter="submitPhone"
        />
        <p v-if="phoneLooksInvalid" class="mt-1.5 text-[11px] text-red-600 dark:text-red-400">
          {{ t('admin.phoneInvalid') || 'Введите корректный номер телефона' }}
        </p>
        <p v-else class="mt-1.5 flex items-center gap-1 text-[11px] text-gray-400 dark:text-gray-500">
          <Icon name="lucide:shield-check" class="h-3.5 w-3.5" />
          {{ t('admin.phonePrivacyHint') || 'Мы не передаём ваш номер третьим лицам' }}
        </p>
      </div>
      <p v-if="error" class="text-xs text-red-600 dark:text-red-400">{{ error }}</p>
    </div>

    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton
          v-if="!state.blocking"
          color="gray"
          variant="outline"
          :label="t('admin.phoneRemindLater') || 'Позже'"
          @click="onDismiss"
        />
        <UButton
          color="primary"
          :loading="saving"
          :disabled="!phone.trim() || phoneLooksInvalid"
          :label="t('admin.phoneConfirm') || 'Подтвердить'"
          @click="submitPhone"
        />
      </div>
    </template>
  </Modal>
</template>
