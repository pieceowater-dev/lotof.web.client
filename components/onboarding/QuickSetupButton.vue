<template>
  <UButton variant="soft" icon="lucide:sparkles" @click="open">
    {{ label || t('onboarding.needHelp') }}
  </UButton>

  <Modal v-model="isOpen" :header="t('onboarding.quickSetupTitle')" :prevent-close="applying">
    <div class="space-y-4">
      <p class="text-sm text-gray-500 dark:text-gray-400">
        {{ t('onboarding.quickSetupHint') }}
      </p>

      <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <button
          v-for="option in BUSINESS_TYPES"
          :key="option.value"
          type="button"
          class="flex flex-col items-center gap-2 rounded-lg border p-3 text-center transition-colors"
          :class="selected === option.value
            ? 'border-primary bg-primary-50 text-primary dark:bg-primary-900/20 dark:text-primary-300'
            : 'border-gray-200 hover:border-primary/50 dark:border-gray-700'"
          @click="selected = option.value"
        >
          <UIcon :name="option.icon" class="h-5 w-5" />
          <span class="text-xs font-medium">{{ t(option.titleKey) }}</span>
        </button>
      </div>
    </div>

    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton color="gray" variant="ghost" :disabled="applying" @click="isOpen = false">
          {{ t('app.cancel') }}
        </UButton>
        <UButton :loading="applying" :disabled="!selected" @click="apply">
          {{ t('onboarding.applyPreset') }}
        </UButton>
      </div>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useAuth } from '@/composables/useAuth';
import { BUSINESS_TYPES, type BusinessType } from '@/config/businessTypes';
import { hubGetNamespaceBusinessType, hubSetNamespaceBusinessType } from '@/api/hub/namespaces/businessType';

const props = defineProps<{
  namespaceId: string;
  label?: string;
  onApply: (businessType: BusinessType) => Promise<void>;
}>();
const emit = defineEmits<{ (e: 'applied', businessType: BusinessType): void }>();

const { t } = useI18n();
const { token } = useAuth();
const toast = useToast();

const isOpen = ref(false);
const applying = ref(false);
const selected = ref<BusinessType | null>(null);

async function open() {
  isOpen.value = true;
  try {
    const current = await hubGetNamespaceBusinessType(token.value || '', props.namespaceId);
    if (current) selected.value = current;
  } catch {
    // Non-fatal -- the picker just starts unselected if this lookup fails.
  }
}

async function apply() {
  if (!selected.value) return;
  applying.value = true;
  try {
    await hubSetNamespaceBusinessType(token.value || '', props.namespaceId, selected.value);
    await props.onApply(selected.value);
    toast.add({ title: t('onboarding.quickSetupSuccess'), color: 'green' });
    isOpen.value = false;
    emit('applied', selected.value);
  } catch (error: any) {
    toast.add({ title: error?.message || t('onboarding.quickSetupError'), color: 'red' });
  } finally {
    applying.value = false;
  }
}

watch(isOpen, (open) => {
  if (!open) selected.value = null;
});
</script>
