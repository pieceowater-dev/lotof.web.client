<template>
  <label class="catalog-search">
    <UIcon name="lucide:search" class="h-4 w-4 flex-shrink-0 text-gray-400" />
    <input
      :value="modelValue"
      type="text"
      class="catalog-search__input"
      :placeholder="placeholder"
      :aria-label="placeholder"
      autocomplete="off"
      @input="onInput"
    />
    <button v-if="modelValue" type="button" class="catalog-search__clear" :aria-label="t('guide.searchClear')" @click="clear">
      <UIcon name="lucide:x" class="h-3.5 w-3.5" />
    </button>
  </label>
</template>

<script setup lang="ts">
import { useI18n } from '@/composables/useI18n';

defineProps<{ modelValue: string; placeholder: string }>();
const emit = defineEmits<{ (e: 'update:modelValue', v: string): void; (e: 'input'): void }>();
const { t } = useI18n();

function onInput(ev: Event) {
  emit('update:modelValue', (ev.target as HTMLInputElement).value);
  emit('input');
}
function clear() {
  emit('update:modelValue', '');
  emit('input');
}
</script>

<style scoped>
.catalog-search {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  border-radius: 9999px;
  padding: 0.65rem 1.1rem;
  background: rgba(15, 23, 42, 0.04);
  box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.08);
  transition: box-shadow 0.4s cubic-bezier(0.32, 0.72, 0, 1), background 0.4s;
}
.catalog-search:focus-within { background: #fff; box-shadow: inset 0 0 0 1.5px #2563eb, 0 0 0 4px rgba(37, 99, 235, 0.12); }
.dark .catalog-search { background: rgba(255, 255, 255, 0.06); box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.12); }
.dark .catalog-search:focus-within { background: rgba(255, 255, 255, 0.08); box-shadow: inset 0 0 0 1.5px #60a5fa, 0 0 0 4px rgba(96, 165, 250, 0.16); }
.catalog-search__input { min-width: 0; flex: 1; background: transparent; font-size: 0.9375rem; color: #0f172a; }
.catalog-search__input, .catalog-search__input:focus, .catalog-search__input:focus-visible { outline: none !important; box-shadow: none !important; border: 0 !important; }
.catalog-search__input::placeholder { color: #94a3b8; }
.dark .catalog-search__input { color: #fff; }
.catalog-search__clear { display: flex; height: 1.5rem; width: 1.5rem; align-items: center; justify-content: center; border-radius: 9999px; color: #94a3b8; }
.catalog-search__clear:hover { background: rgba(15, 23, 42, 0.08); }
.dark .catalog-search__clear:hover { background: rgba(255, 255, 255, 0.1); }
</style>
