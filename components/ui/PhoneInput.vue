<script lang="ts" setup>
// Thin wrapper around UInput that applies the shared "as you type" phone mask
// (utils/phone.ts) on every keystroke and flags an invalid number. v-model is
// the display string; use normalizePhoneForStorage() at submit time.
import { formatPhoneAsYouType, sanitizePhoneInput, isPhoneInputValid } from '@/utils/phone';
import { useI18n } from '@/composables/useI18n';

const { t } = useI18n();

const props = withDefaults(defineProps<{
  modelValue: string;
  size?: '2xs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  placeholder?: string;
  autofocus?: boolean;
  disabled?: boolean;
}>(), { size: 'md', placeholder: '+7 700 000 00 00' });

const emit = defineEmits<{
  (e: 'update:modelValue', v: string): void;
  (e: 'enter'): void;
}>();

function onInput(e: Event) {
  const raw = (e.target as HTMLInputElement).value;
  emit('update:modelValue', formatPhoneAsYouType(raw));
}
function onBlur() {
  if (props.modelValue) emit('update:modelValue', formatPhoneAsYouType(props.modelValue));
}
const invalid = computed(() => !!props.modelValue.trim() && !isPhoneInputValid(props.modelValue.trim()));

// keep external programmatic sets tidy too
watch(() => props.modelValue, (v) => {
  const sane = sanitizePhoneInput(v || '');
  if (sane !== v) emit('update:modelValue', sane);
});
</script>

<template>
  <div>
    <UInput
      :model-value="modelValue"
      type="tel"
      inputmode="tel"
      icon="i-heroicons-phone"
      :size="size"
      :placeholder="placeholder"
      :autofocus="autofocus"
      :disabled="disabled"
      :color="invalid ? 'red' : undefined"
      @input="onInput"
      @blur="onBlur"
      @keyup.enter="emit('enter')"
    />
    <p v-if="invalid" class="text-xs text-red-500 mt-1">{{ t('common.invalidPhone') || 'Проверьте номер телефона' }}</p>
  </div>
</template>
