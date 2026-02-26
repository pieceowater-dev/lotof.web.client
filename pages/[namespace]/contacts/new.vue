<script setup lang="ts">
import { ref, computed, nextTick, onBeforeUnmount, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useRouter, useRoute } from 'vue-router';
import { logError } from '@/utils/logger';
import {
  contactsCreateIndividualClient,
  contactsCreateLegalEntityClient,
  type CreateIndividualClientInput,
  type CreateLegalEntityClientInput,
} from '@/api/contacts/mutations';
import { createIdentity } from '@/api/contacts/identities';
import { useContactsToken } from '@/composables/useContactsToken';
import { useNamespace } from '@/composables/useNamespace';

const router = useRouter();
const route = useRoute();
const { t } = useI18n();
const toast = useToast();
const { token } = useAuth();
const { selected: selectedNS, titleBySlug } = useNamespace();

const nsSlug = computed(() => route.params.namespace as string);

const clientType = ref<'INDIVIDUAL' | 'LEGAL'>('INDIVIDUAL');
const loading = ref(false);
const hasChanges = ref(false);
const showConfirmDialog = ref(false);

// Phone input ref for autofocus
const phoneInputRef = ref<any>(null);

// Contact information (most important for call center)
const phones = ref<string[]>(['']);
const emails = ref<string[]>(['']);
const telegram = ref('');
const whatsapp = ref('');
const website = ref('');
const comments = ref('');

// Individual form - single full name field
const individualFullName = ref('');
const individualBirthDate = ref('');
const individualGender = ref('');

// Legal entity form
const legalEntityForm = ref({
  legalName: '',
  brandName: '',
  binIin: '',
  registrationCountry: '',
  registrationDate: '',
});

// Phone mask: Accepts any format (+7(777)777-77-77, 777 777 777 77 77, etc) and normalizes to XXX XXX XXX XX XX
function formatPhoneInput(value: string): string {
  // Extract only digits
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  
  // Limit to 12 digits (covers international formats)
  const limited = digits.slice(0, 12);
  
  // Format: XXX XXX XXX XX XX (groups of 3-3-3-2-2)
  const parts: string[] = [];
  if (limited.length > 0) parts.push(limited.slice(0, 3));
  if (limited.length > 3) parts.push(limited.slice(3, 6));
  if (limited.length > 6) parts.push(limited.slice(6, 9));
  if (limited.length > 9) parts.push(limited.slice(9, 11));
  if (limited.length > 11) parts.push(limited.slice(11, 13));
  
  return parts.join(' ');
}

// BIN/IIN mask: XXX XXX XXX XX
function formatBinInput(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  
  const limited = digits.slice(0, 12);
  
  // Format in groups: 3-3-3-2
  if (limited.length <= 3) return limited;
  if (limited.length <= 6) return `${limited.slice(0, 3)} ${limited.slice(3)}`;
  if (limited.length <= 9) return `${limited.slice(0, 3)} ${limited.slice(3, 6)} ${limited.slice(6)}`;
  return `${limited.slice(0, 3)} ${limited.slice(3, 6)} ${limited.slice(6, 9)} ${limited.slice(9)}`;
}

// Track changes for unsaved warning
watch([phones, emails, telegram, whatsapp, website, comments, individualFullName, individualBirthDate, individualGender, clientType, legalEntityForm], () => {
  hasChanges.value = true;
}, { deep: true });

// Validation
const isPhoneValid = (phone: string) => {
  if (!phone) return true;
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 12;
};

const isEmailValid = (email: string) => {
  if (!email) return true;
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
    return individualFullName.value.trim().length > 0;
  } else {
    return legalEntityForm.value.legalName.trim().length > 0;
  }
});

function addPhone() {
  phones.value.push('');
  nextTick(() => {
    const inputs = document.querySelectorAll('input[type="tel"]');
    const lastInput = inputs[inputs.length - 1];
    if (lastInput) (lastInput as HTMLInputElement).focus();
  });
}

function removePhone(index: number) {
  if (phones.value.length > 1) {
    phones.value.splice(index, 1);
  }
}

function addEmail() {
  emails.value.push('');
  nextTick(() => {
    const inputs = document.querySelectorAll('input[type="email"]');
    const lastInput = inputs[inputs.length - 1];
    if (lastInput) (lastInput as HTMLInputElement).focus();
  });
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

    // Create client - always with ACTIVE status
    if (clientType.value === 'INDIVIDUAL') {
      // Parse full name
      const nameParts = individualFullName.value.trim().split(/\s+/);
      const firstName = nameParts[0] || '';
      const lastName = nameParts[1] || '';
      const middleName = nameParts.slice(2).join(' ') || undefined;

      const input: CreateIndividualClientInput = {
        individual: {
          firstName,
          lastName,
          middleName: middleName || undefined,
          birthDate: individualBirthDate.value || undefined,
          gender: individualGender.value || undefined,
        },
        status: 'ACTIVE',
      };
      const result = await contactsCreateIndividualClient(token.value, selectedNS.value, input);
      clientId = result.client.id;
    } else {
      const input: CreateLegalEntityClientInput = {
        legalEntity: {
          legalName: legalEntityForm.value.legalName,
          brandName: legalEntityForm.value.brandName || undefined,
          binIin: legalEntityForm.value.binIin?.replace(/\s/g, '') || undefined,
          registrationCountry: legalEntityForm.value.registrationCountry || undefined,
          registrationDate: legalEntityForm.value.registrationDate || undefined,
        },
        status: 'ACTIVE',
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
          await createIdentity(contactsToken, clientId, 'phone', phone.replace(/\D/g, ''), i === 0);
        }
      }

      // Create email identities
      for (let i = 0; i < emails.value.length; i++) {
        const email = emails.value[i].trim();
        if (email && isEmailValid(email)) {
          await createIdentity(contactsToken, clientId, 'email', email, i === 0);
        }
      }

      // Create other identities
      if (telegram.value.trim()) {
        await createIdentity(contactsToken, clientId, 'telegram', telegram.value.trim());
      }
      if (whatsapp.value.trim()) {
        await createIdentity(contactsToken, clientId, 'whatsapp', whatsapp.value.trim());
      }
      if (website.value.trim()) {
        await createIdentity(contactsToken, clientId, 'website', website.value.trim());
      }
    }

    hasChanges.value = false;
    toast.add({
      title: t('common.success'),
      description: t('common.contacts.clientCreated'),
      color: 'green',
    });

    // Redirect to contacts list
    await router.push(`/${nsSlug.value}/contacts/all/1-20`);
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

function handleBack() {
  if (hasChanges.value) {
    showConfirmDialog.value = true;
  } else {
    router.back();
  }
}

function confirmLeave() {
  showConfirmDialog.value = false;
  hasChanges.value = false;
  router.back();
}

function cancelLeave() {
  showConfirmDialog.value = false;
}

// Auto-format phones, whatsapp, and BIN inputs (works across all browsers including Safari)
watch(phones, (newVal) => {
  newVal.forEach((phone, idx) => {
    if (phone && phone !== formatPhoneInput(phone)) {
      newVal[idx] = formatPhoneInput(phone);
    }
  });
}, { deep: true });

watch(() => whatsapp.value, (newVal) => {
  if (newVal && newVal !== formatPhoneInput(newVal)) {
    whatsapp.value = formatPhoneInput(newVal);
  }
});

watch(() => legalEntityForm.value.binIin, (newVal) => {
  if (newVal && newVal !== formatBinInput(newVal)) {
    legalEntityForm.value.binIin = formatBinInput(newVal);
  }
});

// Warn on page unload if there are unsaved changes
onBeforeUnmount(() => {
  if (hasChanges.value) {
    window.addEventListener('beforeunload', preventUnload);
    return () => {
      window.removeEventListener('beforeunload', preventUnload);
    };
  }
});

function preventUnload(e: BeforeUnloadEvent) {
  e.preventDefault();
  e.returnValue = '';
}

// Auto-focus on phone input when page loads
nextTick(() => {
  if (phoneInputRef.value) {
    phoneInputRef.value.$el?.querySelector('input')?.focus();
  }
});

const nsTitle = computed(() => titleBySlug(nsSlug.value) || nsSlug.value || '');
const pageTitle = computed(() => {
  return nsTitle.value ? `${t('common.contacts.createClient')} — ${nsTitle.value}` : t('common.contacts.createClient');
});

useHead(() => ({
  title: pageTitle.value,
}));
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <!-- Header -->
    <div class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">
              {{ t('common.contacts.createClient') }}
            </h1>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {{ nsTitle }} • {{ clientType === 'INDIVIDUAL' ? t('common.contacts.individual') : t('common.contacts.legalEntity') }}
            </p>
          </div>
          <UButton
            icon="i-heroicons-arrow-left"
            size="xs"
            color="primary"
            variant="soft"
            @click="handleBack"
            class="min-w-fit gap-2"
          >
            <span class="hidden sm:inline">{{ t('app.back') }}</span>
          </UButton>
        </div>
      </div>
    </div>

    <!-- Content -->
    <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
        <form class="space-y-6 p-6">
          <!-- 0. Client Type Selection -->
          <div class="space-y-3">
            <label class="block text-base font-semibold text-gray-900 dark:text-white">
              {{ t('common.contacts.clientType') }}
            </label>
            <div class="grid grid-cols-2 gap-3">
              <UButton
                v-for="type in ['INDIVIDUAL', 'LEGAL']"
                :key="type"
                @click="clientType = type as any"
                :variant="clientType === type ? 'solid' : 'outline'"
                :color="clientType === type ? 'blue' : 'gray'"
                size="sm"
                :icon="clientType === type ? 'i-heroicons-check-circle' : ''"
              >
                {{ type === 'INDIVIDUAL' ? t('common.contacts.individual') : t('common.contacts.legalEntity') }}
              </UButton>
            </div>
          </div>

          <UDivider class="my-4" />

          <!-- 1. Phones Section -->
          <div class="space-y-3">
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-phone" class="w-4 h-4 text-blue-600" />
              <h2 class="text-base font-semibold text-gray-900 dark:text-white">
                {{ t('common.contacts.contactInformation') }}
              </h2>
            </div>
            
            <!-- Primary Phone -->
            <div>
              <UFormGroup 
                :label="t('common.contacts.primaryPhone') + ' *'"
                :description="t('common.contacts.required')"
                :help="!hasValidPrimaryPhone && phones[0] ? (t('common.contacts.invalidPhone')) : t('common.contacts.phoneFormatHelp')"
                :error="!hasValidPrimaryPhone && phones[0]"
              >
                <UInput
                  ref="phoneInputRef"
                  v-model="phones[0]"
                  type="tel"
                  placeholder="777 777 777 77 77"
                  size="md"
                  autofocus
                />
              </UFormGroup>
            </div>

            <!-- Additional Phones -->
            <div v-for="(phone, idx) in phones.slice(1)" :key="'phone-' + idx" class="space-y-1">
              <div class="flex gap-2">
                <div class="flex-1">
                  <UFormGroup 
                    :label="idx === 0 ? (t('common.contacts.additionalPhone') || 'Additional Phone') : ''"
                    :help="phone && !isPhoneValid(phone) ? (t('common.contacts.invalidPhone')) : (idx === 0 ? t('common.contacts.phoneFormatHelp') : '')"
                    :error="phone && !isPhoneValid(phone)"
                  >
                    <UInput
                      v-model="phones[idx + 1]"
                      type="tel"
                      placeholder="777 777 777 77 77"
                      size="md"
                    />
                  </UFormGroup>
                </div>
                <UButton
                  icon="i-heroicons-trash-20-solid"
                  color="red"
                  variant="ghost"
                  size="sm"
                  @click="removePhone(idx + 1)"
                  :style="{ marginTop: idx === 0 ? '24px' : '0' }"
                />
              </div>
            </div>

            <!-- Add Phone Button -->
            <UButton
              icon="i-heroicons-plus-20-solid"
              variant="outline"
              color="blue"
              size="sm"
              @click="addPhone"
            >
              {{ t('common.contacts.addPhone') }}
            </UButton>
          </div>

          <UDivider class="my-4" />

          <!-- 2. Name Section -->
          <div v-if="clientType === 'INDIVIDUAL'" class="space-y-3">
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-user" class="w-4 h-4 text-blue-600" />
              <h2 class="text-base font-semibold text-gray-900 dark:text-white">
                {{ t('common.contacts.personalInformation') }}
              </h2>
            </div>
            
            <UFormGroup 
              :label="t('common.contacts.name')"
              description=" * "
              help="Last Name First Name Patronymic"
            >
              <UInput
                v-model="individualFullName"
                type="text"
                placeholder="Иванов Иван Иванович"
                size="md"
              />
            </UFormGroup>
          </div>

          <div v-if="clientType === 'LEGAL'" class="space-y-3">
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-building-office-2" class="w-4 h-4 text-blue-600" />
              <h2 class="text-base font-semibold text-gray-900 dark:text-white">
                {{ t('common.contacts.companyInformation') }}
              </h2>
            </div>
            
            <UFormGroup :label="t('common.contacts.legalName') + ' *'">
              <UInput
                v-model="legalEntityForm.legalName"
                type="text"
                :placeholder="t('common.contacts.legalName')"
                size="md"
              />
            </UFormGroup>

            <UFormGroup :label="t('common.contacts.brandName')">
              <UInput
                v-model="legalEntityForm.brandName"
                type="text"
                :placeholder="t('common.contacts.brandName')"
                size="md"
              />
            </UFormGroup>

            <UFormGroup :label="t('common.contacts.binIin')">
              <UInput
                v-model="legalEntityForm.binIin"
                type="text"
                :placeholder="t('common.contacts.binIin')"
                size="md"
              />
            </UFormGroup>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <UFormGroup :label="t('common.contacts.registrationCountry')">
                <UInput
                  v-model="legalEntityForm.registrationCountry"
                  type="text"
                  :placeholder="t('common.contacts.registrationCountry')"
                  size="md"
                />
              </UFormGroup>

              <UFormGroup :label="t('common.contacts.registrationDate')">
                <UInput
                  v-model="legalEntityForm.registrationDate"
                  type="date"
                  size="md"
                />
              </UFormGroup>
            </div>
          </div>

          <UDivider class="my-4" />

          <!-- 3. Additional Contacts and Info -->
          <div class="space-y-3">
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-envelope" class="w-4 h-4 text-blue-600" />
              <h2 class="text-base font-semibold text-gray-900 dark:text-white">
                {{ t('common.contacts.additionalInformation') }}
              </h2>
            </div>

            <!-- Emails -->
            <div class="space-y-2">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {{ t('common.contacts.email') }}
              </label>
              
              <div v-for="(email, index) in emails" :key="'email-' + index" class="flex gap-2">>
                <UFormGroup 
                  class="flex-1"
                  :help="email && !isEmailValid(email) ? (t('common.contacts.invalidEmail') || 'Invalid email format') : ''"
                  :error="email && !isEmailValid(email)"
                >
                  <UInput
                    v-model="emails[index]"
                    type="email"
                    placeholder="email@example.com"
                    size="md"
                  />
                </UFormGroup>
                <UButton
                  v-if="emails.length > 1"
                  icon="i-heroicons-trash-20-solid"
                  color="red"
                  variant="ghost"
                  size="sm"
                  @click="removeEmail(index)"
                  style="margin-top: 24px"
                />
              </div>

              <UButton
                icon="i-heroicons-plus-20-solid"
                variant="outline"
                color="blue"
                size="sm"
                @click="addEmail"
              >
                {{ t('common.contacts.addEmail') }}
              </UButton>
            </div>

            <!-- Telegram -->
            <UFormGroup :label="t('common.contacts.telegram')">
              <UInput
                v-model="telegram"
                type="text"
                placeholder="@username"
                size="md"
              />
            </UFormGroup>

            <!-- WhatsApp -->
            <UFormGroup 
              :label="t('common.contacts.whatsapp')"
              :help="t('common.contacts.phoneFormatHelp')"
            >
              <UInput
                v-model="whatsapp"
                type="tel"
                placeholder="777 777 777 77 77"
                size="md"
              />
            </UFormGroup>

            <!-- Website -->
            <UFormGroup :label="t('common.contacts.website')">
              <UInput
                v-model="website"
                type="url"
                placeholder="https://example.com"
                size="md"
              />
            </UFormGroup>

            <!-- Comments -->
            <UFormGroup :label="t('common.contacts.comments')">
              <UTextarea
                v-model="comments"
                :placeholder="t('app.comment') || 'Any additional notes...'"
                :rows="3"
              />
            </UFormGroup>

            <!-- Birth Date & Gender (for individuals) -->
            <div v-if="clientType === 'INDIVIDUAL'" class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <UFormGroup :label="t('common.contacts.birthDate')">
                <UInput
                  v-model="individualBirthDate"
                  type="date"
                  size="md"
                />
              </UFormGroup>

              <UFormGroup :label="t('common.contacts.gender')">
                <USelect
                  v-model="individualGender"
                  :options="[
                    { value: '', label: '—' },
                    { value: 'M', label: t('common.contacts.male') },
                    { value: 'F', label: t('common.contacts.female') },
                  ]"
                  size="md"
                />
              </UFormGroup>
            </div>
          </div>
        </form>
      </div>

      <!-- Action Buttons -->
      <div class="mt-6 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
        <p class="text-xs text-gray-500 dark:text-gray-500">
          * = {{ t('common.contacts.required') || 'Required' }}
        </p>
        <div class="flex gap-2">
          <UButton
            color="gray"
            variant="outline"
            size="sm"
            :label="t('app.cancel')"
            @click="handleBack"
          />
          <UButton
            color="blue"
            size="md"
            :loading="loading"
            :disabled="!isFormValid || loading"
            @click="handleSubmit"
            icon="i-heroicons-check-circle"
          >
            {{ loading ? t('app.loading') : t('app.create') }}
          </UButton>
        </div>
      </div>
    </div>

    <!-- Unsaved Changes Confirmation Dialog -->
    <UModal
      v-model="showConfirmDialog"
      :ui="{ width: 'sm' }"
    >
      <UCard :ui="{ ring: '' }">
        <template #header>
          <div class="flex items-center gap-3">
            <UIcon name="i-heroicons-exclamation-triangle" class="w-6 h-6 text-amber-500" />
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
              {{ t('common.contacts.confirmLeave') }}
            </h3>
          </div>
        </template>

        <div class="text-gray-600 dark:text-gray-300">
          {{ t('common.contacts.unsavedChanges') }}
        </div>

        <template #footer>
          <div class="flex gap-3 justify-end">
            <UButton
              color="gray"
              variant="outline"
              :label="t('common.contacts.keepEditing')"
              @click="cancelLeave"
            />
            <UButton
              color="red"
              :label="t('common.contacts.discardChanges')"
              @click="confirmLeave"
            />
          </div>
        </template>
      </UCard>
    </UModal>
  </div>
</template>
