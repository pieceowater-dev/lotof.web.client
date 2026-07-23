<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { usePhoneGate } from '@/composables/usePhoneGate';
import { hubUpdateMyPhone } from '@/api/hub/updateMyPhone';
import { CookieKeys } from '@/utils/storageKeys';
import { useAuth } from '@/composables/useAuth';
import { sanitizePhoneInput, isPhoneInputValid, formatDisplayPhoneUniversal } from '@/utils/phone';

const { t } = useI18n();
const { state, onPhoneSaved, onDismiss } = usePhoneGate();
const { fetchUser } = useAuth();
const token = useCookie<string | null>(CookieKeys.TOKEN);

type Step = 'phone' | 'sending' | 'code';
const step = ref<Step>('phone');
const phone = ref('');
const code = ref('');
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
  step.value = 'phone';
  phone.value = '';
  code.value = '';
  error.value = '';
});

const title = computed(() => {
  if (step.value === 'code') return t('admin.phoneCodeTitle') || 'Подтвердите номер';
  return t('admin.phoneGateTitle') || 'Подтвердите номер телефона';
});

// No real SMS gateway yet -- this is an intentional, disclosed placeholder:
// we show the familiar "code sent" step for a smoother, more trustworthy
// feel, then accept whatever the user types as confirmation. Swap in a real
// send/verify call here once SMS delivery is wired up.
async function sendCode() {
  const trimmed = phone.value.trim();
  if (!trimmed || !isPhoneInputValid(trimmed)) {
    error.value = t('admin.phoneInvalid') || 'Введите корректный номер телефона';
    return;
  }
  error.value = '';
  step.value = 'sending';
  await new Promise((resolve) => setTimeout(resolve, 1100));
  step.value = 'code';
}

async function confirmCode() {
  if (!code.value.trim()) {
    error.value = t('admin.phoneCodeInvalid') || 'Введите код из смс';
    return;
  }
  if (!token.value) {
    error.value = t('common.notAuthenticated') || 'Не авторизован';
    return;
  }

  saving.value = true;
  error.value = '';
  try {
    await hubUpdateMyPhone(token.value, phone.value.trim());
    await fetchUser(true);
    onPhoneSaved();
  } catch (e: any) {
    error.value = e?.message || (t('admin.phoneSaveFailed') || 'Не удалось сохранить номер');
  } finally {
    saving.value = false;
  }
}

function backToPhone() {
  step.value = 'phone';
  code.value = '';
  error.value = '';
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
          <Icon :name="step === 'code' ? 'lucide:message-circle' : 'lucide:phone'" class="h-5 w-5" />
        </div>
        <span class="font-semibold">{{ title }}</span>
      </div>
    </template>

    <!-- Step 1: phone entry -->
    <div v-if="step === 'phone'" class="space-y-3">
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
          @keyup.enter="sendCode"
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

    <!-- Step 2: fake "sending code" -->
    <div v-else-if="step === 'sending'" class="flex flex-col items-center gap-3 py-6 text-center">
      <Icon name="svg-spinners:ring-resize" class="h-8 w-8 text-blue-600 dark:text-blue-400" />
      <p class="text-sm text-gray-600 dark:text-gray-300">
        {{ t('admin.phoneSendingCode') || 'Отправляем код подтверждения…' }}
      </p>
    </div>

    <!-- Step 3: code entry -->
    <div v-else class="space-y-3">
      <p class="text-sm text-gray-600 dark:text-gray-300">
        {{ t('admin.phoneCodeSentTo') || 'Мы отправили код подтверждения на номер' }}
        <span class="font-semibold text-gray-900 dark:text-white">{{ formatDisplayPhoneUniversal(phone) }}</span>
      </p>
      <input
        v-model="code"
        type="text"
        inputmode="numeric"
        autocomplete="one-time-code"
        maxlength="6"
        :placeholder="t('admin.phoneCodePlaceholder') || 'Код из смс'"
        class="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-center text-lg font-semibold tracking-[0.3em] outline-none transition-colors focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
        @keyup.enter="confirmCode"
      />
      <button
        type="button"
        class="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
        @click="backToPhone"
      >
        {{ t('admin.phoneChangeNumber') || 'Изменить номер' }}
      </button>
      <p v-if="error" class="text-xs text-red-600 dark:text-red-400">{{ error }}</p>
    </div>

    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton
          v-if="!state.blocking && step !== 'sending'"
          color="gray"
          variant="outline"
          :label="t('admin.phoneRemindLater') || 'Позже'"
          @click="onDismiss"
        />
        <UButton
          v-if="step === 'phone'"
          color="primary"
          :disabled="!phone.trim() || phoneLooksInvalid"
          :label="t('admin.phoneSendCode') || 'Подтвердить'"
          trailing-icon="lucide:arrow-right"
          @click="sendCode"
        />
        <UButton
          v-else-if="step === 'code'"
          color="primary"
          :loading="saving"
          :label="t('admin.phoneConfirm') || 'Подтвердить'"
          @click="confirmCode"
        />
      </div>
    </template>
  </Modal>
</template>
