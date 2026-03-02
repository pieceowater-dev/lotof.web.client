<script setup lang="ts">
import { computed } from 'vue';
import type { ClientRow } from '@/api/contacts/listClients';

interface Props {
  client: ClientRow | null;
  editMode: boolean;
  editingFirstName?: string;
  editingLastName?: string;
  editingMiddleName?: string;
  editingBirthDate?: string;
  editingGender?: string;
  editingLegalName?: string;
  editingBrandName?: string;
  editingBinIin?: string;
  editingRegistrationCountry?: string;
  editingRegistrationDate?: string;
}

interface Emits {
  startEdit: [];
  saveEdit: [];
  cancelEdit: [];
  updateField: [field: string, value: string];
}

const props = withDefaults(defineProps<Props>(), {
  editingFirstName: '',
  editingLastName: '',
  editingMiddleName: '',
  editingBirthDate: '',
  editingGender: '',
  editingLegalName: '',
  editingBrandName: '',
  editingBinIin: '',
  editingRegistrationCountry: '',
  editingRegistrationDate: '',
});

const emit = defineEmits<Emits>();
const { t } = useI18n();

const isIndividual = computed(() => props.client?.client.clientType === 'INDIVIDUAL');
</script>

<template>
  <div v-if="client" class="bg-white dark:bg-gray-800 rounded-lg shadow ring-1 ring-gray-200 dark:ring-gray-700 overflow-hidden">
    <!-- Header -->
    <div class="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <UIcon name="i-heroicons-information-circle" class="w-5 h-5 text-blue-600 dark:text-blue-400" />
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
          {{ t('common.contacts.information') || 'Информация' }}
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
            Сохранить
          </UButton>
          <UButton
            size="xs"
            color="gray"
            variant="ghost"
            @click="() => emit('cancelEdit')"
          >
            Отменить
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
            <UIcon name="i-heroicons-user" class="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Персональные данные
            </h3>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <p class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">{{ t('common.contacts.lastName') }}</p>
              <p class="text-sm text-gray-900 dark:text-white">{{ client.individual.lastName }}</p>
            </div>
            <div>
              <p class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">{{ t('common.contacts.firstName') }}</p>
              <p class="text-sm text-gray-900 dark:text-white">{{ client.individual.firstName }}</p>
            </div>
            <div v-if="client.individual.middleName">
              <p class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">{{ t('common.contacts.middleName') }}</p>
              <p class="text-sm text-gray-900 dark:text-white">{{ client.individual.middleName }}</p>
            </div>
            <div v-if="client.individual.birthDate">
              <p class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">{{ t('common.contacts.birthDate') }}</p>
              <p class="text-sm text-gray-900 dark:text-white">{{ new Date(client.individual.birthDate).toLocaleDateString('ru-RU') }}</p>
            </div>
            <div v-if="client.individual.gender">
              <p class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">{{ t('common.contacts.gender') }}</p>
              <p class="text-sm text-gray-900 dark:text-white capitalize">{{ client.individual.gender }}</p>
            </div>
          </div>
        </div>

        <div v-if="client.legalEntity">
          <div class="flex items-center gap-2 mb-3">
            <UIcon name="i-heroicons-building-office-2" class="w-4 h-4 text-green-600 dark:text-green-400" />
            <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Данные юридического лица
            </h3>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div class="col-span-2" v-if="client.legalEntity.legalName">
              <p class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">{{ t('common.contacts.legalName') }}</p>
              <p class="text-sm text-gray-900 dark:text-white">{{ client.legalEntity.legalName }}</p>
            </div>
            <div v-if="client.legalEntity.brandName">
              <p class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">{{ t('common.contacts.brandName') }}</p>
              <p class="text-sm text-gray-900 dark:text-white">{{ client.legalEntity.brandName }}</p>
            </div>
            <div v-if="client.legalEntity.binIin">
              <p class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">{{ t('common.contacts.binIin') }}</p>
              <p class="text-sm font-mono text-gray-900 dark:text-white">{{ client.legalEntity.binIin }}</p>
            </div>
            <div v-if="client.legalEntity.registrationCountry">
              <p class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">{{ t('common.contacts.registrationCountry') }}</p>
              <p class="text-sm text-gray-900 dark:text-white">{{ client.legalEntity.registrationCountry }}</p>
            </div>
            <div v-if="client.legalEntity.registrationDate">
              <p class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">{{ t('common.contacts.registrationDate') }}</p>
              <p class="text-sm text-gray-900 dark:text-white">{{ new Date(client.legalEntity.registrationDate).toLocaleDateString('ru-RU') }}</p>
            </div>
          </div>
        </div>
      </template>

      <!-- Edit Mode -->
      <template v-else>
        <form v-if="client.individual" class="space-y-6">
          <div class="space-y-3">
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-user" class="w-4 h-4 text-blue-600" />
              <h3 class="text-base font-semibold text-gray-900 dark:text-white">Персональные данные</h3>
            </div>
            
            <UFormGroup label="Фамилия *" required>
              <UInput
                :model-value="editingLastName"
                type="text"
                size="md"
                @update:model-value="$emit('updateField', 'lastName', $event)"
              />
            </UFormGroup>

            <UFormGroup label="Имя *" required>
              <UInput
                :model-value="editingFirstName"
                type="text"
                size="md"
                @update:model-value="$emit('updateField', 'firstName', $event)"
              />
            </UFormGroup>

            <UFormGroup label="Отчество">
              <UInput
                :model-value="editingMiddleName"
                type="text"
                size="md"
                @update:model-value="$emit('updateField', 'middleName', $event)"
              />
            </UFormGroup>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <UFormGroup label="Дата рождения">
                <UInput
                  :model-value="editingBirthDate"
                  type="date"
                  size="md"
                  @update:model-value="$emit('updateField', 'birthDate', $event)"
                />
              </UFormGroup>

              <UFormGroup label="Пол">
                <USelect
                  :model-value="editingGender"
                  :options="[
                    { value: '', label: 'Не указано' },
                    { value: 'M', label: 'Мужской' },
                    { value: 'F', label: 'Женский' }
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

        <form v-else-if="client.legalEntity" class="space-y-6">
          <div class="space-y-3">
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-building-office-2" class="w-4 h-4 text-green-600 dark:text-green-400" />
              <h2 class="text-base font-semibold text-gray-900 dark:text-white">Данные юридического лица</h2>
            </div>
            
            <UFormGroup label="Юридическое название *" required>
              <UInput :model-value="editingLegalName" type="text" size="md" @update:model-value="$emit('updateField', 'legalName', $event)" />
            </UFormGroup>

            <UFormGroup label="Торговое название">
              <UInput :model-value="editingBrandName" type="text" size="md" @update:model-value="$emit('updateField', 'brandName', $event)" />
            </UFormGroup>

            <UFormGroup label="БИН/ИИН">
              <UInput :model-value="editingBinIin" type="text" size="md" @update:model-value="$emit('updateField', 'binIin', $event)" />
            </UFormGroup>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <UFormGroup label="Страна регистрации">
                <UInput :model-value="editingRegistrationCountry" type="text" size="md" @update:model-value="$emit('updateField', 'registrationCountry', $event)" />
              </UFormGroup>

              <UFormGroup label="Дата регистрации">
                <UInput :model-value="editingRegistrationDate" type="date" size="md" @update:model-value="$emit('updateField', 'registrationDate', $event)" />
              </UFormGroup>
            </div>
          </div>
        </form>
      </template>

      <!-- Basic Information at the bottom (View Mode) -->
      <template v-if="!editMode && client">
        <div class="border-t border-gray-200 dark:border-gray-700 pt-4">
          <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            Базовая информация
          </h3>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <p class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Создано</p>
              <p class="text-sm text-gray-900 dark:text-white">{{ new Date(client.client.createdAt).toLocaleString('ru-RU') }}</p>
            </div>
            <div>
              <p class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Обновлено</p>
              <p class="text-sm text-gray-900 dark:text-white">{{ new Date(client.client.updatedAt).toLocaleString('ru-RU') }}</p>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
