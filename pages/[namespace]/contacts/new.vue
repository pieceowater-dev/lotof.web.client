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
const clientTypeOptions = [
  {
    value: 'INDIVIDUAL' as const,
    labelKey: 'common.contacts.individual',
    shortKey: 'common.contacts.individualShort',
    icon: 'i-heroicons-user',
  },
  {
    value: 'LEGAL' as const,
    labelKey: 'common.contacts.legalEntity',
    shortKey: 'common.contacts.legalEntityShort',
    icon: 'i-heroicons-building-office-2',
  },
];
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

// Individual form - separate name fields
const individualFirstName = ref('');
const individualLastName = ref('');
const individualMiddleName = ref('');
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

function sanitizePhoneInput(value: string): string {
  return value.replace(/[^\d+()\s-]/g, '');
}

function updatePhoneValue(index: number, value: string) {
  phones.value[index] = sanitizePhoneInput(value);
}

function updateWhatsappValue(value: string) {
  whatsapp.value = sanitizePhoneInput(value);
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
watch([phones, emails, telegram, whatsapp, website, comments, individualFirstName, individualLastName, individualMiddleName, individualBirthDate, individualGender, clientType, legalEntityForm], () => {
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
  
  // Validate all entered phones (max 5)
  const validPhones = phones.value.filter(p => p.trim()).length;
  if (validPhones > 5) return false;
  for (const phone of phones.value) {
    if (phone.trim() && !isPhoneValid(phone)) return false;
  }
  
  // Validate all entered emails (max 5)
  const validEmails = emails.value.filter(e => e.trim()).length;
  if (validEmails > 5) return false;
  for (const email of emails.value) {
    if (email.trim() && !isEmailValid(email)) return false;
  }
  
  if (clientType.value === 'INDIVIDUAL') {
    return individualFirstName.value.trim().length > 0 && individualLastName.value.trim().length > 0;
  } else {
    return legalEntityForm.value.legalName.trim().length > 0;
  }
});

function addPhone() {
  if (phones.value.length >= 5) return;
  phones.value.push('');
  nextTick(() => {
    const inputs = document.querySelectorAll('input[data-phone-input]');
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
  if (emails.value.length >= 5) return;
  emails.value.push('');
  nextTick(() => {
    const inputs = document.querySelectorAll('input[data-email-input]');
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
  if (!token.value || !selectedNS.value || !isFormValid.value) {
    // Scroll to first error
    const form = document.querySelector('form');
    if (form) {
      const errorElement = form.querySelector('[class*="error"]') || form.querySelector('input:invalid');
      if (errorElement) {
        errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
    return;
  }

  try {
    loading.value = true;

    let clientId: string;

    // Create client - always with ACTIVE status
    if (clientType.value === 'INDIVIDUAL') {
      const input: CreateIndividualClientInput = {
        individual: {
          firstName: individualFirstName.value.trim(),
          lastName: individualLastName.value.trim(),
          middleName: individualMiddleName.value.trim() || undefined,
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
      // Create phone identities (max 5)
      const validPhonesToCreate = phones.value.filter(p => p.trim() && isPhoneValid(p)).slice(0, 5);
      for (let i = 0; i < validPhonesToCreate.length; i++) {
        const phone = validPhonesToCreate[i].trim();
        await createIdentity(contactsToken, clientId, 'phone', phone.replace(/\D/g, ''), i === 0);
      }

      // Create email identities (max 5)
      const validEmailsToCreate = emails.value.filter(e => e.trim() && isEmailValid(e)).slice(0, 5);
      for (let i = 0; i < validEmailsToCreate.length; i++) {
        const email = validEmailsToCreate[i].trim();
        await createIdentity(contactsToken, clientId, 'email', email, i === 0);
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

// Auto-format BIN input (works across all browsers including Safari)
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
              <label
                v-for="option in clientTypeOptions"
                :key="option.value"
                class="relative flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-3 text-sm transition focus-within:ring-2 focus-within:ring-blue-500"
                :class="clientType === option.value
                  ? 'border-blue-500 bg-blue-50/70 text-gray-900 dark:border-blue-400 dark:bg-blue-950/40 dark:text-white'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:border-blue-700'"
              >
                <input
                  v-model="clientType"
                  type="radio"
                  class="peer sr-only"
                  :value="option.value"
                />
                <span class="flex h-5 w-5 items-center justify-center rounded-full border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-900">
                  <span class="h-2.5 w-2.5 rounded-full bg-blue-600 opacity-0 peer-checked:opacity-100"></span>
                </span>
                <span class="flex-1 font-medium">
                  <span class="hidden sm:inline">{{ t(option.labelKey) }}</span>
                  <span class="sm:hidden">{{ t(option.shortKey) }}</span>
                </span>
                <UIcon
                  :name="option.icon"
                  class="w-4 h-4 text-gray-400 peer-checked:text-blue-600"
                />
              </label>
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
                :help="!hasValidPrimaryPhone && phones[0] ? (t('common.contacts.invalidPhone')) : ''"
                :error="!!(!hasValidPrimaryPhone && phones[0])"
              >
                <UInput
                  ref="phoneInputRef"
                  :model-value="phones[0]"
                  @update:model-value="value => updatePhoneValue(0, value)"
                  type="tel"
                  inputmode="tel"
                  pattern="[0-9+()\s-]*"
                  :placeholder="t('common.contacts.enterPhone')"
                  size="md"
                  autofocus
                  data-phone-input
                />
              </UFormGroup>
            </div>

            <!-- Additional Phones -->
            <div v-for="(phone, idx) in phones.slice(1)" :key="'phone-' + idx" class="space-y-1">
              <div class="flex gap-2">
                <div class="flex-1">
                  <UFormGroup 
                    :label="idx === 0 ? t('common.contacts.additionalPhone') : ''"
                    :help="phone && !isPhoneValid(phone) ? (t('common.contacts.invalidPhone')) : ''"
                    :error="!!(phone && !isPhoneValid(phone))"
                  >
                    <UInput
                      :model-value="phones[idx + 1]"
                      @update:model-value="value => updatePhoneValue(idx + 1, value)"
                      type="tel"
                      inputmode="tel"
                      pattern="[0-9+()\s-]*"
                      :placeholder="t('common.contacts.enterPhone')"
                      size="md"
                      data-phone-input
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
              :disabled="phones.length >= 5"
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
              :label="t('common.contacts.firstName') + ' *'"
            >
              <UInput
                v-model="individualFirstName"
                type="text"
                :placeholder="t('common.contacts.firstNamePlaceholder')"
                size="md"
              />
            </UFormGroup>

            <UFormGroup 
              :label="t('common.contacts.lastName') + ' *'"
            >
              <UInput
                v-model="individualLastName"
                type="text"
                :placeholder="t('common.contacts.lastNamePlaceholder')"
                size="md"
              />
            </UFormGroup>

            <UFormGroup 
              :label="t('common.contacts.middleName')"
            >
              <UInput
                v-model="individualMiddleName"
                type="text"
                :placeholder="t('common.contacts.middleNamePlaceholder')"
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
                :placeholder="t('common.contacts.legalNamePlaceholder')"
                size="md"
              />
            </UFormGroup>

            <UFormGroup :label="t('common.contacts.brandName')">
              <UInput
                v-model="legalEntityForm.brandName"
                type="text"
                :placeholder="t('common.contacts.brandNamePlaceholder')"
                size="md"
              />
            </UFormGroup>

            <UFormGroup :label="t('common.contacts.binIin')">
              <UInput
                v-model="legalEntityForm.binIin"
                type="text"
                :placeholder="t('common.contacts.binIinPlaceholder')"
                size="md"
              />
            </UFormGroup>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <UFormGroup :label="t('common.contacts.registrationCountry')">
                <UInput
                  v-model="legalEntityForm.registrationCountry"
                  type="text"
                  :placeholder="t('common.contacts.registrationCountryPlaceholder')"
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
            <!-- Additional Information Accordion -->
            <UAccordion
              :items="[
                {
                  slot: 'additional',
                  label: t('common.contacts.additionalInformation'),
                  icon: 'i-heroicons-envelope',
                  defaultOpen: false
                }
              ]"
              :ui="{ 
                base: 'divide-y divide-gray-200 dark:divide-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg',
                item: { base: '' },
                button: { 
                  base: 'flex w-full items-center justify-between gap-1.5',
                  padding: 'px-4 py-3'
                }
              }"
            >
              <template #additional>
                <div class="space-y-4 px-4 pb-3">
                  <!-- Emails -->
                  <div class="space-y-2">
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      {{ t('common.contacts.email') }}
                    </label>
                    
                    <div v-for="(email, index) in emails" :key="'email-' + index" class="flex gap-2">
                      <UFormGroup 
                        class="flex-1"
                        :help="email && !isEmailValid(email) ? t('common.contacts.invalidEmail') : ''"
                        :error="!!(email && !isEmailValid(email))"
                      >
                        <UInput
                          v-model="emails[index]"
                          type="email"
                          :placeholder="t('common.contacts.enterEmail')"
                          size="md"
                          data-email-input
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
                      :disabled="emails.length >= 5"
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
                      :placeholder="t('common.contacts.telegramPlaceholder')"
                      size="md"
                    />
                  </UFormGroup>

                  <!-- WhatsApp -->
                  <UFormGroup :label="t('common.contacts.whatsapp')">
                    <UInput
                      :model-value="whatsapp"
                      @update:model-value="updateWhatsappValue"
                      type="tel"
                      inputmode="tel"
                      pattern="[0-9+()\s-]*"
                      :placeholder="t('common.contacts.enterPhone')"
                      size="md"
                    />
                  </UFormGroup>

                  <!-- Website -->
                  <UFormGroup :label="t('common.contacts.website')">
                    <UInput
                      v-model="website"
                      type="url"
                      :placeholder="t('common.contacts.websitePlaceholder')"
                      size="md"
                    />
                  </UFormGroup>

                  <!-- Comments -->
                  <UFormGroup :label="t('common.contacts.comments')">
                    <UTextarea
                      v-model="comments"
                      :placeholder="t('common.contacts.commentsPlaceholder')"
                      size="md"
                    />
                  </UFormGroup>

                  <!-- Birth Date & Gender (for individuals) -->
                  <div v-if="clientType === 'INDIVIDUAL'" class="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-gray-200 dark:border-gray-700">
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
                          { value: '', label: t('common.contacts.genderUnknown') },
                          { value: 'M', label: t('common.contacts.male') },
                          { value: 'F', label: t('common.contacts.female') },
                        ]"
                        size="md"
                      />
                    </UFormGroup>
                  </div>
                </div>
              </template>
            </UAccordion>
          </div>
        </form>
      </div>

      <!-- Action Buttons -->
      <div class="mt-6 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
        <p class="text-xs text-gray-500 dark:text-gray-500">
          * = {{ t('common.contacts.required') }}
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
