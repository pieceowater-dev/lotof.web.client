<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { BUSINESS_TYPES, type BusinessType } from '@/config/businessTypes';
import { hubGetNamespaceBusinessType } from '@/api/hub/namespaces/businessType';

const { t, locale } = useI18n();
const { token } = useAuth();

const props = defineProps<{
  modelValue: boolean;
  saving?: boolean;
  isFirstBoard?: boolean;
  namespaceId?: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
  (e: 'submit', payload: Record<string, any>): void;
}>();

const isOpen = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
});

// Creating a board only ever asks for a name -- everything else (columns,
// modules, integrations) gets a sensible server-side default and is edited
// later from Board settings once the board actually exists. Cuts a
// one-field decision down from a wall of toggles nobody has context for yet.
// The one exception: the very first board also offers an optional business
// type, which seeds a curated set of task types instead of the single
// generic default.
const form = reactive({ name: '' });
const selectedBusinessType = ref<BusinessType | null>(null);

watch(() => props.modelValue, async (open) => {
  if (!open) return;
  form.name = '';
  selectedBusinessType.value = null;
  if (props.isFirstBoard && props.namespaceId && token.value) {
    try {
      const current = await hubGetNamespaceBusinessType(token.value, props.namespaceId);
      if (current) selectedBusinessType.value = current as BusinessType;
    } catch {
      // Non-fatal -- the picker just starts unselected if this lookup fails.
    }
  }
});

const isFormValid = computed(() => form.name.trim().length > 0);

function handleClose() {
  isOpen.value = false;
}

function handleSubmit() {
  if (!isFormValid.value) return;
  const payload: Record<string, any> = { name: form.name.trim() };
  if (props.isFirstBoard && selectedBusinessType.value) {
    payload.businessType = selectedBusinessType.value;
    payload.locale = locale.value;
    if (props.namespaceId && token.value) {
      import('@/api/hub/namespaces/businessType').then(({ hubSetNamespaceBusinessType }) => {
        hubSetNamespaceBusinessType(token.value!, props.namespaceId!, selectedBusinessType.value!).catch(() => {});
      });
    }
  }
  emit('submit', payload);
}
</script>

<template>
  <UModal v-model="isOpen" @close="handleClose" :ui="{ width: 'sm:max-w-md' }">
    <UCard :ui="{ ring: '' }">
      <template #header>
        <h3 class="text-lg font-semibold">{{ t('tasks.createBoard') || 'Create board' }}</h3>
      </template>

      <div class="space-y-3">
        <UFormGroup :label="t('tasks.boardName') || 'Name'" required>
          <UInput v-model="form.name" size="lg" autofocus :placeholder="t('tasks.boardNamePlaceholder') || 'Delivery, Marketing, IT...'" @keyup.enter="handleSubmit" />
        </UFormGroup>
        <p class="text-xs text-gray-400">
          {{ t('tasks.createBoardHint') || 'You can set up columns, modules and integrations afterwards, from Board settings.' }}
        </p>

        <div v-if="isFirstBoard">
          <label class="mb-1.5 block text-xs font-medium text-gray-500">
            {{ t('onboarding.quickSetupTitle') || 'Quick Setup' }}
          </label>
          <p class="mb-2 text-xs text-gray-400">
            {{ t('tasks.businessTypeHint') || "Optional: pick your business type and we'll pre-fill this board with a starting set of task types." }}
          </p>
          <div class="grid grid-cols-3 gap-2">
            <button
              v-for="option in BUSINESS_TYPES"
              :key="option.value"
              type="button"
              class="flex flex-col items-center gap-1.5 rounded-lg border p-2 text-center transition-colors"
              :class="selectedBusinessType === option.value
                ? 'border-primary bg-primary-50 text-primary dark:bg-primary-900/20 dark:text-primary-300'
                : 'border-gray-200 hover:border-primary/50 dark:border-gray-700'"
              @click="selectedBusinessType = selectedBusinessType === option.value ? null : option.value"
            >
              <UIcon :name="option.icon" class="h-4 w-4" />
              <span class="text-[11px] font-medium">{{ t(option.titleKey) }}</span>
            </button>
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
