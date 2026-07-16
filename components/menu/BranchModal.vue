<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import type { MenuBranch } from '@/api/menu/branch/list';

const { t } = useI18n();

const props = defineProps<{
  modelValue: boolean;
  branch?: MenuBranch | null;
  saving?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
  (e: 'submit', payload: Record<string, any>): void;
}>();

const isOpen = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
});

const form = reactive({
  name: '',
  address: '',
  phone: '',
  city: '',
  businessCategory: '',
  lat: undefined as number | undefined,
  lng: undefined as number | undefined,
  isPrimary: false,
});

watch(() => [props.modelValue, props.branch], () => {
  if (!props.modelValue) return;
  const b = props.branch;
  form.name = b?.name || '';
  form.address = b?.address || '';
  form.phone = b?.phone || '';
  form.city = b?.city || '';
  form.businessCategory = b?.businessCategory || '';
  form.lat = b?.lat ?? undefined;
  form.lng = b?.lng ?? undefined;
  form.isPrimary = b?.isPrimary || false;
}, { immediate: true });

// Same phone sanitize/validate rules as the Contacts app's client-create form.
function sanitizePhoneInput(value: string): string {
  return value.replace(/[^\d+()\s-]/g, '');
}
function updatePhoneValue(value: string) {
  form.phone = sanitizePhoneInput(value);
}
const isPhoneValid = computed(() => {
  if (!form.phone) return true;
  const digits = form.phone.replace(/\D/g, '');
  return digits.length >= 10;
});

const isFormValid = computed(() => form.name.trim().length > 0 && form.address.trim().length > 0 && isPhoneValid.value);

function handleClose() {
  isOpen.value = false;
}

function handleSubmit() {
  if (!isFormValid.value) return;
  emit('submit', {
    name: form.name.trim(),
    address: form.address.trim(),
    phone: form.phone.trim() || undefined,
    city: form.city.trim() || undefined,
    businessCategory: form.businessCategory.trim() || undefined,
    lat: form.lat,
    lng: form.lng,
    isPrimary: form.isPrimary,
  });
}
</script>

<template>
  <UModal v-model="isOpen" @close="handleClose">
    <UCard :ui="{ ring: '', divide: 'divide-y divide-gray-100 dark:divide-gray-800' }">
      <template #header>
        <h3 class="text-lg font-semibold">
          {{ branch ? (t('menu.editBranch') || 'Edit branch') : (t('menu.createBranch') || 'Add branch') }}
        </h3>
      </template>

      <div class="space-y-4">
        <UFormGroup :label="t('menu.name') || 'Name'" required>
          <UInput v-model="form.name" size="lg" />
        </UFormGroup>
        <UFormGroup :label="t('menu.address') || 'Address'" required>
          <UInput v-model="form.address" size="lg" />
        </UFormGroup>
        <div class="grid grid-cols-2 gap-4">
          <UFormGroup
            :label="t('menu.phone') || 'Phone'"
            :help="!isPhoneValid ? (t('contacts.invalidPhone') || 'Invalid phone format') : ''"
            :error="!isPhoneValid"
          >
            <UInput
              :model-value="form.phone"
              type="tel"
              inputmode="tel"
              pattern="[0-9+()\s-]*"
              icon="lucide:phone"
              size="lg"
              :placeholder="t('contacts.enterPhone') || '+7 700 123 45 67'"
              @update:model-value="updatePhoneValue"
            />
          </UFormGroup>
          <UFormGroup :label="t('menu.city') || 'City'">
            <UInput v-model="form.city" size="lg" />
          </UFormGroup>
        </div>
        <UFormGroup :label="t('menu.businessCategory') || 'Business category'">
          <UInput v-model="form.businessCategory" size="lg" />
        </UFormGroup>
        <div class="grid grid-cols-2 gap-4">
          <UFormGroup :label="t('menu.lat') || 'Latitude'">
            <UInput v-model.number="form.lat" type="number" step="any" size="lg" />
          </UFormGroup>
          <UFormGroup :label="t('menu.lng') || 'Longitude'">
            <UInput v-model.number="form.lng" type="number" step="any" size="lg" />
          </UFormGroup>
        </div>
        <div class="flex items-center gap-2">
          <UToggle v-model="form.isPrimary" />
          <span class="text-sm">{{ t('menu.isPrimary') || 'Primary branch' }}</span>
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
