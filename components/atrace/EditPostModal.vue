<script setup lang="ts">
import { useI18n } from '@/composables/useI18n';

const props = defineProps<{
  modelValue: boolean,
  form: { title: string; description?: string; location: { address?: string; city?: string; country?: string; comment?: string; latitude?: number | '' ; longitude?: number | '' }, pin: string },
  editingPost: { id: string } | null
}>();
const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void,
  (e: 'save'): void,
  (e: 'delete'): void
}>();

const { t } = useI18n();

const open = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v)
});

const isDeleteConfirmOpen = ref(false);
const editPinCopied = ref(false);

function generatePin() {
  (props.form as any).pin = String(Math.floor(100000 + Math.random() * 900000)).slice(0, 6);
}

function copyPin() {
  if (typeof window !== 'undefined' && props.form.pin) {
    window.navigator.clipboard.writeText(props.form.pin);
    editPinCopied.value = true;
    setTimeout(() => { editPinCopied.value = false; }, 1500);
  }
}
</script>

<template>
  <UModal v-model="open">
    <UCard :ui="{ ring: '', divide: 'divide-y divide-gray-100 dark:divide-gray-800' }">
      <template #header>
        <div class="flex items-center justify-between">
          <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">
            {{ t('common.edit') || 'Edit location' }}
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
            <UButton size="xs" color="primary" variant="soft" @click="copyPin" :disabled="!props.form.pin">
              <span v-if="!editPinCopied">{{ t('common.copy') }}</span>
              <span v-else>{{ t('common.copied') }}</span>
            </UButton>
          </div>
          <div class="text-xs text-yellow-600 mt-1" v-html="t('app.pinSecurityNote')"></div>
        </UFormGroup>
      </div>

      <template #footer>
        <div class="flex items-center justify-between gap-2">
          <!-- Delete with confirmation popover -->
          <UPopover v-model="isDeleteConfirmOpen" :popper="{ placement: 'top-start' }">
            <UButton color="red" variant="soft" icon="lucide:trash-2" :disabled="!props.editingPost">
              {{ t('common.delete') }}
            </UButton>
            <template #panel>
              <div class="p-3 max-w-xs">
                <p class="text-sm mb-3">{{ t('common.confirmDelete') }}</p>
                <div class="flex gap-2 justify-end">
                  <UButton color="primary" variant="soft" @click="isDeleteConfirmOpen = false">{{ t('common.cancel') }}</UButton>
                  <UButton color="red" icon="lucide:trash-2"
                           @click="() => { emit('delete'); isDeleteConfirmOpen = false; }">
                    {{ t('common.delete') }}
                  </UButton>
                </div>
              </div>
            </template>
          </UPopover>

          <div class="flex justify-end gap-2">
            <UButton icon="lucide:x" color="primary" variant="soft" @click="open = false">{{ t('common.cancel') }}</UButton>
            <UButton icon="lucide:check" color="primary" :disabled="!props.form.title" @click="emit('save')">{{ t('common.save') }}</UButton>
          </div>
        </div>
      </template>
    </UCard>
  </UModal>
</template>
