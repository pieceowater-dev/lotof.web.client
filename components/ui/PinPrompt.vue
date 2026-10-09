<template>
  <UModal
    :model-value="modelValue"
    :ui="{
      width: 'sm:max-w-md',
      overlay: { background: 'bg-gray-900/30 dark:bg-gray-950/60 backdrop-blur-sm' },
      rounded: 'rounded-[2rem]',
      shadow: 'shadow-2xl',
    }"
    @update:model-value="val => emit('update:modelValue', val)"
  >
    <UCard
      :ui="{
        ring: 'ring-1 ring-black/5 dark:ring-white/10',
        rounded: 'rounded-[2rem]',
        background: 'bg-white dark:bg-[#1a1a1a]',
        divide: '',
        header: { padding: 'px-6 pt-6 pb-2 sm:px-6' },
        body: { padding: 'px-6 py-3 sm:p-6 sm:pt-3 sm:pb-3' },
        footer: { padding: 'px-6 pb-6 pt-3 sm:px-6' },
      }"
    >
      <template #header>
        <div class="flex items-center gap-3">
          <span class="icon-tile !h-10 !w-10 !rounded-xl"><UIcon name="lucide:key-round" class="h-5 w-5" /></span>
          <h3 class="text-lg font-extrabold tracking-tight text-gray-900 dark:text-white">
            {{ title }}
          </h3>
        </div>
      </template>
      <div class="space-y-3">
        <p class="text-sm leading-6 text-gray-600 dark:text-gray-400">
          {{ description }}
        </p>
        <UInput
          v-model="pinInput"
          maxlength="6"
          placeholder="******"
          type="password"
          size="lg"
          :ui="{ rounded: 'rounded-full', base: 'text-center tracking-[0.5em]' }"
          class="w-full"
          @keyup.enter="submitPin"
        />
        <div
          v-if="error"
          class="text-xs text-red-600 dark:text-red-400"
        >
          {{ error }}
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <button
            type="button"
            class="at-btn"
            @click="close"
          >
            {{ t('common.cancel') }}
          </button>
          <button
            type="button"
            class="at-btn at-btn--primary"
            @click="submitPin"
          >
            {{ t('common.ok') }}
          </button>
        </div>
      </template>
    </UCard>
  </UModal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
const { t } = useI18n();
const props = defineProps({
  modelValue: Boolean,
  title: { type: String, default: '' },
  description: { type: String, default: '' },
  errorText: { type: String, default: '' },
});
const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
  (e: 'submit', pin: string): void;
}>();
const pinInput = ref('');
const error = ref('');

watch(() => props.modelValue, (val) => {
  if (val) {
    pinInput.value = '';
    error.value = '';
  }
});

function submitPin() {
  if (pinInput.value.length !== 6) {
    error.value = props.errorText || 'PIN must be 6 digits';
    return;
  }
  emit('submit', pinInput.value);
  close();
}
function close() {
  emit('update:modelValue', false);
}
</script>
