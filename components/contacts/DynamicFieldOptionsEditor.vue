<script setup lang="ts">
interface Props {
  modelValue: string[];
  disabled?: boolean;
  title?: string;
  addLabel?: string;
  optionPlaceholderPrefix?: string;
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  title: 'Варианты выбора',
  addLabel: 'Добавить вариант',
  optionPlaceholderPrefix: 'Вариант',
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: string[]): void;
}>();

function updateOption(index: number, value: string) {
  const next = [...props.modelValue];
  next[index] = value;
  emit('update:modelValue', next);
}

function removeOption(index: number) {
  if (props.modelValue.length === 1) {
    emit('update:modelValue', ['']);
    return;
  }
  const next = props.modelValue.filter((_, idx) => idx !== index);
  emit('update:modelValue', next);
}

function addOption() {
  emit('update:modelValue', [...props.modelValue, '']);
}
</script>

<template>
  <div class="space-y-3">
    <div class="text-sm text-amber-800 dark:text-amber-200 font-medium">
      {{ title }}
    </div>

    <div class="space-y-2">
      <div
        v-for="(option, idx) in modelValue"
        :key="`option-${idx}`"
        class="flex items-center gap-2"
      >
        <UInput
          :model-value="option"
          :placeholder="`${optionPlaceholderPrefix} ${idx + 1}`"
          :disabled="disabled"
          @update:model-value="(value) => updateOption(idx, String(value || ''))"
        />
        <UButton
          icon="lucide:trash-2"
          color="red"
          variant="ghost"
          size="xs"
          :disabled="disabled"
          @click="removeOption(idx)"
        />
      </div>
    </div>

    <UButton
      icon="lucide:plus"
      color="amber"
      variant="soft"
      size="xs"
      :disabled="disabled"
      @click="addOption"
    >
      {{ addLabel }}
    </UButton>

    <p class="text-xs text-amber-700/90 dark:text-amber-200/90">
      Минимум один вариант обязателен для сохранения поля списка.
    </p>
  </div>
</template>
