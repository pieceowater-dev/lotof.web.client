<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { atModalUi } from '@/utils/atraceUi';

// A small optional-reason dialog: quick one-tap reasons plus free text, and
// (for postponing) a new due date. Never blocks -- Skip confirms with nothing.
const props = defineProps<{
  modelValue: boolean;
  title: string;
  quick?: string[];
  askDue?: boolean;
  busy?: boolean;
}>();
const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
  (e: 'confirm', v: { text: string; dueAt?: string }): void;
}>();

const { t } = useI18n();
const text = ref('');
const due = ref('');

watch(() => props.modelValue, (open) => { if (open) { text.value = ''; due.value = ''; } });

function pick(q: string) { text.value = text.value ? `${text.value}; ${q}` : q; }
function confirm() {
  emit('confirm', { text: text.value.trim(), dueAt: due.value ? new Date(due.value).toISOString() : undefined });
}
</script>

<template>
  <UModal :model-value="modelValue" class="at-modal" :ui="{ ...atModalUi, width: 'sm:max-w-md' }" @update:model-value="(v: boolean) => emit('update:modelValue', v)">
    <div class="p-5 space-y-4">
      <h3 class="at-h2">{{ title }}</h3>
      <div v-if="quick?.length" class="flex flex-wrap gap-1.5">
        <button v-for="q in quick" :key="q" type="button" class="pill-filter" @click="pick(q)">{{ q }}</button>
      </div>
      <UTextarea v-model="text" :rows="3" autoresize :placeholder="t('tasks.reasonPlaceholder')" :ui="{ rounded: 'rounded-xl' }" />
      <div v-if="askDue" class="space-y-1">
        <label class="text-xs font-medium text-slate-500">{{ t('tasks.reasonNewDue') }}</label>
        <UInput v-model="due" type="datetime-local" :ui="{ rounded: 'rounded-xl' }" />
      </div>
      <div class="flex justify-end gap-2">
        <button type="button" class="at-btn" :disabled="busy" @click="emit('update:modelValue', false)">{{ t('common.cancel') }}</button>
        <button type="button" class="at-btn at-btn--primary" :disabled="busy" @click="confirm">
          <Icon :name="busy ? 'lucide:loader-2' : 'lucide:check'" class="w-4 h-4" :class="{ 'animate-spin': busy }" />{{ text.trim() || due ? t('common.save') : t('tasks.reasonSkip') }}
        </button>
      </div>
    </div>
  </UModal>
</template>
