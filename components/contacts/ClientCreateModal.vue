<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { logError } from '@/utils/logger';
import {
  contactsCreateIndividualClient,
  contactsCreateLegalEntityClient,
  type CreateIndividualClientInput,
  type CreateLegalEntityClientInput,
} from '@/api/contacts/mutations';

const emit = defineEmits<{
  created: [];
  close: [];
}>();

const { t } = useI18n();
const toast = useToast();
const { token } = useAuth();
const { selected: selectedNS } = useNamespace();

const isOpen = ref(true);
const clientType = ref<'INDIVIDUAL' | 'LEGAL'>('INDIVIDUAL');
const loading = ref(false);

// Individual form
const individualForm = ref({
  firstName: '',
  lastName: '',
  middleName: '',
  birthDate: '',
  gender: '',
});

// Legal entity form
const legalEntityForm = ref({
  legalName: '',
  brandName: '',
  binIin: '',
  registrationCountry: '',
  registrationDate: '',
});

const isFormValid = computed(() => {
  if (clientType.value === 'INDIVIDUAL') {
    return individualForm.value.firstName.trim() && individualForm.value.lastName.trim();
  } else {
    return legalEntityForm.value.legalName.trim();
  }
});

async function handleSubmit() {
  if (!token.value || !selectedNS.value || !isFormValid.value) return;

  try {
    loading.value = true;

    if (clientType.value === 'INDIVIDUAL') {
      const input: CreateIndividualClientInput = {
        individual: {
          firstName: individualForm.value.firstName,
          lastName: individualForm.value.lastName,
          middleName: individualForm.value.middleName || undefined,
          birthDate: individualForm.value.birthDate || undefined,
          gender: individualForm.value.gender || undefined,
        },
        status: 'ACTIVE',
      };
      await contactsCreateIndividualClient(token.value, selectedNS.value, input);
    } else {
      const input: CreateLegalEntityClientInput = {
        legalEntity: {
          legalName: legalEntityForm.value.legalName,
          brandName: legalEntityForm.value.brandName || undefined,
          binIin: legalEntityForm.value.binIin || undefined,
          registrationCountry: legalEntityForm.value.registrationCountry || undefined,
          registrationDate: legalEntityForm.value.registrationDate || undefined,
        },
        status: 'ACTIVE',
      };
      await contactsCreateLegalEntityClient(token.value, selectedNS.value, input);
    }

    emit('created');
    isOpen.value = false;
  } catch (error) {
    logError('Failed to create client:', error);
    toast.add({
      title: t('common.error'),
      description: t('common.contacts.createError'),
      color: 'red',
    });
  } finally {
    loading.value = false;
  }
}

function handleClose() {
  isOpen.value = false;
  emit('close');
}
</script>

<template>
  <UModal v-model="isOpen" @close="handleClose">
    <UCard :ui="{ ring: '', divide: 'divide-y divide-gray-100 dark:divide-gray-800' }">
      <template #header>
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
            {{ t('common.contacts.createClient') }}
          </h2>
        </div>
      </template>

      <div class="space-y-6">
        <!-- Client Type Selection -->
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            {{ t('common.contacts.clientType') }}
          </label>
          <div class="flex gap-3">
            <UButton
              v-for="type in ['INDIVIDUAL', 'LEGAL']"
              :key="type"
              @click="clientType = type as any"
              :variant="clientType === type ? 'solid' : 'outline'"
              :color="clientType === type ? 'primary' : 'gray'"
              class="flex-1"
            >
              {{ type === 'INDIVIDUAL' ? t('common.contacts.individual') : t('common.contacts.legalEntity') }}
            </UButton>
          </div>
        </div>

        <!-- Individual Form -->
        <div v-if="clientType === 'INDIVIDUAL'" class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <UFormGroup :label="t('common.contacts.firstName') + ' *'">
              <UInput
                v-model="individualForm.firstName"
                type="text"
                :placeholder="t('common.contacts.firstName')"
                size="lg"
              />
            </UFormGroup>

            <UFormGroup :label="t('common.contacts.lastName') + ' *'">
              <UInput
                v-model="individualForm.lastName"
                type="text"
                :placeholder="t('common.contacts.lastName')"
                size="lg"
              />
            </UFormGroup>

            <UFormGroup :label="t('common.contacts.middleName')">
              <UInput
                v-model="individualForm.middleName"
                type="text"
                :placeholder="t('common.contacts.middleName')"
                size="lg"
              />
            </UFormGroup>

            <UFormGroup :label="t('common.contacts.gender')">
              <USelect
                v-model="individualForm.gender"
                :options="[
                  { value: 'M', label: t('common.contacts.male') },
                  { value: 'F', label: t('common.contacts.female') },
                ]"
                size="lg"
              />
            </UFormGroup>

            <UFormGroup :label="t('common.contacts.birthDate')" class="md:col-span-2">
              <UInput
                v-model="individualForm.birthDate"
                type="date"
                size="lg"
              />
            </UFormGroup>
          </div>
        </div>

        <!-- Legal Entity Form -->
        <div v-if="clientType === 'LEGAL'" class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <UFormGroup :label="t('common.contacts.legalName') + ' *'" class="md:col-span-2">
              <UInput
                v-model="legalEntityForm.legalName"
                type="text"
                :placeholder="t('common.contacts.legalName')"
                size="lg"
              />
            </UFormGroup>

            <UFormGroup :label="t('common.contacts.brandName')" class="md:col-span-2">
              <UInput
                v-model="legalEntityForm.brandName"
                type="text"
                :placeholder="t('common.contacts.brandName')"
                size="lg"
              />
            </UFormGroup>

            <UFormGroup :label="t('common.contacts.binIin')">
              <UInput
                v-model="legalEntityForm.binIin"
                type="text"
                :placeholder="t('common.contacts.binIin')"
                size="lg"
              />
            </UFormGroup>

            <UFormGroup :label="t('common.contacts.registrationCountry')">
              <UInput
                v-model="legalEntityForm.registrationCountry"
                type="text"
                :placeholder="t('common.contacts.registrationCountry')"
                size="lg"
              />
            </UFormGroup>

            <UFormGroup :label="t('common.contacts.registrationDate')" class="md:col-span-2">
              <UInput
                v-model="legalEntityForm.registrationDate"
                type="date"
                size="lg"
              />
            </UFormGroup>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end gap-3">
          <UButton
            color="gray"
            variant="ghost"
            :label="t('app.cancel')"
            @click="handleClose"
          />
          <UButton
            color="primary"
            :label="loading ? t('app.loading') : t('app.create')"
            :loading="loading"
            :disabled="!isFormValid || loading"
            @click="handleSubmit"
          />
        </div>
      </template>
    </UCard>
  </UModal>
</template>

