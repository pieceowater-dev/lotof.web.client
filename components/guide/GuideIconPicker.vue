<script lang="ts" setup>
const GUIDE_ICON_CHOICES: string[] = [
  'lucide:book-open', 'lucide:help-circle', 'lucide:life-buoy', 'lucide:compass',
  'lucide:rocket', 'lucide:settings', 'lucide:users', 'lucide:credit-card',
  'lucide:shopping-cart', 'lucide:truck', 'lucide:receipt', 'lucide:message-square',
  'lucide:play-circle', 'lucide:file-text', 'lucide:star', 'lucide:shield',
  'lucide:zap', 'lucide:calendar', 'lucide:map-pin', 'lucide:layout-grid',
];

const props = defineProps<{ modelValue: string }>();
const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>();

const isOpen = ref(false);
function pick(icon: string) {
  emit('update:modelValue', icon);
  isOpen.value = false;
}
</script>

<template>
  <UPopover v-model:open="isOpen" :popper="{ strategy: 'fixed' }">
    <button
      type="button"
      class="flex items-center justify-center h-11 w-11 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
      :title="modelValue"
    >
      <UIcon :name="modelValue || 'lucide:book-open'" class="w-5 h-5 text-gray-600 dark:text-gray-300" />
    </button>
    <template #panel>
      <div class="grid grid-cols-5 gap-1 p-2 w-56">
        <button
          v-for="icon in GUIDE_ICON_CHOICES"
          :key="icon"
          type="button"
          class="flex items-center justify-center h-10 w-10 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          :class="props.modelValue === icon && 'bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-300'"
          @click="pick(icon)"
        >
          <UIcon :name="icon" class="w-5 h-5" />
        </button>
      </div>
      <div class="px-2 pb-2">
        <UInput :model-value="modelValue" size="xs" placeholder="lucide:custom-icon" @update:model-value="(v: string) => emit('update:modelValue', v)" />
      </div>
    </template>
  </UPopover>
</template>
