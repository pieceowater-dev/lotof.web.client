<script setup lang="ts">
import { useI18n } from '@/composables/useI18n';

const props = defineProps<{
  modelValue: boolean,
  form: { title: string; description?: string; location: { address?: string; city?: string }; pin: string }
}>();
const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void,
  (e: 'submit'): void
}>();

const open = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v)
});

const { t } = useI18n();

function generatePin() {
  (props.form as any).pin = String(Math.floor(100000 + Math.random() * 900000)).slice(0, 6);
}
</script>

<template>
  <UModal v-model="open">
    <UCard :ui="{ ring: '', divide: 'divide-y divide-gray-100 dark:divide-gray-800' }">
      <template #header>
        <div class="flex items-center justify-between">
          <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">
            {{ t('app.atraceAddLocation') }}
          </h3>
          <UButton color="gray" variant="ghost" icon="lucide:x" class="-my-1" @click="open = false" />
        </div>
      </template>

      <div class="space-y-3">
        <UFormGroup :label="t('common.title')">
          <UInput v-model="props.form.title" :placeholder="t('common.title')" />
        </UFormGroup>
        <UFormGroup :label="t('common.description')">
          <UTextarea v-model="props.form.description" :placeholder="t('common.description')" />
        </UFormGroup>
        <USeparator />
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <UFormGroup :label="t('common.address')">
            <UInput v-model="props.form.location.address" :placeholder="t('common.address')" />
          </UFormGroup>
          <UFormGroup :label="t('common.city')">
            <UInput v-model="props.form.location.city" :placeholder="t('common.city')" />
          </UFormGroup>
        </div>
        <USeparator />
        <UFormGroup :label="t('app.pin6digits')">
          <div class="flex gap-2 items-center">
            <UInput v-model="props.form.pin" maxlength="6" placeholder="******" class="w-32" />
            <UButton size="xs" color="primary" @click="generatePin">{{ t('common.generate') }}</UButton>
          </div>
          <div class="text-xs text-yellow-600 mt-1" v-html="t('app.pinSecurityNote')"></div>
        </UFormGroup>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton icon="lucide:x" color="primary" variant="soft" @click="open = false">{{ t('common.cancel') }}</UButton>
          <UButton icon="lucide:check" color="primary" :disabled="!props.form.title || String(props.form.pin).length !== 6" @click="emit('submit')">{{ t('common.create') }}</UButton>
        </div>
      </template>
    </UCard>
  </UModal>
</template>
