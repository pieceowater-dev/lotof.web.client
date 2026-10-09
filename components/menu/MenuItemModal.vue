<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import ImageUpload from '@/components/menu/ImageUpload.vue';
import type { MenuItem } from '@/api/menu/menuitem/list';
import type { MenuBadge } from '@/api/menu/badge/list';
import type { MenuBranch } from '@/api/menu/branch/list';
import type { MenuModifierGroup } from '@/api/menu/modifiergroup/list';

const { t } = useI18n();

const props = defineProps<{
  modelValue: boolean;
  nsSlug: string;
  item?: MenuItem | null;
  saving?: boolean;
  availableBadges?: MenuBadge[];
  availableBranches?: MenuBranch[];
  availableModifierGroups?: MenuModifierGroup[];
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
  (e: 'submit', payload: Record<string, any>): void;
  (e: 'manage-badges'): void;
  (e: 'manage-modifiers'): void;
}>();

const isOpen = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
});

const form = reactive({
  name: '',
  description: '',
  price: 0,
  imageUrl: '',
  imageAlt: '',
  seoTitle: '',
  seoDescription: '',
});

const selectedBadgeIds = ref<string[]>([]);
const selectedModifierGroupIds = ref<string[]>([]);
// Branches where this item IS available (UI is opt-in for clarity; converted
// to the backend's opt-out exclusion list on submit).
const availableBranchIds = ref<string[]>([]);

watch(() => [props.modelValue, props.item], () => {
  if (!props.modelValue) return;
  const it = props.item;
  form.name = it?.name || '';
  form.description = it?.description || '';
  form.price = it?.price ?? 0;
  form.imageUrl = it?.imageUrl || '';
  form.imageAlt = it?.imageAlt || '';
  form.seoTitle = it?.seoTitle || '';
  form.seoDescription = it?.seoDescription || '';
  selectedBadgeIds.value = [...(it?.badgeIds || [])];
  selectedModifierGroupIds.value = [...(it?.modifierGroupIds || [])];
  const excluded = new Set(it?.excludedBranchIds || []);
  availableBranchIds.value = (props.availableBranches || []).filter((b) => !excluded.has(b.id)).map((b) => b.id);
}, { immediate: true });

const isFormValid = computed(() => form.name.trim().length > 0 && form.price >= 0);

function handleClose() {
  isOpen.value = false;
}

function toggleBadge(id: string) {
  selectedBadgeIds.value = selectedBadgeIds.value.includes(id)
    ? selectedBadgeIds.value.filter((x) => x !== id)
    : [...selectedBadgeIds.value, id];
}

function toggleModifierGroup(id: string) {
  selectedModifierGroupIds.value = selectedModifierGroupIds.value.includes(id)
    ? selectedModifierGroupIds.value.filter((x) => x !== id)
    : [...selectedModifierGroupIds.value, id];
}

function toggleBranch(id: string) {
  availableBranchIds.value = availableBranchIds.value.includes(id)
    ? availableBranchIds.value.filter((x) => x !== id)
    : [...availableBranchIds.value, id];
}

function handleSubmit() {
  if (!isFormValid.value) return;
  const allBranchIds = (props.availableBranches || []).map((b) => b.id);
  const excludedBranchIds = allBranchIds.filter((id) => !availableBranchIds.value.includes(id));
  emit('submit', {
    name: form.name.trim(),
    description: form.description.trim() || undefined,
    price: form.price,
    imageUrl: form.imageUrl.trim() || undefined,
    imageAlt: form.imageAlt.trim() || undefined,
    seoTitle: form.seoTitle.trim() || undefined,
    seoDescription: form.seoDescription.trim() || undefined,
    badgeIds: selectedBadgeIds.value,
    modifierGroupIds: selectedModifierGroupIds.value,
    excludedBranchIds,
  });
}
</script>

<template>
  <UModal v-model="isOpen" @close="handleClose">
    <UCard :ui="{ ring: '', divide: 'divide-y divide-gray-100 dark:divide-gray-800' }">
      <template #header>
        <h3 class="text-lg font-semibold">
          {{ item ? (t('menu.editMenuItem') || 'Edit item') : (t('menu.createMenuItem') || 'Add item') }}
        </h3>
      </template>

      <div class="space-y-4 max-h-[70vh] overflow-y-auto pr-1 -mr-1">
        <UFormGroup :label="t('menu.name') || 'Name'" required>
          <UInput v-model="form.name" size="lg" />
        </UFormGroup>
        <UFormGroup :label="t('menu.description') || 'Description'">
          <UTextarea v-model="form.description" :rows="2" />
        </UFormGroup>
        <UFormGroup :label="t('menu.price') || 'Price'" required>
          <UInput v-model.number="form.price" type="number" step="0.01" size="lg" />
        </UFormGroup>
        <UFormGroup :label="t('menu.image') || 'Image'">
          <ImageUpload v-model="form.imageUrl" :ns-slug="nsSlug" aspect="square" />
        </UFormGroup>
        <UFormGroup :label="t('menu.imageAlt') || 'Image alt text'">
          <UInput v-model="form.imageAlt" size="lg" />
        </UFormGroup>

        <div class="pt-2 border-t border-gray-100 dark:border-gray-800 mt-4">
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('menu.itemBadges') || 'Badges' }}</span>
            <UButton size="2xs" color="gray" variant="ghost" icon="lucide:settings" @click="emit('manage-badges')" />
          </div>
          <div v-if="!(availableBadges || []).length" class="text-xs text-gray-500 dark:text-gray-400">
            {{ t('menu.noBadges') || 'No badges yet' }}
          </div>
          <div v-else class="flex flex-wrap gap-2">
            <button
              v-for="b in availableBadges"
              :key="b.id"
              type="button"
              class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border-2 transition-opacity"
              :style="{ backgroundColor: b.bgColor, color: b.textColor, borderColor: selectedBadgeIds.includes(b.id) ? b.textColor : 'transparent', opacity: selectedBadgeIds.includes(b.id) ? 1 : 0.45 }"
              @click="toggleBadge(b.id)"
            >
              <span v-if="b.icon">{{ b.icon }}</span>{{ b.text }}
            </button>
          </div>
        </div>

        <div class="pt-2 border-t border-gray-100 dark:border-gray-800 mt-4">
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('menu.modifiers') || 'Modifiers' }}</span>
            <UButton size="2xs" color="gray" variant="ghost" icon="lucide:settings" @click="emit('manage-modifiers')" />
          </div>
          <div v-if="!(availableModifierGroups || []).length" class="text-xs text-gray-500 dark:text-gray-400">
            {{ t('menu.noModifierGroups') || 'No modifier groups yet' }}
          </div>
          <div v-else class="flex flex-wrap gap-2">
            <button
              v-for="g in availableModifierGroups"
              :key="g.id"
              type="button"
              class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border-2 transition-colors"
              :class="selectedModifierGroupIds.includes(g.id)
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/30 text-primary-700 dark:text-primary-300'
                : 'border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400'"
              @click="toggleModifierGroup(g.id)"
            >
              {{ g.name }}
            </button>
          </div>
        </div>

        <div v-if="(availableBranches || []).length" class="pt-2 border-t border-gray-100 dark:border-gray-800 mt-4">
          <div class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {{ t('menu.availableAtBranches') || 'Available at branches' }}
          </div>
          <p class="text-xs text-gray-500 dark:text-gray-400 mb-2">
            {{ t('menu.excludedEverywhere') || 'Uncheck a branch where this item is not on the menu.' }}
          </p>
          <div class="flex flex-wrap gap-3">
            <label
              v-for="b in availableBranches"
              :key="b.id"
              class="flex items-center gap-1.5 text-sm cursor-pointer"
            >
              <UCheckbox :model-value="availableBranchIds.includes(b.id)" @update:model-value="toggleBranch(b.id)" />
              {{ b.name }}
            </label>
          </div>
        </div>

        <div class="pt-2 border-t border-gray-100 dark:border-gray-800">
          <div class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 mt-4">
            SEO
          </div>
          <div class="space-y-4">
            <UFormGroup :label="t('menu.seoTitle') || 'SEO title'">
              <UInput v-model="form.seoTitle" size="lg" />
            </UFormGroup>
            <UFormGroup :label="t('menu.seoDescription') || 'SEO description'">
              <UTextarea v-model="form.seoDescription" :rows="2" />
            </UFormGroup>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton color="gray" variant="ghost" :label="t('app.cancel')" @click="handleClose" />
          <UButton
            color="primary"
            :label="saving ? (t('app.loading') || 'Loading...') : (t('app.save') || 'Save')"
            :loading="saving"
            :disabled="!isFormValid || saving"
            @click="handleSubmit"
          />
        </div>
      </template>
    </UCard>
  </UModal>
</template>
