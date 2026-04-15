<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
import type { ClientRow } from '@/api/contacts/listClients';

interface Props {
  client: ClientRow | null;
  editMode: boolean;
  editingFirstName?: string;
  editingLastName?: string;
  editingMiddleName?: string;
  editingBirthDate?: string;
  editingGender?: boolean | null;
  editingLegalName?: string;
  editingBrandName?: string;
  editingBinIin?: string;
  editingRegistrationCountry?: string;
  editingRegistrationDate?: string;
  additionalInfo?: string;
  editingAdditionalInfo?: string;
}

interface Emits {
  startEdit: [];
  saveEdit: [];
  cancelEdit: [];
  updateField: [field: string, value: string | boolean | null];
}

const props = withDefaults(defineProps<Props>(), {
  editingFirstName: '',
  editingLastName: '',
  editingMiddleName: '',
  editingBirthDate: '',
  editingGender: null,
  editingLegalName: '',
  editingBrandName: '',
  editingBinIin: '',
  editingRegistrationCountry: '',
  editingRegistrationDate: '',
  additionalInfo: '',
  editingAdditionalInfo: '',
});

const emit = defineEmits<Emits>();
const { t } = useI18n();

const isIndividual = computed(() => props.client?.client.clientType === 'INDIVIDUAL');

function formatGender(gender?: boolean | null): string {
  if (gender === null || gender === undefined) return '--';
  if (gender === true) {
    return t('contacts.male') || 'Мужской';
  }
  if (gender === false) {
    return t('contacts.female') || 'Женский';
  }
  return '--';
}
</script>

<template>
  <div
    v-if="client"
    class="bg-white dark:bg-gray-800 rounded-lg shadow ring-1 ring-gray-200 dark:ring-gray-700 overflow-hidden"
  >
    <!-- Header -->
    <div class="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <UIcon
          name="i-heroicons-information-circle"
          class="w-5 h-5 text-emerald-600 dark:text-emerald-400"
        />
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
          {{ t('contacts.information') || 'Информация' }}
        </h2>
      </div>
      <div class="flex gap-2">
        <UButton
          v-if="!editMode"
          icon="lucide:pencil"
          size="xs"
          color="gray"
          variant="ghost"
          @click="() => emit('startEdit')"
        />
        <template v-else>
          <UButton
            size="xs"
            color="primary"
            variant="soft"
            @click="() => emit('saveEdit')"
          >
            {{ t('common.save') }}
          </UButton>
          <UButton
            size="xs"
            color="gray"
            variant="ghost"
            @click="() => emit('cancelEdit')"
          >
            {{ t('common.cancel') }}
          </UButton>
        </template>
      </div>
    </div>

    <!-- Content -->
    <div class="px-5 py-5">
      <!-- View Mode -->
      <template v-if="!editMode">
        <div v-if="client.individual">
          <div class="flex items-center gap-2 mb-3">
            <UIcon
              name="i-heroicons-user"
              class="w-4 h-4 text-emerald-600 dark:text-emerald-400"
            />
            <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">
              {{ t('contacts.personalInformation') }}
            </h3>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <p class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                {{ t('contacts.lastName') }}
              </p>
              <p class="text-sm text-gray-900 dark:text-white">
                {{ client.individual.lastName }}
              </p>
            </div>
            <div>
              <p class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                {{ t('contacts.firstName') }}
              </p>
              <p class="text-sm text-gray-900 dark:text-white">
                {{ client.individual.firstName }}
              </p>
            </div>
            <div v-if="client.individual.middleName">
              <p class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                {{ t('contacts.middleName') }}
              </p>
              <p class="text-sm text-gray-900 dark:text-white">
                {{ client.individual.middleName }}
              </p>
            </div>
            <div v-if="client.individual.birthDate">
              <p class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                {{ t('contacts.birthDate') }}
              </p>
              <p class="text-sm text-gray-900 dark:text-white">
                {{ new Date(client.individual.birthDate).toLocaleDateString('ru-RU') }}
              </p>
            </div>
            <div>
              <p class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                {{ t('contacts.gender') }}
              </p>
              <p class="text-sm text-gray-900 dark:text-white">
                {{ formatGender(client.individual.gender) }}
              </p>
            </div>
          </div>
        </div>

        <div v-if="client.legalEntity">
          <div class="flex items-center gap-2 mb-3">
            <UIcon
              name="i-heroicons-building-office-2"
              class="w-4 h-4 text-emerald-600 dark:text-emerald-400"
            />
            <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">
              {{ t('contacts.companyInformation') }}
            </h3>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div
              v-if="client.legalEntity.legalName"
              class="col-span-2"
            >
              <p class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                {{ t('contacts.legalName') }}
              </p>
              <p class="text-sm text-gray-900 dark:text-white">
                {{ client.legalEntity.legalName }}
              </p>
            </div>
            <div v-if="client.legalEntity.brandName">
              <p class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                {{ t('contacts.brandName') }}
              </p>
              <p class="text-sm text-gray-900 dark:text-white">
                {{ client.legalEntity.brandName }}
              </p>
            </div>
            <div v-if="client.legalEntity.binIin">
              <p class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                {{ t('contacts.binIin') }}
              </p>
              <p class="text-sm font-mono text-gray-900 dark:text-white">
                {{ client.legalEntity.binIin }}
              </p>
            </div>
            <div v-if="client.legalEntity.registrationCountry">
              <p class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                {{ t('contacts.registrationCountry') }}
              </p>
              <p class="text-sm text-gray-900 dark:text-white">
                {{ client.legalEntity.registrationCountry }}
              </p>
            </div>
            <div v-if="client.legalEntity.registrationDate">
              <p class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                {{ t('contacts.registrationDate') }}
              </p>
              <p class="text-sm text-gray-900 dark:text-white">
                {{ new Date(client.legalEntity.registrationDate).toLocaleDateString('ru-RU') }}
              </p>
            </div>
          </div>
        </div>

        <div class="mt-4">
          <p class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
            {{ t('contacts.additionalInfo') }}
          </p>
          <p class="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">
            {{ additionalInfo || '—' }}
          </p>
        </div>
      </template>

      <!-- Edit Mode -->
      <template v-else>
        <form
          v-if="client.individual"
          class="space-y-6"
        >
          <div class="space-y-3">
            <div class="flex items-center gap-2">
              <UIcon
                name="i-heroicons-user"
                class="w-4 h-4 text-emerald-600"
              />
              <h3 class="text-base font-semibold text-gray-900 dark:text-white">
                {{ t('contacts.personalInformation') }}
              </h3>
            </div>
            
            <UFormGroup
              :label="t('contacts.lastName')"
              required
            >
              <UInput
                :model-value="editingLastName"
                type="text"
                size="md"
                @update:model-value="$emit('updateField', 'lastName', $event)"
              />
            </UFormGroup>

            <UFormGroup
              :label="t('contacts.firstName')"
              required
            >
              <UInput
                :model-value="editingFirstName"
                type="text"
                size="md"
                @update:model-value="$emit('updateField', 'firstName', $event)"
              />
            </UFormGroup>

            <UFormGroup :label="t('contacts.middleName')">
              <UInput
                :model-value="editingMiddleName"
                type="text"
                size="md"
                @update:model-value="$emit('updateField', 'middleName', $event)"
              />
            </UFormGroup>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <UFormGroup :label="t('contacts.birthDate')">
                <UInput
                  :model-value="editingBirthDate"
                  type="date"
                  size="md"
                  @update:model-value="$emit('updateField', 'birthDate', $event)"
                />
              </UFormGroup>

              <UFormGroup :label="t('contacts.gender')">
                <USelect
                  :model-value="(editingGender as any)"
                  :options="[
                    { value: null, label: '--' },
                    { value: true, label: t('contacts.male') },
                    { value: false, label: t('contacts.female') }
                  ]"
                  option-attribute="label"
                  value-attribute="value"
                  size="md"
                  @update:model-value="$emit('updateField', 'gender', $event)"
                />
              </UFormGroup>
            </div>
          </div>
        </form>

        <form
          v-else-if="client.legalEntity"
          class="space-y-6"
        >
          <div class="space-y-3">
            <div class="flex items-center gap-2">
              <UIcon
                name="i-heroicons-building-office-2"
                class="w-4 h-4 text-emerald-600 dark:text-emerald-400"
              />
              <h2 class="text-base font-semibold text-gray-900 dark:text-white">
                {{ t('contacts.companyInformation') }}
              </h2>
            </div>
            
            <UFormGroup
              :label="t('contacts.legalName')"
              required
            >
              <UInput
                :model-value="editingLegalName"
                type="text"
                size="md"
                @update:model-value="$emit('updateField', 'legalName', $event)"
              />
            </UFormGroup>

            <UFormGroup :label="t('contacts.brandName')">
              <UInput
                :model-value="editingBrandName"
                type="text"
                size="md"
                @update:model-value="$emit('updateField', 'brandName', $event)"
              />
            </UFormGroup>

            <UFormGroup :label="t('contacts.binIin')">
              <UInput
                :model-value="editingBinIin"
                type="text"
                size="md"
                @update:model-value="$emit('updateField', 'binIin', $event)"
              />
            </UFormGroup>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <UFormGroup :label="t('contacts.registrationCountry')">
                <UInput
                  :model-value="editingRegistrationCountry"
                  type="text"
                  size="md"
                  @update:model-value="$emit('updateField', 'registrationCountry', $event)"
                />
              </UFormGroup>

              <UFormGroup :label="t('contacts.registrationDate')">
                <UInput
                  :model-value="editingRegistrationDate"
                  type="date"
                  size="md"
                  @update:model-value="$emit('updateField', 'registrationDate', $event)"
                />
              </UFormGroup>
            </div>
          </div>
        </form>

        <div class="mt-4">
          <UFormGroup :label="t('contacts.additionalInfo')">
            <UTextarea
              :model-value="editingAdditionalInfo"
              :rows="3"
              @update:model-value="$emit('updateField', 'additionalInfo', $event)"
            />
          </UFormGroup>
        </div>
      </template>
    </div>
  </div>
</template>
