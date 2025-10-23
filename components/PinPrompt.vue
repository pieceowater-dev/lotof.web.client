<template>
  <UModal :model-value="modelValue" @update:modelValue="val => emit('update:modelValue', val)" :ui="{ width: 'sm:max-w-md' }">
    <UCard>
      <template #header>
        <h3 class="text-lg font-semibold">{{ title }}</h3>
      </template>
      <div class="space-y-2">
        <p class="text-gray-600 text-sm">{{ description }}</p>
        <UInput
          v-model="pinInput"
          maxlength="6"
          placeholder="******"
          type="password"
          class="w-full"
          @keyup.enter="submitPin"
        />
        <div v-if="error" class="text-red-500 text-xs">{{ error }}</div>
      </div>
      <template #footer>
  <UButton color="primary" @click="submitPin">{{ t('common.ok') }}</UButton>
  <UButton color="gray" variant="ghost" @click="close">{{ t('common.cancel') }}</UButton>
      </template>
    </UCard>
  </UModal>
</template>

<script setup lang="ts">
import { ref, watch, defineEmits, defineProps } from 'vue';
import { useI18n } from '@/composables/useI18n';
const { t } = useI18n();
const props = defineProps({
  modelValue: Boolean,
  title: { type: String, default: '' },
  description: { type: String, default: '' },
  errorText: { type: String, default: '' },
});
const emit = defineEmits(['update:modelValue', 'submit']);
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
