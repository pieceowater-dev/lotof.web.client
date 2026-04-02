<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useI18n } from '@/composables/useI18n';

export interface Tier {
  id?: string;
  name: string;
  description: string;
  level: number;
  qualificationThreshold: number;
  bonusMultiplier: number;
  colorHex: string;
  benefits: string[];
}

interface Props {
  tiers: Tier[];
  loading?: boolean;
  error?: string | null;
}

interface Emits {
  (e: 'create', tier: Tier): void;
  (e: 'update', tier: Tier): void;
  (e: 'delete', tierId: string): void;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  error: null
});

const emit = defineEmits<Emits>();

const { t } = useI18n();

const isModalOpen = ref(false);
const editingTier = ref<Tier | null>(null);
const benefitsInput = ref('');
const formError = ref<string | null>(null);

const formData = ref<Tier>({
  name: '',
  description: '',
  level: 1,
  qualificationThreshold: 0,
  bonusMultiplier: 1,
  colorHex: '#3B82F6',
  benefits: [],
});

const availableColors = [
  '#3B82F6', // Blue
  '#EF4444', // Red
  '#10B981', // Green
  '#F59E0B', // Amber
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#F97316', // Orange
];

const sortedTiers = computed(() => {
  return [...props.tiers].sort((a, b) => a.level - b.level);
});

function openCreateModal() {
  editingTier.value = null;
  formData.value = {
    name: '',
    description: '',
    level: Math.max(...props.tiers.map(t => t.level), 0) + 1,
    qualificationThreshold: 0,
    bonusMultiplier: 1,
    colorHex: '#3B82F6',
    benefits: [],
  };
  benefitsInput.value = '';
  formError.value = null;
  isModalOpen.value = true;
}

function openEditModal(tier: Tier) {
  editingTier.value = tier;
  formData.value = { ...tier };
  benefitsInput.value = tier.benefits.join('\n');
  formError.value = null;
  isModalOpen.value = true;
}

function closeModal() {
  isModalOpen.value = false;
  editingTier.value = null;
  formError.value = null;
}

function addBenefit() {
  if (benefitsInput.value.trim()) {
    if (!formData.value.benefits) {
      formData.value.benefits = [];
    }
    formData.value.benefits.push(benefitsInput.value.trim());
    benefitsInput.value = '';
  }
}

function removeBenefit(index: number) {
  formData.value.benefits.splice(index, 1);
}

function validateForm(): boolean {
  if (!formData.value.name.trim()) {
    formError.value = t('app.tierNameRequired') || 'Tier name is required';
    return false;
  }
  if (formData.value.bonusMultiplier < 1) {
    formError.value = t('app.bonusMultiplierMinimum') || 'Bonus multiplier must be >= 1';
    return false;
  }
  formError.value = null;
  return true;
}

function saveTier() {
  if (!validateForm()) return;

  if (editingTier.value?.id) {
    emit('update', {
      ...formData.value,
      id: editingTier.value.id,
    });
  } else {
    emit('create', formData.value);
  }

  closeModal();
}

function deleteTier(tier: Tier) {
  if (!tier.id) return;
  
  const confirmText = t('app.tierDeleteConfirm') || 'Delete this tier?';
  if (typeof window === 'undefined' || window.confirm(confirmText)) {
    emit('delete', tier.id);
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <h3 class="font-semibold text-gray-900 dark:text-gray-100">
        {{ t('app.loyaltyTiers') || 'Loyalty Tiers' }}
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

    <!-- Tiers Grid -->
    <div
      v-if="sortedTiers.length > 0"
      class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3"
    >
      <div
        v-for="tier in sortedTiers"
        :key="tier.id"
        class="p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
      >
        <div class="flex items-start justify-between mb-2">
          <div class="flex items-center gap-2 flex-1">
            <div 
              :style="{ backgroundColor: tier.colorHex }"
              class="w-4 h-4 rounded-full flex-shrink-0"
            />
            <div class="flex-1 min-w-0">
              <h4 class="font-semibold text-gray-900 dark:text-gray-100 truncate">
                {{ tier.name }}
              </h4>
              <p class="text-xs text-gray-500 dark:text-gray-400">
                {{ t('app.level') || 'Level' }} {{ tier.level }}
              </p>
            </div>
          </div>
          <div class="flex gap-1 flex-shrink-0">
            <UButton 
              icon="lucide:edit-2" 
              size="xs" 
              variant="ghost"
              :disabled="loading"
              @click="openEditModal(tier)"
            />
            <UButton 
              icon="lucide:trash-2" 
              size="xs" 
              variant="ghost"
              color="red"
              :disabled="loading"
              @click="deleteTier(tier)"
            />
          </div>
        </div>

        <p class="text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
          {{ tier.description }}
        </p>

        <div class="space-y-1 mb-2 text-sm">
          <div class="text-xs text-gray-500 dark:text-gray-400">
            {{ t('app.threshold') || 'Threshold' }}: {{ tier.qualificationThreshold }}
          </div>
          <div class="text-xs text-gray-500 dark:text-gray-400">
            {{ t('app.bonusMultiplier') || 'Bonus Multiplier' }}: {{ tier.bonusMultiplier }}x
          </div>
        </div>

        <div
          v-if="tier.benefits.length > 0"
          class="flex flex-wrap gap-1"
        >
          <span
            v-for="(benefit, idx) in tier.benefits"
            :key="idx"
            class="inline-block px-2 py-1 text-xs rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 truncate"
          >
            {{ benefit }}
          </span>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div
      v-else
      class="p-8 text-center text-gray-500 dark:text-gray-400 rounded-lg border border-gray-200 dark:border-gray-700"
    >
      <UIcon
        name="lucide:gift"
        class="w-8 h-8 mx-auto mb-2 opacity-50"
      />
      <p class="text-sm">
        {{ t('app.noTiers') || 'No tiers created yet' }}
      </p>
    </div>

    <!-- Modal -->
    <UModal 
      v-model="isModalOpen"
      :title="editingTier ? (t('app.editTier') || 'Edit Tier') : (t('app.createTier') || 'Create Tier')"
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
            placeholder="Gold, Silver, Platinum..."
            class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
        </div>

        <!-- Level -->
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {{ t('app.level') || 'Level' }} *
            </label>
            <input 
              v-model.number="formData.level"
              type="number"
              min="1"
              class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {{ t('app.bonusMultiplier') || 'Bonus Multiplier' }} *
            </label>
            <input 
              v-model.number="formData.bonusMultiplier"
              type="number"
              min="1"
              step="0.1"
              class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
          </div>
        </div>

        <!-- Description -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {{ t('app.description') || 'Description' }}
          </label>
          <textarea 
            v-model="formData.description"
            rows="2"
            placeholder="Describe this tier..."
            class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <!-- Threshold -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {{ t('app.qualificationThreshold') || 'Qualification Threshold' }} *
          </label>
          <input 
            v-model.number="formData.qualificationThreshold"
            type="number"
            min="0"
            placeholder="e.g., 1000"
            class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
        </div>

        <!-- Color -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {{ t('app.color') || 'Color' }}
          </label>
          <div class="flex gap-2 flex-wrap">
            <button
              v-for="color in availableColors"
              :key="color"
              :style="{ backgroundColor: color }"
              :class="[
                'w-8 h-8 rounded-lg border-2 transition-all',
                formData.colorHex === color 
                  ? 'border-gray-900 dark:border-gray-100' 
                  : 'border-transparent hover:border-gray-400 dark:hover:border-gray-600'
              ]"
              @click="formData.colorHex = color"
            />
          </div>
        </div>

        <!-- Benefits -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {{ t('app.benefits') || 'Benefits' }}
          </label>
          <div class="flex gap-2 mb-2">
            <input 
              v-model="benefitsInput"
              type="text"
              placeholder="e.g., Free shipping"
              class="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              @keydown.enter="addBenefit"
            >
            <UButton 
              icon="lucide:plus" 
              size="xs"
              @click="addBenefit"
            />
          </div>
          <div
            v-if="formData.benefits.length > 0"
            class="flex flex-wrap gap-2"
          >
            <span
              v-for="(benefit, idx) in formData.benefits"
              :key="idx"
              class="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600"
            >
              <span>{{ benefit }}</span>
              <button 
                class="hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                @click="removeBenefit(idx)"
              >
                <UIcon
                  name="lucide:x"
                  class="w-3 h-3"
                />
              </button>
            </span>
          </div>
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
            @click="saveTier"
          >
            {{ t('app.save') || 'Save' }}
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
