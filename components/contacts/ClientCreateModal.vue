<script setup lang="ts">
import { ref, computed, nextTick } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { logError } from '@/utils/logger';
import {
  contactsCreateIndividualClient,
  contactsCreateLegalEntityClient,
  type CreateIndividualClientInput,
  type CreateLegalEntityClientInput,
} from '@/api/contacts/mutations';
import { createIdentity } from '@/api/contacts/identities';
import { useContactsToken } from '@/composables/useContactsToken';

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

// Phone input ref for autofocus
const phoneInputRef = ref<any>(null);

// Contact information (most important for call center)
const phones = ref<string[]>(['']);
const emails = ref<string[]>(['']);

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

// Client status
const clientStatus = ref<'ACTIVE' | 'ARCHIVED' | 'BLOCKED'>('ACTIVE');

const statusOptions = [
  { value: 'ACTIVE', label: t('common.contacts.active') },
  { value: 'BLOCKED', label: t('common.contacts.blocked') },
  { value: 'ARCHIVED', label: t('common.contacts.archived') },
];

// Validation
const isPhoneValid = (phone: string) => {
  if (!phone) return true; // Empty is ok for additional phones
  // Basic phone validation - at least 10 digits
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10;
};

const isEmailValid = (email: string) => {
  if (!email) return true; // Empty is ok for additional emails
  // Basic email validation
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const hasValidPrimaryPhone = computed(() => {
  const primaryPhone = phones.value[0]?.trim();
  return primaryPhone && isPhoneValid(primaryPhone);
});

const isFormValid = computed(() => {
  // Must have at least primary phone
  if (!hasValidPrimaryPhone.value) return false;
  
  // Validate all entered phones
  for (const phone of phones.value) {
    if (phone.trim() && !isPhoneValid(phone)) return false;
  }
  
  // Validate all entered emails
  for (const email of emails.value) {
    if (email.trim() && !isEmailValid(email)) return false;
  }
  
  if (clientType.value === 'INDIVIDUAL') {
    return individualForm.value.firstName.trim() && individualForm.value.lastName.trim();
  } else {
    return legalEntityForm.value.legalName.trim();
  }
});

// Auto-focus on phone input when modal opens
nextTick(() => {
  if (phoneInputRef.value) {
    phoneInputRef.value.$el?.querySelector('input')?.focus();
  }
});

function addPhone() {
  phones.value.push('');
}

function removePhone(index: number) {
  if (phones.value.length > 1) {
    phones.value.splice(index, 1);
  }
}

function addEmail() {
  emails.value.push('');
}

function removeEmail(index: number) {
  if (emails.value.length > 1) {
    emails.value.splice(index, 1);
  }
}

async function handleSubmit() {
  if (!token.value || !selectedNS.value || !isFormValid.value) return;

  try {
    loading.value = true;

    let clientId: string;

    // Create client
    if (clientType.value === 'INDIVIDUAL') {
      const input: CreateIndividualClientInput = {
        individual: {
          firstName: individualForm.value.firstName,
          lastName: individualForm.value.lastName,
          middleName: individualForm.value.middleName || undefined,
          birthDate: individualForm.value.birthDate || undefined,
          gender: individualForm.value.gender || undefined,
        },
        status: clientStatus.value,
      };
      const result = await contactsCreateIndividualClient(token.value, selectedNS.value, input);
      clientId = result.client.id;
    } else {
      const input: CreateLegalEntityClientInput = {
        legalEntity: {
          legalName: legalEntityForm.value.legalName,
          brandName: legalEntityForm.value.brandName || undefined,
          binIin: legalEntityForm.value.binIin || undefined,
          registrationCountry: legalEntityForm.value.registrationCountry || undefined,
          registrationDate: legalEntityForm.value.registrationDate || undefined,
        },
        status: clientStatus.value,
      };
      const result = await contactsCreateLegalEntityClient(token.value, selectedNS.value, input);
      clientId = result.client.id;
    }

    // Get contacts token
    const { ensure } = useContactsToken();
    const contactsToken = await ensure(selectedNS.value, token.value);
    
    if (contactsToken) {
      // Create phone identities
      for (let i = 0; i < phones.value.length; i++) {
        const phone = phones.value[i].trim();
        if (phone && isPhoneValid(phone)) {
          await createIdentity(contactsToken, clientId, 'phone', phone, i === 0);
        }
      }

      // Create email identities
      for (let i = 0; i < emails.value.length; i++) {
        const email = emails.value[i].trim();
        if (email && isEmailValid(email)) {
          await createIdentity(contactsToken, clientId, 'email', email, i === 0);
        }
      }
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

// Handle Enter key for quick submit
function handleKeyDown(event: KeyboardEvent) {
  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey) && isFormValid.value) {
    handleSubmit();
  }
}
</script>

<template>
  <UModal v-model="isOpen" @close="handleClose" @keydown="handleKeyDown">
    <UCard :ui="{ ring: '', divide: 'divide-y divide-gray-100 dark:divide-gray-800' }">
      <template #header>
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
            {{ t('common.contacts.createClient') }}
          </h2>
          <p class="text-xs text-gray-500 dark:text-gray-400 ml-4">
            ⌘/Ctrl + Enter
          </p>
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

        <!-- Contact Information Section (Most Important) -->
        <div class="space-y-4">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
            📞 {{ t('common.contacts.contactInformation') || 'Contact Information' }}
          </h3>
          
          <!-- Primary Phone (Required, Autofocus) -->
          <UFormGroup 
            :label="t('common.contacts.primaryPhone') || 'Primary Phone' + ' *'"
            :help="!hasValidPrimaryPhone && phones[0] ? (t('common.contacts.invalidPhone') || 'Invalid phone format') : ''"
            :error="!hasValidPrimaryPhone && phones[0]"
          >
            <UInput
              ref="phoneInputRef"
              v-model="phones[0]"
              type="tel"
              :placeholder="t('common.contacts.enterPhone') || '+7 700 123 45 67'"
              size="lg"
              autofocus
            />
          </UFormGroup>

          <!-- Additional Phones -->
          <div v-for="(phone, index) in phones.slice(1)" :key="'phone-' + index" class="flex gap-2">
            <UFormGroup 
              :label="index === 0 ? (t('common.contacts.additionalPhone') || 'Additional Phone') : ''"
              class="flex-1"
              :help="phone && !isPhoneValid(phone) ? (t('common.contacts.invalidPhone') || 'Invalid phone format') : ''"
              :error="phone && !isPhoneValid(phone)"
            >
              <UInput
                v-model="phones[index + 1]"
                type="tel"
                :placeholder="t('common.contacts.enterPhone') || '+7 700 123 45 67'"
                size="lg"
              />
            </UFormGroup>
            <UButton
              icon="i-heroicons-trash"
              color="red"
              variant="ghost"
              size="lg"
              @click="removePhone(index + 1)"
              :style="{ marginTop: index === 0 ? '28px' : '0' }"
            />
          </div>

          <!-- Add Phone Button -->
          <UButton
            icon="i-heroicons-plus"
            variant="outline"
            size="sm"
            @click="addPhone"
            class="w-full"
          >
            {{ t('common.contacts.addPhone') || '+ Add phone' }}
          </UButton>

          <!-- Primary Email -->
          <UFormGroup 
            :label="t('common.contacts.primaryEmail') || 'Primary Email'"
            :help="emails[0] && !isEmailValid(emails[0]) ? (t('common.contacts.invalidEmail') || 'Invalid email format') : ''"
            :error="emails[0] && !isEmailValid(emails[0])"
          >
            <UInput
              v-model="emails[0]"
              type="email"
              :placeholder="t('common.contacts.enterEmail') || 'email@example.com'"
              size="lg"
            />
          </UFormGroup>

          <!-- Additional Emails -->
          <div v-for="(email, index) in emails.slice(1)" :key="'email-' + index" class="flex gap-2">
            <UFormGroup 
              :label="index === 0 ? (t('common.contacts.additionalEmail') || 'Additional Email') : ''"
              class="flex-1"
              :help="email && !isEmailValid(email) ? (t('common.contacts.invalidEmail') || 'Invalid email format') : ''"
              :error="email && !isEmailValid(email)"
            >
              <UInput
                v-model="emails[index + 1]"
                type="email"
                :placeholder="t('common.contacts.enterEmail') || 'email@example.com'"
                size="lg"
              />
            </UFormGroup>
            <UButton
              icon="i-heroicons-trash"
              color="red"
              variant="ghost"
              size="lg"
              @click="removeEmail(index + 1)"
              :style="{ marginTop: index === 0 ? '28px' : '0' }"
            />
          </div>

          <!-- Add Email Button -->
          <UButton
            icon="i-heroicons-plus"
            variant="outline"
            size="sm"
            @click="addEmail"
            class="w-full"
          >
            {{ t('common.contacts.addEmail') || '+ Add email' }}
          </UButton>
        </div>

        <!-- Individual Personal Information -->
        <div v-if="clientType === 'INDIVIDUAL'" class="space-y-4">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
            👤 {{ t('common.contacts.personalInformation') || 'Personal Information' }}
          </h3>
          
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <UFormGroup :label="t('common.contacts.lastName') + ' *'">
              <UInput
                v-model="individualForm.lastName"
                type="text"
                :placeholder="t('common.contacts.lastName')"
                size="lg"
              />
            </UFormGroup>

            <UFormGroup :label="t('common.contacts.firstName') + ' *'">
              <UInput
                v-model="individualForm.firstName"
                type="text"
                :placeholder="t('common.contacts.firstName')"
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
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <UFormGroup :label="t('common.contacts.birthDate')">
              <UInput
                v-model="individualForm.birthDate"
                type="date"
                size="lg"
              />
            </UFormGroup>

            <UFormGroup :label="t('common.contacts.gender')">
              <USelect
                v-model="individualForm.gender"
                :options="[
                  { value: '', label: '—' },
                  { value: 'M', label: t('common.contacts.male') },
                  { value: 'F', label: t('common.contacts.female') },
                ]"
                size="lg"
              />
            </UFormGroup>
          </div>
        </div>

        <!-- Legal Entity Company Information -->
        <div v-if="clientType === 'LEGAL'" class="space-y-4">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
            🏢 {{ t('common.contacts.companyInformation') || 'Company Information' }}
          </h3>
          
          <div class="grid grid-cols-1 gap-4">
            <UFormGroup :label="t('common.contacts.legalName') + ' *'">
              <UInput
                v-model="legalEntityForm.legalName"
                type="text"
                :placeholder="t('common.contacts.legalName')"
                size="lg"
              />
            </UFormGroup>

            <UFormGroup :label="t('common.contacts.brandName')">
              <UInput
                v-model="legalEntityForm.brandName"
                type="text"
                :placeholder="t('common.contacts.brandName')"
                size="lg"
              />
            </UFormGroup>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <UFormGroup :label="t('common.contacts.binIin')">
                <UInput
                  v-model="legalEntityForm.binIin"
                  type="text"
                  :placeholder="t('common.contacts.binIin')"
                  size="lg"
                  maxlength="12"
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
            </div>

            <UFormGroup :label="t('common.contacts.registrationDate')">
              <UInput
                v-model="legalEntityForm.registrationDate"
                type="date"
                size="lg"
              />
            </UFormGroup>
          </div>
        </div>

        <!-- Client Status -->
        <div>
          <h3 class="text-sm font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2 mb-4">
            ⚡ {{ t('common.contacts.clientStatus') || 'Client Status' }}
          </h3>
          <UFormGroup :label="t('common.contacts.status')">
            <USelect
              v-model="clientStatus"
              :options="statusOptions"
              size="lg"
            />
          </UFormGroup>
        </div>
      </div>

      <template #footer>
        <div class="flex justify-between items-center">
          <p class="text-xs text-gray-500 dark:text-gray-400">
            * = {{ t('common.contacts.required') || 'Required' }}
          </p>
          <div class="flex gap-3">
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
        </div>
      </template>
    </UCard>
  </UModal>
</template>
