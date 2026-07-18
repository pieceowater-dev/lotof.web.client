<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { useAuth } from '@/composables/useAuth';
import { useContactsToken } from '@/composables/useContactsToken';
import { useConfirm } from '@/composables/useConfirm';
import { useDigitPinInput } from '@/composables/useDigitPinInput';
import { logError } from '@/utils/logger';
import { parseResourceLimitErrorToast } from '@/utils/contactsErrorToasts';
import {
  createStampCard,
  deleteStampCard,
  getStampCards,
  updateStampCard,
  type StampCard,
  type UpdateStampCardInput,
} from '@/api/contacts/loyalty';

const { t } = useI18n();
const route = useRoute();
const toast = useToast();
const { token: hubToken } = useAuth();
const { ensure } = useContactsToken();
const { confirm } = useConfirm();

const nsSlug = computed(() => route.params.namespace as string);

const stampCards = ref<StampCard[]>([]);
const stampCardsLoading = ref(false);
const stampCardsError = ref<string | null>(null);

const showCreateModal = ref(false);
const showEditModal = ref(false);
const createFormLoading = ref(false);
const editFormLoading = ref(false);
const createFormError = ref<string | null>(null);
const editFormError = ref<string | null>(null);
const showStampPin = ref(false);
const showConfirmStampPin = ref(false);
const showEditStampPin = ref(false);
const showEditConfirmStampPin = ref(false);
const selectedStampCardId = ref<string | null>(null);

const createFormData = ref({
  name: '',
  description: '',
  totalStamps: 10,
  rewardDescription: '',
  stampPin: '',
  confirmStampPin: '',
  validFrom: '',
  validUntil: '',
});

const editFormData = ref({
  id: '',
  name: '',
  description: '',
  rewardDescription: '',
  status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE' | 'ARCHIVED',
  validUntil: '',
  stampPin: '',
  confirmStampPin: '',
});

const createPin = useDigitPinInput(createFormData);
const editPin = useDigitPinInput(editFormData);

const rewardPlaceholder = computed(() => t('app.reward') || 'Reward');

const isCreateFormValid = computed(() => {
  const data = createFormData.value;
  const hasRequired =
    !!data.name.trim() &&
    !!data.rewardDescription.trim() &&
    Number.isFinite(data.totalStamps) &&
    data.totalStamps > 0;

  const pinValid = /^\d{4}$/.test(data.stampPin);
  const pinMatches = data.stampPin === data.confirmStampPin;

  const dateRangeValid =
    !data.validFrom ||
    !data.validUntil ||
    new Date(data.validFrom).getTime() <= new Date(data.validUntil).getTime();

  return hasRequired && pinValid && pinMatches && dateRangeValid;
});

const isEditFormValid = computed(() => {
  const data = editFormData.value;
  const hasRequired = !!data.id && !!data.name.trim() && !!data.rewardDescription.trim();
  const pinEmpty = !data.stampPin && !data.confirmStampPin;
  const pinValid = /^\d{4}$/.test(data.stampPin) && data.stampPin === data.confirmStampPin;
  return hasRequired && (pinEmpty || pinValid);
});

async function ensureToken(): Promise<string | null> {
  if (!hubToken.value || !nsSlug.value) return null;
  return ensure(nsSlug.value, hubToken.value);
}

async function loadStampCards(token: string) {
  stampCardsLoading.value = true;
  stampCardsError.value = null;

  try {
    const cards = await getStampCards(token);
    stampCards.value = cards;
  } catch (e) {
    logError('Failed to load stamp cards for settings:', e);
    stampCardsError.value = t('common.errorDetails.loadFailed');
  } finally {
    stampCardsLoading.value = false;
  }
}

const resetCreateForm = () => {
  createFormData.value = {
    name: '',
    description: '',
    totalStamps: 10,
    rewardDescription: '',
    stampPin: '',
    confirmStampPin: '',
    validFrom: '',
    validUntil: '',
  };
  createFormError.value = null;
  showStampPin.value = false;
  showConfirmStampPin.value = false;
};

const openCreateModal = () => {
  resetCreateForm();
  showCreateModal.value = true;
};

const closeCreateModal = () => {
  showCreateModal.value = false;
  createFormError.value = null;
};

const openEditModal = (card: StampCard) => {
  selectedStampCardId.value = card.id;
  editFormData.value = {
    id: card.id,
    name: card.name,
    description: card.description || '',
    rewardDescription: card.rewardDescription,
    status: (card.status as 'ACTIVE' | 'INACTIVE' | 'ARCHIVED') || 'ACTIVE',
    validUntil: card.validUntil ? card.validUntil.slice(0, 10) : '',
    stampPin: '',
    confirmStampPin: '',
  };
  editFormError.value = null;
  showEditStampPin.value = false;
  showEditConfirmStampPin.value = false;
  showEditModal.value = true;
};

const closeEditModal = () => {
  editFormData.value.stampPin = '';
  editFormData.value.confirmStampPin = '';
  showEditStampPin.value = false;
  showEditConfirmStampPin.value = false;
  showEditModal.value = false;
  selectedStampCardId.value = null;
  editFormError.value = null;
};

const handleCreateStampCard = async () => {
  const data = createFormData.value;

  if (!data.name.trim()) {
    createFormError.value = t('common.name') || 'Name is required';
    return;
  }

  if (data.totalStamps <= 0) {
    createFormError.value = t('app.totalStamps') || 'Total stamps must be greater than 0';
    return;
  }

  if (!data.rewardDescription.trim()) {
    createFormError.value = t('app.reward') || 'Reward is required';
    return;
  }

  if (!/^\d{4}$/.test(data.stampPin)) {
    createFormError.value = t('contacts.loyalty.pinFormat') || 'PIN must be exactly 4 digits';
    return;
  }

  if (data.stampPin !== data.confirmStampPin) {
    createFormError.value = t('common.error.pinsMustMatch') || 'PIN codes do not match';
    return;
  }

  if (data.validFrom && data.validUntil && new Date(data.validFrom).getTime() > new Date(data.validUntil).getTime()) {
    createFormError.value = t('common.error') || 'Start date must be before end date';
    return;
  }

  try {
    createFormLoading.value = true;
    createFormError.value = null;

    const token = await ensureToken();
    if (!token) {
      createFormError.value = t('common.notAuthenticated') || 'Not authenticated';
      return;
    }

    const created = await createStampCard(token, {
      name: data.name.trim(),
      description: data.description?.trim() || undefined,
      type: 'CUSTOM',
      totalStamps: data.totalStamps,
      rewardDescription: data.rewardDescription.trim(),
      pin: data.stampPin,
      validFrom: data.validFrom || undefined,
      validUntil: data.validUntil || undefined,
    });

    if (!created) {
      createFormError.value = t('common.error') || 'Failed to create stamp card';
      return;
    }

    toast.add({
      title: t('common.success') || 'Success',
      description: t('common.create') || 'Created',
      color: 'emerald',
    });
    closeCreateModal();

    await loadStampCards(token);
  } catch (e) {
    logError('Failed to create stamp card:', e);
    const errorToast = parseResourceLimitErrorToast(e, 'loyaltyPrograms', t);
    createFormError.value = errorToast.description;
    toast.add({
      title: errorToast.title,
      description: errorToast.description,
      color: 'red',
    });
  } finally {
    createFormLoading.value = false;
  }
};

const handleUpdateStampCard = async () => {
  const data = editFormData.value;

  if (!data.name.trim()) {
    editFormError.value = t('common.name') || 'Name is required';
    return;
  }

  if (!data.rewardDescription.trim()) {
    editFormError.value = t('app.reward') || 'Reward is required';
    return;
  }

  if ((data.stampPin || data.confirmStampPin) && !/^\d{4}$/.test(data.stampPin || '')) {
    editFormError.value = t('contacts.loyalty.pinFormat') || 'PIN must be exactly 4 digits';
    return;
  }

  if (data.stampPin !== data.confirmStampPin) {
    editFormError.value = t('common.error.pinsMustMatch') || 'PIN codes do not match';
    return;
  }

  try {
    editFormLoading.value = true;
    editFormError.value = null;

    const token = await ensureToken();
    if (!token) {
      editFormError.value = t('common.notAuthenticated') || 'Not authenticated';
      return;
    }

    const input: UpdateStampCardInput = {
      id: data.id,
      name: data.name.trim(),
      description: data.description.trim() || undefined,
      rewardDescription: data.rewardDescription.trim(),
      status: data.status,
      validUntil: data.validUntil || undefined,
    };

    if (data.stampPin) {
      input.pin = data.stampPin;
    }

    const updated = await updateStampCard(token, input);
    if (!updated) {
      editFormError.value = t('common.error') || 'Failed to update stamp card';
      return;
    }

    toast.add({
      title: t('common.success') || 'Success',
      description: t('common.save') || 'Saved',
      color: 'emerald',
    });
    closeEditModal();
    await loadStampCards(token);
  } catch (e) {
    logError('Failed to update stamp card:', e);
    editFormError.value = t('common.error') || 'Failed to update stamp card';
  } finally {
    editFormLoading.value = false;
  }
};

const handleDeleteStampCard = async (id: string) => {
  const token = await ensureToken();
  if (!token) return;

  try {
    stampCardsLoading.value = true;
    const ok = await deleteStampCard(token, id);
    if (!ok) {
      toast.add({
        title: t('common.error') || 'Error',
        description: t('common.delete') || 'Delete failed',
        color: 'red',
      });
      return;
    }

    toast.add({
      title: t('common.success') || 'Success',
      description: t('common.delete') || 'Deleted',
      color: 'emerald',
    });
    await loadStampCards(token);
  } finally {
    stampCardsLoading.value = false;
  }
};

async function confirmDeleteStampCard(id: string) {
  const ok = await confirm({
    title: t('common.confirmDelete') || 'Confirm deletion',
    message: t('common.confirmDelete') || 'Are you sure you want to delete this item?',
    confirmLabel: t('common.delete') || 'Delete',
    color: 'red',
    icon: 'lucide:trash-2',
  });
  if (!ok) return;
  await handleDeleteStampCard(id);
}

onMounted(async () => {
  const token = await ensureToken();
  if (!token) {
    stampCardsError.value = t('common.error.missingCredentials') || 'Not authenticated';
    return;
  }
  await loadStampCards(token);
});
</script>

<template>
  <div class="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
    <div class="mb-4 flex items-center justify-between">
      <div>
        <h3 class="font-semibold text-gray-900 dark:text-gray-100">
          {{ t('app.stampCards') || 'Stamp Cards' }}
        </h3>
        <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
          {{ t('contacts.loyalty.stampCardsDescription') || 'Active stamp cards for your clients' }}
        </p>
      </div>
      <UButton
        icon="lucide:plus"
        size="sm"
        color="emerald"
        variant="soft"
        :disabled="stampCardsLoading"
        class="flex-shrink-0"
        @click="openCreateModal"
      >
        {{ t('common.add') || t('app.add') || 'Add' }}
      </UButton>
    </div>

    <div
      v-if="stampCardsLoading"
      class="flex items-center justify-center py-8"
    >
      <UIcon
        name="lucide:loader-2"
        class="w-5 h-5 animate-spin text-gray-400"
      />
    </div>

    <div
      v-else-if="stampCardsError"
      class="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 text-sm"
    >
      {{ stampCardsError }}
    </div>

    <div
      v-else-if="stampCards.length === 0"
      class="text-center py-8 text-gray-500 dark:text-gray-400"
    >
      <UIcon
        name="lucide:inbox"
        class="w-8 h-8 mx-auto mb-2 opacity-50"
      />
      <p>{{ t('common.noData') || 'No stamp cards found' }}</p>
    </div>

    <div
      v-else
      class="grid gap-3"
    >
      <div
        v-for="card in stampCards"
        :key="card.id"
        class="rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-sm transition-shadow"
      >
        <div class="flex items-start justify-between mb-2">
          <div>
            <h4 class="font-medium text-gray-900 dark:text-gray-100">
              {{ card.name }}
            </h4>
            <p
              v-if="card.description"
              class="text-sm text-gray-600 dark:text-gray-400 mt-1"
            >
              {{ card.description }}
            </p>
          </div>
          <div class="flex items-center gap-2">
            <span
              :class="[
                'inline-flex items-center px-2 py-1 rounded text-xs font-medium',
                card.status === 'ACTIVE' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' :
                card.status === 'INACTIVE' ? 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300' :
                'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
              ]"
            >
              {{ card.status }}
            </span>
            <UButton
              icon="lucide:pencil"
              size="xs"
              color="gray"
              variant="ghost"
              :disabled="stampCardsLoading"
              @click="openEditModal(card)"
            />
            <UButton
              icon="lucide:trash-2"
              size="xs"
              color="red"
              variant="ghost"
              :disabled="stampCardsLoading"
              @click="confirmDeleteStampCard(card.id)"
            />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span class="text-gray-600 dark:text-gray-400">{{ t('app.totalStamps') || 'Total Stamps' }}</span>
            <p class="font-medium text-gray-900 dark:text-gray-100">
              {{ card.totalStamps }}
            </p>
          </div>
          <div>
            <span class="text-gray-600 dark:text-gray-400">{{ t('app.reward') || 'Reward' }}</span>
            <p class="font-medium text-gray-900 dark:text-gray-100">
              {{ card.rewardDescription }}
            </p>
          </div>
          <div
            v-if="card.validFrom"
            class="text-xs text-gray-500 dark:text-gray-500"
          >
            {{ t('app.from') || 'From' }}: {{ new Date(card.validFrom).toLocaleDateString() }}
          </div>
          <div
            v-if="card.validUntil"
            class="text-xs text-gray-500 dark:text-gray-500"
          >
            {{ t('app.until') || 'Until' }}: {{ new Date(card.validUntil).toLocaleDateString() }}
          </div>
        </div>
      </div>
    </div>

    <!-- Create Stamp Card Modal -->
    <UModal
      v-model="showCreateModal"
      @close="closeCreateModal"
    >
      <UCard :ui="{ ring: '', divide: 'divide-y divide-gray-100 dark:divide-gray-800' }">
        <template #header>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="h-10 w-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
                <UIcon
                  name="lucide:ticket"
                  class="w-5 h-5"
                />
              </div>
              <div>
                <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {{ t('common.create') || 'Create' }} {{ t('common.stampCards') || t('app.stampCards') || 'Stamp Cards' }}
                </h3>
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  {{ t('contacts.loyalty.stampCardsDescription') || 'Configure stamp card details and PIN protection' }}
                </p>
              </div>
            </div>

            <UButton
              icon="lucide:x"
              size="xs"
              color="gray"
              variant="ghost"
              @click="closeCreateModal"
            />
          </div>
        </template>

        <div class="space-y-4">
          <div
            v-if="createFormError"
            class="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 text-sm"
          >
            {{ createFormError }}
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <UFormGroup
              :label="t('common.name') || 'Name'"
              required
            >
              <UInput
                v-model="createFormData.name"
                :placeholder="t('common.name') || 'Card name'"
                icon="lucide:type"
                :disabled="createFormLoading"
              />
            </UFormGroup>

            <UFormGroup
              :label="t('app.totalStamps') || 'Total stamps'"
              required
            >
              <UInput
                v-model.number="createFormData.totalStamps"
                type="number"
                min="1"
                max="1000"
                icon="lucide:hash"
                :disabled="createFormLoading"
              />
            </UFormGroup>
          </div>

          <UFormGroup :label="t('common.description') || 'Description'">
            <UTextarea
              v-model="createFormData.description"
              :placeholder="t('common.description') || 'Description'"
              :disabled="createFormLoading"
              :rows="3"
            />
          </UFormGroup>

          <UFormGroup
            :label="t('app.reward') || 'Reward'"
            required
          >
            <UInput
              v-model="createFormData.rewardDescription"
              :placeholder="rewardPlaceholder"
              icon="lucide:gift"
              :disabled="createFormLoading"
            />
          </UFormGroup>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <UFormGroup :label="t('common.from') || t('app.from') || 'From'">
              <UInput
                v-model="createFormData.validFrom"
                type="date"
                :disabled="createFormLoading"
              />
            </UFormGroup>

            <UFormGroup :label="t('common.until') || t('app.until') || 'Until'">
              <UInput
                v-model="createFormData.validUntil"
                type="date"
                :disabled="createFormLoading"
              />
            </UFormGroup>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <UFormGroup
              :label="t('common.newPin') || 'PIN'"
              required
            >
              <div class="relative">
                <input
                  :value="createFormData.stampPin"
                  :type="showStampPin ? 'text' : 'password'"
                  name="contacts-stamp-pin-new"
                  autocomplete="new-password"
                  data-lpignore="true"
                  data-1p-ignore="true"
                  data-form-type="other"
                  autocorrect="off"
                  autocapitalize="off"
                  spellcheck="false"
                  maxlength="4"
                  inputmode="numeric"
                  pattern="[0-9]*"
                  placeholder="0000"
                  class="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  :disabled="createFormLoading"
                  @keydown="createPin.onPinKeydown"
                  @keydown.enter.prevent="handleCreateStampCard"
                  @input="(e) => createPin.onInput(e, 'stampPin')"
                  @paste="(e) => createPin.onPaste(e, 'stampPin')"
                >
                <button
                  type="button"
                  class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  :disabled="createFormLoading"
                  @click="showStampPin = !showStampPin"
                >
                  <UIcon
                    :name="showStampPin ? 'lucide:eye-off' : 'lucide:eye'"
                    class="w-4 h-4"
                  />
                </button>
              </div>
            </UFormGroup>

            <UFormGroup
              :label="t('common.confirmPin') || 'Confirm PIN'"
              required
            >
              <div class="relative">
                <input
                  :value="createFormData.confirmStampPin"
                  :type="showConfirmStampPin ? 'text' : 'password'"
                  name="contacts-stamp-pin-confirm"
                  autocomplete="new-password"
                  data-lpignore="true"
                  data-1p-ignore="true"
                  data-form-type="other"
                  autocorrect="off"
                  autocapitalize="off"
                  spellcheck="false"
                  maxlength="4"
                  inputmode="numeric"
                  pattern="[0-9]*"
                  placeholder="0000"
                  class="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  :disabled="createFormLoading"
                  @keydown="createPin.onPinKeydown"
                  @keydown.enter.prevent="handleCreateStampCard"
                  @input="(e) => createPin.onInput(e, 'confirmStampPin')"
                  @paste="(e) => createPin.onPaste(e, 'confirmStampPin')"
                >
                <button
                  type="button"
                  class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  :disabled="createFormLoading"
                  @click="showConfirmStampPin = !showConfirmStampPin"
                >
                  <UIcon
                    :name="showConfirmStampPin ? 'lucide:eye-off' : 'lucide:eye'"
                    class="w-4 h-4"
                  />
                </button>
              </div>
            </UFormGroup>
          </div>
        </div>

        <template #footer>
          <div class="flex items-center justify-end gap-2">
            <UButton
              type="button"
              color="gray"
              variant="outline"
              icon="lucide:x"
              :disabled="createFormLoading"
              @click="closeCreateModal"
            >
              {{ t('common.cancel') || 'Cancel' }}
            </UButton>

            <UButton
              type="submit"
              color="primary"
              icon="lucide:check"
              :loading="createFormLoading"
              :disabled="!isCreateFormValid"
              @click="handleCreateStampCard"
            >
              {{ t('common.create') || 'Create' }}
            </UButton>
          </div>
        </template>
      </UCard>
    </UModal>

    <!-- Edit Stamp Card Modal -->
    <UModal
      v-model="showEditModal"
      @close="closeEditModal"
    >
      <UCard :ui="{ ring: '', divide: 'divide-y divide-gray-100 dark:divide-gray-800' }">
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {{ t('contacts.editStampCard') || 'Редактировать карту штампов' }}
            </h3>
            <UButton
              type="button"
              icon="lucide:x"
              size="xs"
              color="gray"
              variant="ghost"
              @click="closeEditModal"
            />
          </div>
        </template>

        <div class="space-y-4">
          <div
            v-if="editFormError"
            class="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 text-sm"
          >
            {{ editFormError }}
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <UFormGroup
              :label="t('common.name') || 'Name'"
              required
            >
              <UInput
                v-model="editFormData.name"
                :disabled="editFormLoading"
              />
            </UFormGroup>

            <UFormGroup :label="t('contacts.status') || 'Status'">
              <USelectMenu
                v-model="editFormData.status"
                :options="[
                  { value: 'ACTIVE', label: t('contacts.active') || 'Active' },
                  { value: 'INACTIVE', label: t('contacts.blocked') || 'Inactive' },
                  { value: 'ARCHIVED', label: t('contacts.archived') || 'Archived' },
                ]"
                value-attribute="value"
                option-attribute="label"
                :disabled="editFormLoading"
              />
            </UFormGroup>
          </div>

          <UFormGroup :label="t('common.description') || 'Description'">
            <UTextarea
              v-model="editFormData.description"
              :rows="3"
              :disabled="editFormLoading"
            />
          </UFormGroup>

          <UFormGroup
            :label="t('app.reward') || 'Reward'"
            required
          >
            <UInput
              v-model="editFormData.rewardDescription"
              :disabled="editFormLoading"
            />
          </UFormGroup>

          <UFormGroup :label="t('common.until') || t('app.until') || 'Until'">
            <UInput
              v-model="editFormData.validUntil"
              type="date"
              :disabled="editFormLoading"
            />
          </UFormGroup>

          <div class="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
            <p class="text-sm font-medium text-gray-800 dark:text-gray-200 mb-3">
              {{ t('contacts.loyalty.bonusPin') || 'Bonus PIN' }}
            </p>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <UFormGroup :label="t('common.newPin') || 'PIN'">
                <div class="relative">
                  <input
                    :value="editFormData.stampPin"
                    :type="showEditStampPin ? 'text' : 'password'"
                    readonly
                    name="contacts-stamp-pin-edit"
                    autocomplete="new-password"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    data-form-type="other"
                    autocorrect="off"
                    autocapitalize="off"
                    spellcheck="false"
                    maxlength="4"
                    inputmode="numeric"
                    pattern="[0-9]*"
                    placeholder="0000"
                    class="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    :disabled="editFormLoading"
                    @focus="($event.target as HTMLInputElement).removeAttribute('readonly')"
                    @keydown="editPin.onPinKeydown"
                    @keydown.enter.prevent="handleUpdateStampCard"
                    @input="(e) => editPin.onInput(e, 'stampPin')"
                    @paste="(e) => editPin.onPaste(e, 'stampPin')"
                  >
                  <button
                    type="button"
                    class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    :disabled="editFormLoading"
                    @click="showEditStampPin = !showEditStampPin"
                  >
                    <UIcon
                      :name="showEditStampPin ? 'lucide:eye-off' : 'lucide:eye'"
                      class="w-4 h-4"
                    />
                  </button>
                </div>
              </UFormGroup>

              <UFormGroup :label="t('common.confirmPin') || 'Confirm PIN'">
                <div class="relative">
                  <input
                    :value="editFormData.confirmStampPin"
                    :type="showEditConfirmStampPin ? 'text' : 'password'"
                    readonly
                    name="contacts-stamp-pin-edit-confirm"
                    autocomplete="new-password"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    data-form-type="other"
                    autocorrect="off"
                    autocapitalize="off"
                    spellcheck="false"
                    maxlength="4"
                    inputmode="numeric"
                    pattern="[0-9]*"
                    placeholder="0000"
                    class="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    :disabled="editFormLoading"
                    @focus="($event.target as HTMLInputElement).removeAttribute('readonly')"
                    @keydown="editPin.onPinKeydown"
                    @keydown.enter.prevent="handleUpdateStampCard"
                    @input="(e) => editPin.onInput(e, 'confirmStampPin')"
                    @paste="(e) => editPin.onPaste(e, 'confirmStampPin')"
                  >
                  <button
                    type="button"
                    class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    :disabled="editFormLoading"
                    @click="showEditConfirmStampPin = !showEditConfirmStampPin"
                  >
                    <UIcon
                      :name="showEditConfirmStampPin ? 'lucide:eye-off' : 'lucide:eye'"
                      class="w-4 h-4"
                    />
                  </button>
                </div>
              </UFormGroup>
            </div>
          </div>
        </div>

        <template #footer>
          <div class="flex items-center justify-end gap-2">
            <UButton
              type="button"
              color="gray"
              variant="outline"
              icon="lucide:x"
              :disabled="editFormLoading"
              @click="closeEditModal"
            >
              {{ t('common.cancel') || 'Cancel' }}
            </UButton>
            <UButton
              type="submit"
              color="primary"
              icon="lucide:check"
              :loading="editFormLoading"
              :disabled="!isEditFormValid"
              @click="handleUpdateStampCard"
            >
              {{ t('common.save') || 'Save' }}
            </UButton>
          </div>
        </template>
      </UCard>
    </UModal>
  </div>
</template>
