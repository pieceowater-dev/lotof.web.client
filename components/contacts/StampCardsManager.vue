<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from '@/composables/useI18n';

export interface StampCard {
  id?: string;
  name: string;
  description: string;
  totalStamps: number;
  rewardDescription: string;
  validFrom: string;
  validUntil: string;
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
}

interface Props {
  stampCards: StampCard[];
  loading?: boolean;
  error?: string | null;
}

interface Emits {
  (e: 'create', card: StampCard): void;
  (e: 'update', card: StampCard): void;
  (e: 'delete', cardId: string): void;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  error: null
});

const emit = defineEmits<Emits>();
const { t } = useI18n();

const isModalOpen = ref(false);
const editingCard = ref<StampCard | null>(null);
const formError = ref<string | null>(null);

const formData = ref<StampCard>({
  name: '',
  description: '',
  totalStamps: 10,
  rewardDescription: '',
  validFrom: new Date().toISOString().split('T')[0],
  validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  status: 'ACTIVE',
});

const statusOptions = [
  { label: t('app.active') || 'Active', value: 'ACTIVE' },
  { label: t('app.inactive') || 'Inactive', value: 'INACTIVE' },
  { label: t('app.archived') || 'Archived', value: 'ARCHIVED' },
];

function openCreateModal() {
  editingCard.value = null;
  formData.value = {
    name: '',
    description: '',
    totalStamps: 10,
    rewardDescription: '',
    validFrom: new Date().toISOString().split('T')[0],
    validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    status: 'ACTIVE',
  };
  formError.value = null;
  isModalOpen.value = true;
}

function openEditModal(card: StampCard) {
  editingCard.value = card;
  formData.value = { ...card };
  formError.value = null;
  isModalOpen.value = true;
}

function closeModal() {
  isModalOpen.value = false;
  editingCard.value = null;
  formError.value = null;
}

function validateForm(): boolean {
  if (!formData.value.name.trim()) {
    formError.value = t('app.cardNameRequired') || 'Card name is required';
    return false;
  }
  if (formData.value.totalStamps < 1) {
    formError.value = t('app.totalStampsMinimum') || 'Total stamps must be at least 1';
    return false;
  }
  formError.value = null;
  return true;
}

function saveCard() {
  if (!validateForm()) return;

  if (editingCard.value?.id) {
    emit('update', {
      ...formData.value,
      id: editingCard.value.id,
    });
  } else {
    emit('create', formData.value);
  }

  closeModal();
}

function deleteCard(card: StampCard) {
  if (!card.id) return;
  
  const confirmText = t('app.cardDeleteConfirm') || 'Delete this stamp card?';
  if (typeof window === 'undefined' || window.confirm(confirmText)) {
    emit('delete', card.id);
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case 'ACTIVE':
      return 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20';
    case 'INACTIVE':
      return 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800';
    case 'ARCHIVED':
      return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20';
    default:
      return '';
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <h3 class="font-semibold text-gray-900 dark:text-gray-100">
        {{ t('app.stampCards') || 'Stamp Cards' }}
      </h3>
      <UButton 
        icon="lucide:plus" 
        size="xs" 
        color="primary"
        :disabled="loading"
        @click="openCreateModal"
      >
        {{ t('app.add') || 'Add' }}
      </UButton>
    </div>

    <!-- Error -->
    <div 
      v-if="error"
      class="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 text-sm"
    >
      {{ error }}
    </div>

    <!-- Cards Grid -->
    <div
      v-if="stampCards.length > 0"
      class="grid grid-cols-1 md:grid-cols-2 gap-3"
    >
      <div
        v-for="card in stampCards"
        :key="card.id"
        class="p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
      >
        <div class="flex items-start justify-between mb-2">
          <div class="flex-1 min-w-0">
            <h4 class="font-semibold text-gray-900 dark:text-gray-100 truncate">
              {{ card.name }}
            </h4>
            <div class="flex items-center gap-2 mt-1">
              <span 
                :class="['text-xs px-2 py-1 rounded-full font-medium', getStatusColor(card.status)]"
              >
                {{ card.status }}
              </span>
            </div>
          </div>
          <div class="flex gap-1 flex-shrink-0 ml-2">
            <UButton 
              icon="lucide:edit-2" 
              size="xs" 
              variant="ghost"
              :disabled="loading"
              @click="openEditModal(card)"
            />
            <UButton 
              icon="lucide:trash-2" 
              size="xs" 
              variant="ghost"
              color="red"
              :disabled="loading"
              @click="deleteCard(card)"
            />
          </div>
        </div>

        <p class="text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
          {{ card.description }}
        </p>

        <div class="space-y-1 text-sm">
          <div class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>{{ t('app.totalStamps') || 'Total Stamps' }}:</span>
            <span class="font-semibold">{{ card.totalStamps }}</span>
          </div>
          <div class="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
            {{ t('app.reward') || 'Reward' }}: {{ card.rewardDescription }}
          </div>
          <div class="text-xs text-gray-500 dark:text-gray-400">
            {{ card.validFrom }} — {{ card.validUntil }}
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div
      v-else
      class="p-8 text-center text-gray-500 dark:text-gray-400 rounded-lg border border-gray-200 dark:border-gray-700"
    >
      <UIcon
        name="lucide:stamp"
        class="w-8 h-8 mx-auto mb-2 opacity-50"
      />
      <p class="text-sm">
        {{ t('app.noStampCards') || 'No stamp cards created yet' }}
      </p>
    </div>

    <!-- Modal -->
    <UModal 
      v-model="isModalOpen"
      :title="editingCard ? (t('app.editCard') || 'Edit Card') : (t('app.createCard') || 'Create Card')"
      size="lg"
      @close="closeModal"
    >
      <div class="space-y-4">
        <!-- Error -->
        <div 
          v-if="formError"
          class="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 text-sm"
        >
          {{ formError }}
        </div>

        <!-- Name -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {{ t('app.name') || 'Name' }} *
          </label>
          <input 
            v-model="formData.name"
            type="text"
            placeholder="e.g., Coffee Loyalty, Bakery Card..."
            class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
        </div>

        <!-- Description -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {{ t('app.description') || 'Description' }}
          </label>
          <textarea 
            v-model="formData.description"
            rows="2"
            placeholder="Describe this stamp card program..."
            class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <!-- Total Stamps -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {{ t('app.totalStamps') || 'Total Stamps' }} *
          </label>
          <input 
            v-model.number="formData.totalStamps"
            type="number"
            min="1"
            placeholder="e.g., 10"
            class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
        </div>

        <!-- Reward Description -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {{ t('app.rewardDescription') || 'Reward Description' }}
          </label>
          <input 
            v-model="formData.rewardDescription"
            type="text"
            placeholder="e.g., Free coffee, 50% discount..."
            class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
        </div>

        <!-- Validity Dates -->
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {{ t('app.validFrom') || 'Valid From' }}
            </label>
            <input 
              v-model="formData.validFrom"
              type="date"
              class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {{ t('app.validUntil') || 'Valid Until' }}
            </label>
            <input 
              v-model="formData.validUntil"
              type="date"
              class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
          </div>
        </div>

        <!-- Status -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {{ t('app.status') || 'Status' }}
          </label>
          <select 
            v-model="formData.status"
            class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option 
              v-for="opt in statusOptions" 
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.label }}
            </option>
          </select>
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton 
            variant="ghost"
            @click="closeModal"
          >
            {{ t('app.cancel') || 'Cancel' }}
          </UButton>
          <UButton 
            :loading="loading"
            @click="saveCard"
          >
            {{ t('app.save') || 'Save' }}
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
