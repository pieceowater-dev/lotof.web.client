<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
  addStamp,
  addBonusTransaction,
  type BonusBalance,
  type StampCard,
  type ClientStampProgress,
} from '@/api/contacts/loyalty';

interface Props {
  bonusBalance: BonusBalance | null;
  stampCards: StampCard[];
  stampProgress: ClientStampProgress[];
  contactsToken?: string;
  clientId?: string;
  namespace?: string;
  createdBy?: string;
  loading?: boolean;
}

interface Emits {
  (e: 'bonus-earned'): void;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  contactsToken: '',
  clientId: '',
  namespace: '',
  createdBy: '00000000-0000-0000-0000-000000000000',
});

const emit = defineEmits<Emits>();

const { t } = useI18n();
const toast = useToast();

const isEarnModalOpen = ref(false);
const bonusAction = ref<'earn' | 'spend'>('earn');
const earnStep = ref<'pin' | 'amount'>('pin');
const pinInput = ref('');
const amountInput = ref<number | null>(null);
const submitError = ref('');
const submitLoading = ref(false);
const addStampLoadingForProgressId = ref<string | null>(null);
const inMemoryPin = ref<string | null>(null);
const inMemoryStampPins = ref<Record<string, string>>({});
const isStampPinModalOpen = ref(false);
const stampPinInput = ref('');
const stampSubmitError = ref('');
const stampTargetProgress = ref<ClientStampProgress | null>(null);

const pinHashCookieName = computed(() => `contacts_bonus_pin_hash_${props.namespace || 'default'}`);
const cachedPinHash = useCookie<string | null>(pinHashCookieName.value, {
  maxAge: 8 * 60 * 60,
  sameSite: 'strict',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  default: () => null,
});
const pinValueCookieName = computed(() => `contacts_bonus_pin_value_${props.namespace || 'default'}`);
const cachedPinValue = useCookie<string | null>(pinValueCookieName.value, {
  maxAge: 8 * 60 * 60,
  sameSite: 'strict',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  default: () => null,
});
const legacyPinCookieName = computed(() => `contacts_bonus_pin_${props.namespace || 'default'}`);
const legacyCachedPin = useCookie<string | null>(legacyPinCookieName.value, {
  sameSite: 'strict',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  default: () => null,
});
if (legacyCachedPin.value) {
  legacyCachedPin.value = null;
}

const restoredPin = sanitizePin(String(cachedPinValue.value || ''));
if (restoredPin.length === 4) {
  inMemoryPin.value = restoredPin;
  pinInput.value = restoredPin;
} else if (cachedPinValue.value) {
  cachedPinValue.value = null;
}

watch(pinInput, (value) => {
  const normalized = sanitizePin(String(value || ''));
  if (normalized !== value) {
    pinInput.value = normalized;
  }
});

const canEarnBonus = computed(() => !!props.contactsToken && !!props.clientId);
const canSpendBonus = computed(() => {
  if (!canEarnBonus.value) return false;
  const available = Number(props.bonusBalance?.availableBonuses || 0);
  return Number.isFinite(available) && available > 0;
});

const quickAmountOptions = computed(() => {
  const base = [100, 300, 500, 1000, 2000, 5000];
  if (bonusAction.value === 'spend') {
    const available = Number(props.bonusBalance?.availableBonuses || 0);
    if (!Number.isFinite(available) || available <= 0) return [];
    return base.filter(v => v <= available);
  }
  return base;
});

const canSubmitAmountStep = computed(() => {
  return !!amountInput.value && Number(amountInput.value) > 0;
});

const availableBonusLabel = computed(() => {
  return Number(props.bonusBalance?.availableBonuses || 0);
});
const hasCachedPin = computed(() => !!cachedPinHash.value || !!inMemoryPin.value);

async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function sanitizePin(value: string): string {
  return value.replace(/\D/g, '').slice(0, 4);
}

function formatLoyaltyError(message: string): string {
  const lower = message.toLowerCase();

  if (lower.includes('invalid pin')) {
    return t('contacts.invalidPin') || 'Неверный PIN-код';
  }

  if (lower.includes('pin required') || lower.includes('pin is required')) {
    return t('contacts.pinRequired') || 'Требуется PIN';
  }

  if (lower.includes('too many') && lower.includes('pin')) {
    return t('contacts.tooManyPinAttempts') || 'Слишком много неверных попыток PIN. Попробуйте позже';
  }

  return message;
}

function openEarnModal() {
  if (!canEarnBonus.value) {
    return;
  }

  bonusAction.value = 'earn';
  submitError.value = '';
  pinInput.value = sanitizePin(String(inMemoryPin.value || cachedPinValue.value || ''));
  amountInput.value = null;
  earnStep.value = pinInput.value.length === 4 ? 'amount' : 'pin';
  isEarnModalOpen.value = true;
}

function openSpendModal() {
  if (!canSpendBonus.value) {
    return;
  }

  bonusAction.value = 'spend';
  submitError.value = '';
  pinInput.value = sanitizePin(String(inMemoryPin.value || cachedPinValue.value || ''));
  amountInput.value = null;
  earnStep.value = pinInput.value.length === 4 ? 'amount' : 'pin';
  isEarnModalOpen.value = true;
}

function closeEarnModal() {
  isEarnModalOpen.value = false;
}

async function confirmPinStep() {
  const normalizedPin = sanitizePin(pinInput.value);
  if (!/^\d{4}$/.test(normalizedPin)) {
    submitError.value = t('contacts.pinMustBe4Digits') || 'PIN должен содержать 4 цифры';
    return;
  }

  cachedPinHash.value = await sha256Hex(normalizedPin);
  cachedPinValue.value = normalizedPin;
  inMemoryPin.value = normalizedPin;
  pinInput.value = normalizedPin;
  submitError.value = '';
  earnStep.value = 'amount';
}

function resetStoredPin() {
  cachedPinHash.value = null;
  cachedPinValue.value = null;
  inMemoryPin.value = null;
  pinInput.value = '';
  earnStep.value = 'pin';
}

function pickQuickAmount(value: number) {
  amountInput.value = value;
  submitError.value = '';
}

async function submitEarnBonus() {
  if (!props.contactsToken || !props.clientId) {
    return;
  }

  if (!amountInput.value || amountInput.value <= 0) {
    submitError.value = t('contacts.enterValidAmount') || 'Укажите корректную сумму';
    return;
  }

  if (bonusAction.value === 'spend') {
    const available = Number(props.bonusBalance?.availableBonuses || 0);
    if (!Number.isFinite(available) || amountInput.value > available) {
      submitError.value = t('contacts.insufficientBonuses') || 'Недостаточно доступных бонусов';
      return;
    }
  }

  if (!inMemoryPin.value) {
    submitError.value = t('contacts.pinRequired') || 'Нужен PIN';
    earnStep.value = 'pin';
    return;
  }

  if (!/^\d{4}$/.test(sanitizePin(inMemoryPin.value))) {
    submitError.value = t('contacts.pinMustBe4Digits') || 'PIN должен содержать 4 цифры';
    earnStep.value = 'pin';
    return;
  }

  submitLoading.value = true;
  submitError.value = '';

  try {
    await addBonusTransaction(props.contactsToken, {
      clientId: props.clientId,
      transactionType: bonusAction.value === 'spend' ? 'SPENT' : 'EARNED',
      reason: 'MANUAL',
      amount: amountInput.value,
      pin: inMemoryPin.value,
      createdBy: props.createdBy || '00000000-0000-0000-0000-000000000000',
    });

    toast.add({
      title: t('common.success') || 'Успешно',
      description: bonusAction.value === 'spend'
        ? (t('contacts.bonusSpent') || 'Бонусы списаны')
        : (t('contacts.bonusAccrued') || 'Бонусы начислены'),
      color: 'green',
    });
    closeEarnModal();
    emit('bonus-earned');
  } catch (error: any) {
    const message = String(error?.response?.errors?.[0]?.message || error?.message || (bonusAction.value === 'spend' ? 'Failed to spend bonus' : 'Failed to accrue bonus'));
    submitError.value = formatLoyaltyError(message);
    if (message.toLowerCase().includes('pin')) {
      resetStoredPin();
    }
  } finally {
    submitLoading.value = false;
  }
}

function getProgressPercentage(current: number | undefined, total: number | undefined): number {
  if (!current || !total) return 0;
  return Math.min((current / total) * 100, 100);
}

function formatBonusUpdatedAt(value: string | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

function isStampFilled(current: number | undefined, index: number): boolean {
  if (!current) return false;
  return index <= current;
}

function toStampCount(total: number | undefined): number {
  const count = Number(total || 0);
  if (!Number.isFinite(count) || count < 0) return 0;
  return Math.floor(count);
}

function useStampDots(total: number | undefined): boolean {
  const count = toStampCount(total);
  return count > 0 && count <= 10;
}

function getNextStampIndex(current: number | undefined): number {
  const value = Number(current || 0);
  if (!Number.isFinite(value) || value < 0) return 1;
  return Math.floor(value) + 1;
}

function isNextStampToFill(current: number | undefined, index: number): boolean {
  return index === getNextStampIndex(current);
}

function canAddStampForProgress(progress: ClientStampProgress): boolean {
  const total = toStampCount(progress.stampCard?.totalStamps);
  const current = Number(progress.currentStamps || 0);
  return canEarnBonus.value && total > 0 && current < total;
}

function stampPinCookieName(cardId: string): string {
  return `contacts_stamp_pin_hash_${props.namespace || 'default'}_${cardId}`;
}

function getStampPinHashCookie(cardId: string) {
  return useCookie<string | null>(stampPinCookieName(cardId), {
    maxAge: 8 * 60 * 60,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    default: () => null,
  });
}

function getLegacyStampPinCookie(cardId: string) {
  return useCookie<string | null>(`contacts_stamp_pin_${props.namespace || 'default'}_${cardId}`, {
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    default: () => null,
  });
}

function stampPinSessionKey(cardId: string): string {
  return `contacts_stamp_pin_session_${props.namespace || 'default'}_${cardId}`;
}

function setStampPinSession(cardId: string, pin: string) {
  if (!process.client) return;
  sessionStorage.setItem(stampPinSessionKey(cardId), pin);
}

function getStampPinSession(cardId: string): string {
  if (!process.client) return '';
  return sanitizePin(sessionStorage.getItem(stampPinSessionKey(cardId)) || '');
}

function clearStampPinSession(cardId: string) {
  if (!process.client) return;
  sessionStorage.removeItem(stampPinSessionKey(cardId));
}

function clearLegacyStampPinCookie(cardId: string) {
  const legacy = getLegacyStampPinCookie(cardId);
  if (legacy.value) {
    legacy.value = null;
  }
}

async function submitAddStamp(progress: ClientStampProgress) {
  if (!props.contactsToken || !props.clientId || !canAddStampForProgress(progress)) {
    return;
  }

  addStampLoadingForProgressId.value = progress.id;
  try {
    const normalizedPin = sanitizePin(stampPinInput.value);
    if (normalizedPin.length !== 4) {
      stampSubmitError.value = t('contacts.pinMustBe4Digits') || 'PIN должен содержать 4 цифры';
      return;
    }

    await addStamp(props.contactsToken, {
      clientId: props.clientId,
      stampCardId: progress.stampCardId,
      stampsToAdd: 1,
      pin: normalizedPin,
      addedBy: props.createdBy || '00000000-0000-0000-0000-000000000000',
    });

    const cardPinHashCookie = getStampPinHashCookie(progress.stampCardId);
    cardPinHashCookie.value = await sha256Hex(normalizedPin);
    inMemoryStampPins.value[progress.stampCardId] = normalizedPin;
    setStampPinSession(progress.stampCardId, normalizedPin);
    clearLegacyStampPinCookie(progress.stampCardId);

    toast.add({
      title: t('common.success') || 'Успешно',
      description: 'Штамп начислен',
      color: 'green',
    });
    closeStampPinModal();
    emit('bonus-earned');
  } catch (error: any) {
    const message = String(error?.response?.errors?.[0]?.message || error?.message || 'Failed to add stamp');
    const readableMessage = formatLoyaltyError(message);
    if (message.toLowerCase().includes('pin')) {
      const cardPinHashCookie = getStampPinHashCookie(progress.stampCardId);
      cardPinHashCookie.value = null;
      delete inMemoryStampPins.value[progress.stampCardId];
      clearStampPinSession(progress.stampCardId);
      clearLegacyStampPinCookie(progress.stampCardId);
    }
    toast.add({
      title: t('common.error') || 'Ошибка',
      description: readableMessage,
      color: 'red',
    });
    stampSubmitError.value = readableMessage;
  } finally {
    addStampLoadingForProgressId.value = null;
  }
}

function openStampPinModal(progress: ClientStampProgress) {
  if (!canAddStampForProgress(progress)) {
    return;
  }
  clearLegacyStampPinCookie(progress.stampCardId);
  const cachedSessionPin = getStampPinSession(progress.stampCardId);
  if (cachedSessionPin) {
    inMemoryStampPins.value[progress.stampCardId] = cachedSessionPin;
  }
  stampTargetProgress.value = progress;
  stampPinInput.value = sanitizePin(String(inMemoryStampPins.value[progress.stampCardId] || ''));
  stampSubmitError.value = '';
  isStampPinModalOpen.value = true;
}

function closeStampPinModal() {
  isStampPinModalOpen.value = false;
  stampTargetProgress.value = null;
  stampPinInput.value = '';
  stampSubmitError.value = '';
}

async function submitStampFromModal() {
  if (!stampTargetProgress.value) return;
  await submitAddStamp(stampTargetProgress.value);
}
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow ring-1 ring-gray-200 dark:ring-gray-700 overflow-hidden">
    <div class="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
      <div class="flex items-center gap-2">
        <UIcon name="i-heroicons-gift" class="w-5 h-5 text-amber-600 dark:text-amber-400" />
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
          {{ t('contacts.bonuses') }}
        </h2>
      </div>
    </div>
    <div class="px-5 py-5 space-y-6">
      <!-- Bonus Balance -->
      <div v-if="bonusBalance">
        <div class="flex items-center gap-2 mb-3">
          <UIcon name="i-heroicons-wallet" class="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">
            {{ t('contacts.balance') }}
          </h3>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div class="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/20 rounded-lg p-4">
            <p class="text-xs text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-1">{{ t('contacts.total') }}</p>
            <p class="text-2xl font-bold text-blue-700 dark:text-blue-300">{{ bonusBalance.totalBonuses }}</p>
          </div>
          <div class="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900/30 dark:to-slate-800/20 rounded-lg p-4">
            <p class="text-xs text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1">{{ t('contacts.updatedAt') || 'Обновлено' }}</p>
            <p class="text-sm font-semibold text-slate-700 dark:text-slate-300">{{ formatBonusUpdatedAt(bonusBalance.updatedAt) }}</p>
          </div>
        </div>
      </div>
      <div v-else>
        <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('contacts.noBonusData') }}</p>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <UButton
          color="primary"
          icon="i-heroicons-plus"
          :disabled="!canEarnBonus"
          @click="openEarnModal"
        >
          {{ t('contacts.accrueBonuses') || 'Начислить бонусы' }}
        </UButton>
        <UButton
          color="orange"
          variant="soft"
          icon="i-heroicons-minus"
          :disabled="!canSpendBonus"
          @click="openSpendModal"
        >
          {{ t('contacts.spendBonuses') || 'Списать бонусы' }}
        </UButton>
        <UButton
          v-if="hasCachedPin"
          color="gray"
          variant="soft"
          icon="i-heroicons-key"
          @click="resetStoredPin"
        >
          {{ t('contacts.resetStoredPin') || 'Сбросить сохраненный PIN' }}
        </UButton>
        <span class="text-xs text-gray-500 dark:text-gray-400">
          {{ t('contacts.pinStoredAsHashFor8h') || 'Хэш PIN хранится 8 часов в cookie. Сам PIN хранится только в памяти вкладки.' }}
        </span>
      </div>

      <!-- Stamp Cards -->
      <div v-if="stampProgress.length > 0">
        <div class="flex items-center gap-2 mb-3">
          <UIcon name="i-heroicons-ticket" class="w-4 h-4 text-pink-600 dark:text-pink-400" />
          <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">
            {{ t('contacts.stampCards') }}
          </h3>
        </div>
        <div class="space-y-3">
          <div v-for="progress in stampProgress" :key="progress.id"
            class="rounded-xl border border-sky-200/70 dark:border-sky-800/40 bg-gradient-to-r from-slate-50 to-sky-50 dark:from-slate-900/30 dark:to-sky-900/20 p-4 shadow-sm">
            <div class="flex items-start justify-between mb-2">
              <div>
                <p class="text-sm font-semibold text-slate-900 dark:text-slate-100">{{ progress.stampCard?.name }}</p>
                <p class="text-xs text-slate-600 dark:text-slate-400 mt-1">{{ progress.stampCard?.description }}</p>
              </div>
            </div>
            <div class="mt-3 space-y-2">
              <div class="flex justify-between text-xs text-slate-700 dark:text-slate-300">
                <span>{{ progress.currentStamps }} / {{ progress.stampCard?.totalStamps }}</span>
                <span>{{ progress.completedRounds }} {{ t('contacts.rounds') }}</span>
              </div>

              <div v-if="useStampDots(progress.stampCard?.totalStamps)" class="flex flex-wrap gap-2">
                <template
                  v-for="stampIndex in toStampCount(progress.stampCard?.totalStamps)"
                  :key="`${progress.id}-stamp-${stampIndex}`"
                >
                  <button
                    v-if="!isStampFilled(progress.currentStamps, stampIndex) && isNextStampToFill(progress.currentStamps, stampIndex)"
                    type="button"
                    class="h-10 w-10 rounded-full border border-sky-500 bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 flex items-center justify-center transition-colors hover:bg-sky-200 dark:hover:bg-sky-900/60 disabled:opacity-60 disabled:cursor-not-allowed"
                    :title="t('contacts.accrue') || 'Начислить'"
                    :disabled="addStampLoadingForProgressId === progress.id || !canAddStampForProgress(progress)"
                    @click="openStampPinModal(progress)"
                  >
                    <UIcon
                      :name="addStampLoadingForProgressId === progress.id ? 'i-heroicons-arrow-path' : 'i-heroicons-plus'"
                      class="w-5 h-5"
                      :class="addStampLoadingForProgressId === progress.id ? 'animate-spin' : ''"
                    />
                  </button>
                  <div
                    v-else
                    class="h-10 w-10 rounded-full border flex items-center justify-center transition-colors"
                    :class="isStampFilled(progress.currentStamps, stampIndex)
                      ? 'bg-sky-600 border-sky-600 text-white shadow-sm'
                      : 'bg-white/80 dark:bg-slate-900/40 border-slate-300 dark:border-slate-700 border-dashed text-slate-500 dark:text-slate-400'"
                    :title="`${stampIndex}`"
                  >
                    <UIcon
                      name="i-lucide-stamp"
                      class="w-5 h-5"
                      :class="isStampFilled(progress.currentStamps, stampIndex) ? 'opacity-100' : 'opacity-70'"
                    />
                  </div>
                </template>
              </div>

              <div v-else class="w-full bg-slate-200 dark:bg-slate-700/60 rounded-full h-2.5">
                <div
                  class="bg-sky-600 dark:bg-sky-400 h-2.5 rounded-full transition-all duration-300"
                  :style="{ width: `${getProgressPercentage(progress.currentStamps, progress.stampCard?.totalStamps)}%` }"
                ></div>
              </div>
                </div>
          </div>
        </div>
      </div>
      <div v-else-if="stampCards.length === 0">
        <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('contacts.noStampCards') }}</p>
      </div>
    </div>
  </div>

  <UModal v-model="isEarnModalOpen" :ui="{ width: 'sm:max-w-md' }">
    <UCard>
      <template #header>
        <div class="flex items-center gap-3">
          <div
            class="h-10 w-10 rounded-lg flex items-center justify-center"
            :class="bonusAction === 'spend'
              ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300'
              : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'"
          >
            <UIcon :name="bonusAction === 'spend' ? 'i-heroicons-minus' : 'i-heroicons-plus'" class="w-5 h-5" />
          </div>
          <div>
            <h3 class="text-base font-semibold text-gray-900 dark:text-white">
            {{ bonusAction === 'spend'
              ? (t('contacts.spendBonuses') || 'Списать бонусы')
              : (t('contacts.accrueBonuses') || 'Начислить бонусы') }}
            </h3>
            <p class="text-xs text-gray-500 dark:text-gray-400">
              {{ earnStep === 'pin' ? 'Шаг 1 из 2' : 'Шаг 2 из 2' }}
            </p>
          </div>
        </div>
      </template>

      <form
        class="space-y-4"
        @submit.prevent="earnStep === 'pin' ? confirmPinStep() : submitEarnBonus()"
      >
        <div v-if="earnStep === 'pin'" class="space-y-3">
          <p class="text-sm text-gray-600 dark:text-gray-300">
            {{ bonusAction === 'spend'
              ? (t('contacts.enterGlobalPinFirstSpend') || 'Введите глобальный PIN для списания')
              : (t('contacts.enterGlobalPinFirst') || 'Введите глобальный PIN для начисления') }}
          </p>
          <UInput
            v-model="pinInput"
            type="password"
            inputmode="numeric"
            maxlength="4"
            autocomplete="one-time-code"
            :placeholder="t('contacts.pin') || 'PIN'"
            @update:model-value="(v) => pinInput = sanitizePin(String(v || ''))"
          />
          <UButton type="submit" block color="primary" :disabled="pinInput.length !== 4">
            {{ t('common.continue') || 'Продолжить' }}
          </UButton>
        </div>

        <div v-else class="space-y-3">
          <p class="text-sm text-gray-600 dark:text-gray-300">
            {{ bonusAction === 'spend'
              ? (t('contacts.enterSpendAmount') || 'Укажите сумму списания')
              : (t('contacts.enterBonusAmount') || 'Укажите сумму начисления') }}
          </p>

          <div
            v-if="bonusAction === 'spend'"
            class="rounded-lg border border-orange-200/70 dark:border-orange-800/40 bg-orange-50/80 dark:bg-orange-900/20 px-3 py-2 text-xs text-orange-700 dark:text-orange-300"
          >
            {{ t('contacts.available') || 'Доступно' }}: {{ availableBonusLabel }}
          </div>

          <UInput
            v-model.number="amountInput"
            type="number"
            min="1"
            step="1"
            :placeholder="t('contacts.amount') || 'Сумма'"
          />

          <div v-if="quickAmountOptions.length > 0" class="grid grid-cols-3 gap-2">
            <UButton
              v-for="quick in quickAmountOptions"
              :key="`${bonusAction}-${quick}`"
              type="button"
              size="xs"
              color="gray"
              variant="soft"
              @click="pickQuickAmount(quick)"
            >
              {{ quick }}
            </UButton>
          </div>

          <div class="flex gap-2">
            <UButton type="button" color="gray" variant="soft" @click="resetStoredPin">
              {{ t('contacts.changePin') || 'Изменить PIN' }}
            </UButton>
            <UButton type="submit" color="primary" :loading="submitLoading" :disabled="!canSubmitAmountStep">
              {{ bonusAction === 'spend'
                ? (t('contacts.spend') || 'Списать')
                : (t('contacts.accrue') || 'Начислить') }}
            </UButton>
          </div>
        </div>

        <p v-if="submitError" class="text-sm text-red-600 dark:text-red-400">
          {{ submitError }}
        </p>
      </form>
    </UCard>
  </UModal>

  <UModal v-model="isStampPinModalOpen" :ui="{ width: 'sm:max-w-md' }">
    <UCard>
      <template #header>
        <div class="flex items-center justify-between">
          <h3 class="text-base font-semibold text-gray-900 dark:text-white">
            {{ t('contacts.accrueStamp') || 'Начислить штамп' }}
          </h3>
        </div>
      </template>

      <form class="space-y-4" @submit.prevent="submitStampFromModal">
        <p class="text-sm text-gray-600 dark:text-gray-300">
          {{ t('contacts.enterCardPinFirst') || 'Введите PIN карточки штампов для начисления' }}
        </p>
        <UInput
          v-model="stampPinInput"
          type="password"
          inputmode="numeric"
          maxlength="4"
          :placeholder="t('contacts.pin') || 'PIN'"
          @update:model-value="(v) => stampPinInput = sanitizePin(String(v || ''))"
          @keydown.enter.stop.prevent="submitStampFromModal"
          @keyup.enter.stop.prevent="submitStampFromModal"
        />

        <div class="flex gap-2">
          <UButton type="button" color="gray" variant="soft" @click="closeStampPinModal">
            {{ t('common.cancel') || 'Отмена' }}
          </UButton>
          <UButton
            type="submit"
            color="primary"
            :loading="!!stampTargetProgress && addStampLoadingForProgressId === stampTargetProgress.id"
          >
            {{ t('contacts.accrue') || 'Начислить' }}
          </UButton>
        </div>

        <p v-if="stampSubmitError" class="text-sm text-red-600 dark:text-red-400">
          {{ stampSubmitError }}
        </p>
      </form>
    </UCard>
  </UModal>
</template>
