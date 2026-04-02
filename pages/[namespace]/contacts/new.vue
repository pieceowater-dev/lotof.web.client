<script setup lang="ts">
import { ref, computed, nextTick, onBeforeUnmount, onMounted, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useRouter, useRoute } from 'vue-router';
import { logError } from '@/utils/logger';
import {
  contactsCreateIndividualClient,
  contactsCreateLegalEntityClient,
  type CreateIndividualClientInput,
  type CreateLegalEntityClientInput,
} from '@/api/contacts/mutations';
import { contactsListClients, type ClientRow } from '@/api/contacts/listClients';
import { createIdentity } from '@/api/contacts/identities';
import {
  listDynamicFields,
  setDynamicFieldValue,
  type DynamicField,
} from '@/api/contacts/dynamicFields';
import { useContactsToken } from '@/composables/useContactsToken';
import { useNamespace } from '@/composables/useNamespace';
import { formatDisplayPhoneUniversal } from '@/utils/phone';
import DynamicFieldInput from '@/components/contacts/DynamicFieldInput.vue';

const router = useRouter();
const route = useRoute();
const { t } = useI18n();
const toast = useToast();
const { token } = useAuth();
const { selected: selectedNS, titleBySlug } = useNamespace();

const nsSlug = computed(() => route.params.namespace as string);
const CLIENT_TYPE_STORAGE_KEY = 'contacts.new.clientType';

const clientType = ref<'INDIVIDUAL' | 'LEGAL'>('INDIVIDUAL');
const clientTypeOptions = [
  {
    value: 'INDIVIDUAL' as const,
    labelKey: 'contacts.individual',
    shortKey: 'contacts.individualShort',
    icon: 'i-heroicons-user',
  },
  {
    value: 'LEGAL' as const,
    labelKey: 'contacts.legalEntity',
    shortKey: 'contacts.legalEntityShort',
    icon: 'i-heroicons-building-office-2',
  },
];
const loading = ref(false);
const hasChanges = ref(false);
const showConfirmDialog = ref(false);
const dynamicFieldsLoading = ref(false);
const dynamicFieldsError = ref<string | null>(null);
const rawDynamicFields = ref<DynamicField[]>([]);
const dynamicFieldDrafts = ref<Record<string, string | number | boolean | string[]>>({});

function tr(path: string, fallback: string): string {
  const value = t(path);
  return value === path ? fallback : value;
}

// Phone input ref for autofocus
const phoneInputRef = ref<any>(null);

// Contact information (most important for call center)
const phones = ref<string[]>(['']);
const emails = ref<string[]>(['']);
const telegram = ref('');
const whatsapp = ref('');
const website = ref('');
const comments = ref('');

// Link contact person (individual) to legal company
const legalCompanySearch = ref('');
const legalCompanyOptions = ref<ClientRow[]>([]);
const legalCompanyLoading = ref(false);
const selectedLegalCompany = ref<ClientRow | null>(null);
let legalCompanySearchTimeout: ReturnType<typeof setTimeout> | null = null;

// Individual form - separate name fields
const individualFirstName = ref('');
const individualLastName = ref('');
const individualMiddleName = ref('');
const individualBirthDate = ref('');
const individualGender = ref<boolean | null>(null);

// Legal entity form
const legalEntityForm = ref({
  legalName: '',
  brandName: '',
  binIin: '',
  registrationCountry: '',
  registrationDate: '',
});

// Contact person form (for legal entities)
const contactPersonForm = ref({
  firstName: '',
  lastName: '',
  middleName: '',
  birthDate: '',
  gender: null as boolean | null,
});

const legalEntityOptions = ref<ClientRow[]>([]);
const legalEntityLoading = ref(false);
const selectedExistingLegalEntity = ref<ClientRow | null>(null);
let legalEntitySearchTimeout: ReturnType<typeof setTimeout> | null = null;

function sanitizePhoneInput(value: string): string {
  return value.replace(/[^\d+()\s-]/g, '');
}

function updatePhoneValue(index: number, value: string) {
  phones.value[index] = sanitizePhoneInput(value);
}

function updateWhatsappValue(value: string) {
  whatsapp.value = sanitizePhoneInput(value);
}

function getPhonePreview(phone: string): string {
  const trimmed = phone.trim();
  if (!trimmed) return '';
  return formatDisplayPhoneUniversal(trimmed);
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
watch([phones, emails, telegram, whatsapp, website, comments, individualFirstName, individualLastName, individualMiddleName, individualBirthDate, individualGender, legalEntityForm], () => {
  hasChanges.value = true;
}, { deep: true });

watch(selectedLegalCompany, () => {
  hasChanges.value = true;
});

watch(clientType, (newType) => {
  if (process.client) {
    localStorage.setItem(CLIENT_TYPE_STORAGE_KEY, newType);
  }
  if (newType === 'LEGAL') {
    legalCompanySearch.value = '';
    legalCompanyOptions.value = [];
    selectedLegalCompany.value = null;
  } else {
    selectedExistingLegalEntity.value = null;
    legalEntityOptions.value = [];
  }
});

watch([token, selectedNS], async ([nextToken, nextNamespace]) => {
  if (!nextToken || !nextNamespace) {
    rawDynamicFields.value = [];
    dynamicFieldDrafts.value = {};
    dynamicFieldsError.value = null;
    return;
  }

  await loadDynamicFields(nextToken, nextNamespace);
});

watch(() => legalEntityForm.value.legalName, (value) => {
  if (clientType.value !== 'LEGAL') return;

  if (selectedExistingLegalEntity.value) {
    const selectedName = selectedExistingLegalEntity.value.legalEntity?.legalName || '';
    if (value.trim() !== selectedName) {
      selectedExistingLegalEntity.value = null;
    }
  }

  if (legalEntitySearchTimeout) clearTimeout(legalEntitySearchTimeout);
  legalEntitySearchTimeout = setTimeout(async () => {
    const q = value.trim();
    if (!q || q.length < 2 || selectedExistingLegalEntity.value) {
      legalEntityOptions.value = [];
      return;
    }

    if (!token.value || !selectedNS.value) return;
    try {
      legalEntityLoading.value = true;
      const { ensure } = useContactsToken();
      const contactsToken = await ensure(selectedNS.value, token.value);
      if (!contactsToken) return;

      const response = await contactsListClients(contactsToken, selectedNS.value, {
        search: q,
        pagination: {
          page: 1,
          length: 'TEN',
        },
      });

      const seen = new Set<string>();
      legalEntityOptions.value = (response.rows || [])
        .filter(item => item.client.clientType === 'LEGAL')
        .filter((item) => {
          if (seen.has(item.client.id)) return false;
          seen.add(item.client.id);
          return true;
        })
        .slice(0, 6);
    } catch (err) {
      logError('Failed to search existing legal entities:', err);
      legalEntityOptions.value = [];
    } finally {
      legalEntityLoading.value = false;
    }
  }, 250);
});

watch(legalCompanySearch, (value) => {
  if (clientType.value !== 'INDIVIDUAL') return;
  if (legalCompanySearchTimeout) clearTimeout(legalCompanySearchTimeout);

  legalCompanySearchTimeout = setTimeout(async () => {
    const q = value.trim();
    if (!q || q.length < 2) {
      legalCompanyOptions.value = [];
      return;
    }

    if (!token.value || !selectedNS.value) return;
    try {
      legalCompanyLoading.value = true;
      const { ensure } = useContactsToken();
      const contactsToken = await ensure(selectedNS.value, token.value);
      if (!contactsToken) return;

      const response = await contactsListClients(contactsToken, selectedNS.value, {
        search: q,
        pagination: {
          page: 1,
          length: 'TEN',
        },
        sort: {
          field: 'createdAt',
          by: 'DESC',
        },
      });

      legalCompanyOptions.value = (response.rows || [])
        .filter(item => item.client.clientType === 'LEGAL')
        .slice(0, 6);
    } catch (err) {
      logError('Failed to search legal companies:', err);
      legalCompanyOptions.value = [];
    } finally {
      legalCompanyLoading.value = false;
    }
  }, 250);
});

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

const dynamicFields = computed(() => {
  return rawDynamicFields.value
    .filter((field) => {
      if (field.clientTypeScope === 'ALL') return true;
      if (field.clientTypeScope === 'INDIVIDUAL') return clientType.value === 'INDIVIDUAL';
      if (field.clientTypeScope === 'LEGAL') return clientType.value === 'LEGAL';
      return true;
    })
    .slice()
    .sort((a, b) => a.viewOrder - b.viewOrder);
});

const areDynamicFieldsValid = computed(() => {
  return dynamicFields.value.every((field) => {
    if (!field.isRequired) return true;
    return hasDynamicFieldInputValue(field);
  });
});

const hasRequiredAdditionalFields = computed(() => {
  return dynamicFields.value.some((field) => field.isRequired);
});

const additionalAccordionItems = computed(() => ([
  {
    slot: 'additional',
    label: t('contacts.additionalInformation'),
    icon: 'i-heroicons-envelope',
    defaultOpen: hasRequiredAdditionalFields.value,
  },
]));

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
    return individualFirstName.value.trim().length > 0 && areDynamicFieldsValid.value;
  } else {
    return legalEntityForm.value.legalName.trim().length > 0 && areDynamicFieldsValid.value;
  }
});

function initializeDynamicFieldDrafts(fields: DynamicField[]) {
  const nextDrafts: Record<string, string | number | boolean | string[]> = { ...dynamicFieldDrafts.value };

  for (const field of fields) {
    if (nextDrafts[field.id] !== undefined) continue;
    if (field.dataType === 'BOOLEAN') {
      nextDrafts[field.id] = false;
      continue;
    }
    if (field.dataType === 'MULTI_SELECT') {
      nextDrafts[field.id] = [];
      continue;
    }
    nextDrafts[field.id] = '';
  }

  for (const fieldId of Object.keys(nextDrafts)) {
    if (!fields.some((field) => field.id === fieldId)) {
      delete nextDrafts[fieldId];
    }
  }

  dynamicFieldDrafts.value = nextDrafts;
}

function isDynamicFieldsEmptyStateError(error: unknown): boolean {
  const message = String((error as any)?.message || error || '').toLowerCase();
  const mentionsDynamicField = message.includes('dynamic field') || message.includes('dynamicfield');
  return (message.includes('not found') && mentionsDynamicField)
    || (message.includes('no rows') && mentionsDynamicField)
    || (message.includes('no data') && mentionsDynamicField)
    || message.includes('no dynamic fields')
    || message.includes('no dynamic field values');
}

async function loadDynamicFields(appToken: string, namespace: string) {
  dynamicFieldsLoading.value = true;
  dynamicFieldsError.value = null;

  try {
    const { ensure } = useContactsToken();
    const contactsToken = await ensure(namespace, appToken);
    if (!contactsToken) return;

    const fieldsResp = await listDynamicFields(contactsToken, namespace, { includeDeleted: false });
    rawDynamicFields.value = fieldsResp.dynamicFields?.rows || [];
    initializeDynamicFieldDrafts(rawDynamicFields.value);
  } catch (error) {
    if (isDynamicFieldsEmptyStateError(error)) {
      rawDynamicFields.value = [];
      dynamicFieldDrafts.value = {};
      dynamicFieldsError.value = null;
      return;
    }

    logError('Failed to load dynamic fields for create page:', error);
    dynamicFieldsError.value = t('common.errorDetails.loadFailed') || 'Failed to load data';
  } finally {
    dynamicFieldsLoading.value = false;
  }
}

function hasDynamicFieldInputValue(field: DynamicField): boolean {
  const rawValue = dynamicFieldDrafts.value[field.id];

  if (field.dataType === 'MULTI_SELECT') {
    return Array.isArray(rawValue) && rawValue.length > 0;
  }

  if (field.dataType === 'BOOLEAN') {
    return typeof rawValue === 'boolean';
  }

  if (field.dataType === 'NUMBER') {
    if (rawValue === '' || rawValue === null || rawValue === undefined) return false;
    return Number.isFinite(Number(rawValue));
  }

  return String(rawValue ?? '').trim().length > 0;
}

async function saveDynamicFieldValues(contactsToken: string, namespace: string, clientId: string) {
  for (const field of dynamicFields.value) {
    if (!hasDynamicFieldInputValue(field)) continue;

    const rawValue = dynamicFieldDrafts.value[field.id];
    const input: {
      fieldId: string;
      entityId: string;
      valueString?: string;
      valueNumber?: number;
      valueBool?: boolean;
      valueDate?: string;
      valueJson?: string;
    } = {
      fieldId: field.id,
      entityId: clientId,
    };

    if (field.dataType === 'NUMBER') {
      input.valueNumber = Number(rawValue);
    } else if (field.dataType === 'BOOLEAN') {
      input.valueBool = !!rawValue;
    } else if (field.dataType === 'DATE') {
      input.valueDate = String(rawValue || '');
    } else if (field.dataType === 'MULTI_SELECT') {
      input.valueJson = JSON.stringify(Array.isArray(rawValue) ? rawValue : []);
    } else {
      input.valueString = String(rawValue || '');
    }

    await setDynamicFieldValue(contactsToken, namespace, input);
  }
}

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

    // Get contacts token before creating client
    const { ensure } = useContactsToken();
    const contactsToken = await ensure(selectedNS.value, token.value);
    if (!contactsToken) {
      throw new Error('Failed to get contacts token');
    }

    let clientId: string;
    let createdContactPersonId: string | null = null;

    // Create client - always with ACTIVE status
    if (clientType.value === 'INDIVIDUAL') {
      const input: CreateIndividualClientInput = {
        individual: {
          firstName: individualFirstName.value.trim(),
          lastName: individualLastName.value.trim(),
          middleName: individualMiddleName.value.trim() || undefined,
          birthDate: individualBirthDate.value || undefined,
          gender: individualGender.value !== null ? individualGender.value : undefined,
        },
        status: 'ACTIVE',
      };
      const result = await contactsCreateIndividualClient(contactsToken, selectedNS.value, input);
      clientId = result.client.id;
    } else {
      if (selectedExistingLegalEntity.value) {
        clientId = selectedExistingLegalEntity.value.client.id;
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
        const result = await contactsCreateLegalEntityClient(contactsToken, selectedNS.value, input);
        clientId = result.client.id;

        if (contactPersonForm.value.firstName.trim()) {
          const contactInput: CreateIndividualClientInput = {
            individual: {
              firstName: contactPersonForm.value.firstName.trim(),
              lastName: contactPersonForm.value.lastName.trim(),
              middleName: contactPersonForm.value.middleName.trim() || undefined,
              birthDate: contactPersonForm.value.birthDate || undefined,
              gender: contactPersonForm.value.gender !== null ? contactPersonForm.value.gender : undefined,
            },
            status: 'ACTIVE',
          };
          const contactResult = await contactsCreateIndividualClient(contactsToken, selectedNS.value, contactInput);
          createdContactPersonId = contactResult.client.id;
        }
      }
    }

    if (contactsToken) {
      // Create phone identities (max 5)
      const validPhonesToCreate = phones.value.filter(p => p.trim() && isPhoneValid(p)).slice(0, 5);
      for (let i = 0; i < validPhonesToCreate.length; i++) {
        const phone = validPhonesToCreate[i].trim();
        await createIdentity(
          contactsToken,
          selectedNS.value,
          clientId,
          'phone',
          phone.replace(/\D/g, ''),
          i === 0,
          i === 0 ? comments.value.trim() || undefined : undefined,
        );
      }

      // Create email identities (max 5)
      const validEmailsToCreate = emails.value.filter(e => e.trim() && isEmailValid(e)).slice(0, 5);
      for (let i = 0; i < validEmailsToCreate.length; i++) {
        const email = validEmailsToCreate[i].trim();
        await createIdentity(contactsToken, selectedNS.value, clientId, 'email', email, i === 0);
      }

      // Create other identities
      if (telegram.value.trim()) {
        await createIdentity(contactsToken, selectedNS.value, clientId, 'telegram', telegram.value.trim());
      }
      if (whatsapp.value.trim()) {
        await createIdentity(contactsToken, selectedNS.value, clientId, 'whatsapp', whatsapp.value.trim());
      }
      if (website.value.trim()) {
        await createIdentity(contactsToken, selectedNS.value, clientId, 'website', website.value.trim());
      }

      // Link individual contact to selected legal company (if provided)
      if (clientType.value === 'INDIVIDUAL' && selectedLegalCompany.value) {
        const legalClientId = selectedLegalCompany.value.client.id;
        const legalCompanyName = selectedLegalCompany.value.legalEntity?.legalName || '';
        const personName = [individualLastName.value, individualFirstName.value, individualMiddleName.value]
          .filter(Boolean)
          .join(' ')
          .trim();

        // Individual -> Company
        await createIdentity(
          contactsToken,
          selectedNS.value,
          clientId,
          'company',
          legalClientId,
          false,
          legalCompanyName,
        );

        // Company -> Contact Person
        await createIdentity(
          contactsToken,
          selectedNS.value,
          legalClientId,
          'contact_person',
          clientId,
          false,
          personName,
        );
      }

      // Link newly created legal entity with newly created contact person.
      if (clientType.value === 'LEGAL' && createdContactPersonId) {
        const legalCompanyName = legalEntityForm.value.legalName.trim();
        const personName = [
          contactPersonForm.value.lastName,
          contactPersonForm.value.firstName,
          contactPersonForm.value.middleName,
        ]
          .map((part) => part.trim())
          .filter(Boolean)
          .join(' ')
          .trim();

        await createIdentity(
          contactsToken,
          selectedNS.value,
          createdContactPersonId,
          'company',
          clientId,
          false,
          legalCompanyName,
        );

        await createIdentity(
          contactsToken,
          selectedNS.value,
          clientId,
          'contact_person',
          createdContactPersonId,
          false,
          personName,
        );
      }

      try {
        await saveDynamicFieldValues(contactsToken, selectedNS.value, clientId);
      } catch (dynamicFieldError) {
        logError('Dynamic fields were not saved during client creation:', dynamicFieldError);
        toast.add({
          title: t('common.warning') || 'Warning',
          description: tr('contacts.dynamicFieldsSaveWarning', 'Клиент создан, но дополнительные поля не сохранены'),
          color: 'amber',
        });
      }
    }

    hasChanges.value = false;
    toast.add({
      title: t('common.success'),
      description: t('contacts.clientCreated'),
      color: 'green',
    });

    // Redirect to contacts list
    await router.push(`/${nsSlug.value}/contacts/all/1-20`);
  } catch (error) {
    logError('Failed to create client:', error);
    toast.add({
      title: t('common.error'),
      description: t('contacts.createError'),
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

function getLegalCompanyLabel(item: ClientRow): string {
  const legalName = item.legalEntity?.legalName || '';
  const brandName = item.legalEntity?.brandName || '';
  const binIin = item.legalEntity?.binIin || '';
  if (brandName && binIin) return `${legalName} (${brandName}, ${binIin})`;
  if (brandName) return `${legalName} (${brandName})`;
  if (binIin) return `${legalName} (${binIin})`;
  return legalName || item.client.id;
}

function chooseLegalCompany(item: ClientRow) {
  selectedLegalCompany.value = item;
  legalCompanySearch.value = getLegalCompanyLabel(item);
  legalCompanyOptions.value = [];
}

function clearLegalCompany() {
  selectedLegalCompany.value = null;
  legalCompanySearch.value = '';
  legalCompanyOptions.value = [];
}

function chooseExistingLegalEntity(item: ClientRow) {
  selectedExistingLegalEntity.value = item;
  legalEntityForm.value.legalName = item.legalEntity?.legalName || '';
  legalEntityForm.value.brandName = item.legalEntity?.brandName || '';
  legalEntityForm.value.binIin = formatBinInput(item.legalEntity?.binIin || '');
  legalEntityForm.value.registrationCountry = item.legalEntity?.registrationCountry || '';
  legalEntityForm.value.registrationDate = item.legalEntity?.registrationDate || '';
  legalEntityOptions.value = [];
}

function clearSelectedExistingLegalEntity() {
  selectedExistingLegalEntity.value = null;
  legalEntityForm.value.legalName = '';
  contactPersonForm.value = {
    firstName: '',
    lastName: '',
    middleName: '',
    birthDate: '',
    gender: null,
  };
  legalEntityOptions.value = [];
}

// Auto-focus on phone input when page loads
nextTick(() => {
  if (phoneInputRef.value) {
    phoneInputRef.value.$el?.querySelector('input')?.focus();
  }
});

onMounted(() => {
  if (!process.client) return;
  const storedType = localStorage.getItem(CLIENT_TYPE_STORAGE_KEY);
  if (storedType === 'INDIVIDUAL' || storedType === 'LEGAL') {
    clientType.value = storedType;
  }

  if (token.value && selectedNS.value) {
    loadDynamicFields(token.value, selectedNS.value);
  }
});

const nsTitle = computed(() => titleBySlug(nsSlug.value) || nsSlug.value || '');
const pageTitle = computed(() => {
  return nsTitle.value ? `${t('contacts.createClient')} — ${nsTitle.value}` : t('contacts.createClient');
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
              {{ t('contacts.createClient') }}
            </h1>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {{ nsTitle }} • {{ clientType === 'INDIVIDUAL' ? t('contacts.individual') : t('contacts.legalEntity') }}
            </p>
          </div>
          <UButton
            icon="i-heroicons-arrow-left"
            size="xs"
            color="primary"
            variant="soft"
            class="min-w-fit gap-2"
            @click="handleBack"
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
              {{ t('contacts.clientType') }}
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
                >
                <span class="flex h-5 w-5 items-center justify-center rounded-full border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-900">
                  <span class="h-2.5 w-2.5 rounded-full bg-blue-600 opacity-0 peer-checked:opacity-100" />
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
              <UIcon
                name="i-heroicons-phone"
                class="w-4 h-4 text-blue-600"
              />
              <h2 class="text-base font-semibold text-gray-900 dark:text-white">
                {{ t('contacts.contactInformation') }}
              </h2>
            </div>
            
            <!-- Primary Phone -->
            <div>
              <UFormGroup 
                :label="t('contacts.primaryPhone') + ' *'"
                :description="t('contacts.required')"
                :help="!hasValidPrimaryPhone && phones[0] ? (t('contacts.invalidPhone')) : ''"
                :error="!!(!hasValidPrimaryPhone && phones[0])"
              >
                <UInput
                  ref="phoneInputRef"
                  :model-value="phones[0]"
                  type="tel"
                  inputmode="tel"
                  pattern="[0-9+()\s-]*"
                  :placeholder="t('contacts.enterPhone')"
                  size="md"
                  autofocus
                  data-phone-input
                  @update:model-value="value => updatePhoneValue(0, value)"
                />
              </UFormGroup>
              <p
                v-if="phones[0].trim()"
                class="mt-1 text-xs text-gray-500 dark:text-gray-400"
              >
                {{ t('contacts.phonePreview') }}: {{ getPhonePreview(phones[0]) }}
              </p>
            </div>

            <!-- Additional Phones -->
            <div
              v-for="(phone, idx) in phones.slice(1)"
              :key="'phone-' + idx"
              class="space-y-1"
            >
              <div class="flex gap-2">
                <div class="flex-1">
                  <UFormGroup 
                    :label="idx === 0 ? t('contacts.additionalPhone') : ''"
                    :help="phone && !isPhoneValid(phone) ? (t('contacts.invalidPhone')) : ''"
                    :error="!!(phone && !isPhoneValid(phone))"
                  >
                    <UInput
                      :model-value="phones[idx + 1]"
                      type="tel"
                      inputmode="tel"
                      pattern="[0-9+()\s-]*"
                      :placeholder="t('contacts.enterPhone')"
                      size="md"
                      data-phone-input
                      @update:model-value="value => updatePhoneValue(idx + 1, value)"
                    />
                  </UFormGroup>
                  <p
                    v-if="phones[idx + 1].trim()"
                    class="mt-1 text-xs text-gray-500 dark:text-gray-400"
                  >
                    {{ t('contacts.phonePreview') }}: {{ getPhonePreview(phones[idx + 1]) }}
                  </p>
                </div>
                <UButton
                  icon="i-heroicons-trash-20-solid"
                  color="red"
                  variant="ghost"
                  size="sm"
                  :style="{ marginTop: idx === 0 ? '24px' : '0' }"
                  @click="removePhone(idx + 1)"
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
              {{ t('contacts.addPhone') }}
            </UButton>
          </div>

          <UDivider class="my-4" />

          <!-- 2. Name Section -->
          <div
            v-if="clientType === 'INDIVIDUAL'"
            class="space-y-3"
          >
            <div class="flex items-center gap-2">
              <UIcon
                name="i-heroicons-user"
                class="w-4 h-4 text-blue-600"
              />
              <h2 class="text-base font-semibold text-gray-900 dark:text-white">
                {{ t('contacts.personalInformation') }}
              </h2>
            </div>
            
            <UFormGroup 
              :label="t('contacts.firstName') + ' *'"
            >
              <UInput
                v-model="individualFirstName"
                type="text"
                :placeholder="t('contacts.firstNamePlaceholder')"
                size="md"
              />
            </UFormGroup>

            <UFormGroup 
              :label="t('contacts.lastName')"
            >
              <UInput
                v-model="individualLastName"
                type="text"
                :placeholder="t('contacts.lastNamePlaceholder')"
                size="md"
              />
            </UFormGroup>

            <UFormGroup 
              :label="t('contacts.middleName')"
            >
              <UInput
                v-model="individualMiddleName"
                type="text"
                :placeholder="t('contacts.middleNamePlaceholder')"
                size="md"
              />
            </UFormGroup>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <UFormGroup :label="t('contacts.birthDate')">
                <UInput
                  v-model="individualBirthDate"
                  type="date"
                  size="md"
                />
              </UFormGroup>

              <UFormGroup :label="t('contacts.gender')">
                <USelect
                  :model-value="(individualGender as any)"
                  :options="[
                    { value: null, label: '--' },
                    { value: true, label: t('contacts.male') },
                    { value: false, label: t('contacts.female') },
                  ]"
                  size="md"
                  @update:model-value="(val: any) => individualGender = val"
                />
              </UFormGroup>
            </div>

            <UFormGroup
              :label="t('contacts.legalEntity')"
              :description="t('contacts.attachLegalEntityDescription')"
            >
              <div class="space-y-2">
                <UInput
                  v-model="legalCompanySearch"
                  type="text"
                  :placeholder="tr('contacts.searchLegalEntityPlaceholder', 'Введите название юрлица или БИН')"
                  size="md"
                />

                <div
                  v-if="legalCompanyLoading"
                  class="text-xs text-gray-500 dark:text-gray-400"
                >
                  {{ t('contacts.searchingCompanies') }}
                </div>

                <div
                  v-if="legalCompanyOptions.length > 0"
                  class="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900"
                >
                  <button
                    v-for="item in legalCompanyOptions"
                    :key="item.client.id"
                    type="button"
                    class="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-gray-100 dark:border-gray-800 last:border-b-0"
                    @click="chooseLegalCompany(item)"
                  >
                    {{ getLegalCompanyLabel(item) }}
                  </button>
                </div>

                <div
                  v-if="selectedLegalCompany"
                  class="flex items-center justify-between rounded-md border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 px-3 py-2 text-sm"
                >
                  <span class="text-blue-800 dark:text-blue-200">{{ t('contacts.selected') }}: {{ getLegalCompanyLabel(selectedLegalCompany) }}</span>
                  <UButton
                    type="button"
                    icon="i-heroicons-x-mark"
                    color="gray"
                    variant="ghost"
                    size="xs"
                    @click="clearLegalCompany"
                  />
                </div>
              </div>
            </UFormGroup>
          </div>

          <div
            v-if="clientType === 'LEGAL'"
            class="space-y-3"
          >
            <div class="flex items-center gap-2">
              <UIcon
                name="i-heroicons-building-office-2"
                class="w-4 h-4 text-blue-600"
              />
              <h2 class="text-base font-semibold text-gray-900 dark:text-white">
                {{ t('contacts.companyInformation') }}
              </h2>
            </div>
            
            <UFormGroup
              :label="t('contacts.legalName') + ' *'"
              :description="t('contacts.searchToAvoidDuplicates')"
            >
              <div class="space-y-2">
                <UInput
                  v-model="legalEntityForm.legalName"
                  type="text"
                  :placeholder="t('contacts.legalNamePlaceholder')"
                  size="md"
                />

                <div
                  v-if="legalEntityLoading"
                  class="text-xs text-gray-500 dark:text-gray-400"
                >
                  {{ t('contacts.searchingSimilarCompanies') }}
                </div>

                <div
                  v-if="legalEntityOptions.length > 0"
                  class="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900"
                >
                  <button
                    v-for="item in legalEntityOptions"
                    :key="item.client.id"
                    type="button"
                    class="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-gray-100 dark:border-gray-800 last:border-b-0"
                    @click="chooseExistingLegalEntity(item)"
                  >
                    {{ getLegalCompanyLabel(item) }}
                  </button>
                </div>

                <div
                  v-if="selectedExistingLegalEntity"
                  class="flex items-center justify-between rounded-md border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 px-3 py-2 text-sm"
                >
                  <span class="text-blue-800 dark:text-blue-200">{{ t('contacts.selectedExistingLegalEntity') }}: {{ getLegalCompanyLabel(selectedExistingLegalEntity) }}</span>
                  <UButton
                    type="button"
                    icon="i-heroicons-x-mark"
                    color="gray"
                    variant="ghost"
                    size="xs"
                    @click="clearSelectedExistingLegalEntity"
                  />
                </div>
              </div>
            </UFormGroup>

            <UFormGroup :label="t('contacts.brandName')">
              <UInput
                v-model="legalEntityForm.brandName"
                type="text"
                :placeholder="t('contacts.brandNamePlaceholder')"
                size="md"
                :disabled="!!selectedExistingLegalEntity"
              />
            </UFormGroup>

            <UFormGroup :label="t('contacts.binIin')">
              <UInput
                v-model="legalEntityForm.binIin"
                type="text"
                :placeholder="t('contacts.binIinPlaceholder')"
                size="md"
                :disabled="!!selectedExistingLegalEntity"
              />
            </UFormGroup>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <UFormGroup :label="t('contacts.registrationCountry')">
                <UInput
                  v-model="legalEntityForm.registrationCountry"
                  type="text"
                  :placeholder="t('contacts.registrationCountryPlaceholder')"
                  size="md"
                  :disabled="!!selectedExistingLegalEntity"
                />
              </UFormGroup>

              <UFormGroup :label="t('contacts.registrationDate')">
                <UInput
                  v-model="legalEntityForm.registrationDate"
                  type="date"
                  size="md"
                  :disabled="!!selectedExistingLegalEntity"
                />
              </UFormGroup>
            </div>

            <!-- Contact Person Section -->
            <div class="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
              <h4 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                {{ t('contacts.contactPersonOptional') }}
              </h4>
              
              <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <UFormGroup :label="t('contacts.firstName')">
                  <UInput
                    v-model="contactPersonForm.firstName"
                    type="text"
                    :placeholder="t('contacts.firstName')"
                    size="md"
                    :disabled="!!selectedExistingLegalEntity"
                  />
                </UFormGroup>

                <UFormGroup :label="t('contacts.lastName')">
                  <UInput
                    v-model="contactPersonForm.lastName"
                    type="text"
                    :placeholder="t('contacts.lastName')"
                    size="md"
                    :disabled="!!selectedExistingLegalEntity"
                  />
                </UFormGroup>
              </div>

              <UFormGroup :label="t('contacts.middleName')">
                <UInput
                  v-model="contactPersonForm.middleName"
                  type="text"
                  :placeholder="t('contacts.middleName')"
                  size="md"
                  :disabled="!!selectedExistingLegalEntity"
                />
              </UFormGroup>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <UFormGroup :label="t('contacts.birthDate')">
                  <UInput
                    v-model="contactPersonForm.birthDate"
                    type="date"
                    size="md"
                    :disabled="!!selectedExistingLegalEntity"
                  />
                </UFormGroup>

                <UFormGroup :label="t('contacts.gender')">
                  <USelect
                    :model-value="(contactPersonForm.gender as any)"
                    :options="[
                      { value: null, label: '--' },
                      { value: true, label: t('contacts.male') },
                      { value: false, label: t('contacts.female') },
                    ]"
                    size="md"
                    :disabled="!!selectedExistingLegalEntity"
                    @update:model-value="(val: any) => contactPersonForm.gender = val"
                  />
                </UFormGroup>
              </div>
            </div>
          </div>

          <UDivider class="my-4" />

          <!-- 3. Additional Contacts and Info -->
          <div class="space-y-3">
            <!-- Additional Information Accordion -->
            <UAccordion
              :key="hasRequiredAdditionalFields ? 'required-fields' : 'optional-fields'"
              :items="additionalAccordionItems"
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
                  <div
                    v-if="dynamicFieldsLoading"
                    class="text-sm text-gray-500 dark:text-gray-400"
                  >
                    {{ t('common.loading') }}
                  </div>

                  <div
                    v-else-if="dynamicFieldsError"
                    class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200"
                  >
                    {{ dynamicFieldsError }}
                  </div>

                  <div
                    v-else-if="dynamicFields.length > 0"
                    class="space-y-4"
                  >
                    <div
                      v-for="field in dynamicFields"
                      :key="field.id"
                      class="space-y-2"
                    >
                      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        {{ field.label }}
                        <span
                          v-if="field.isRequired"
                          class="text-red-500"
                        >*</span>
                      </label>

                      <DynamicFieldInput
                        v-model="dynamicFieldDrafts[field.id]"
                        :field="field"
                        :yes-label="tr('contacts.yes', 'Да')"
                        :no-label="tr('contacts.no', 'Нет')"
                        :none-selected-label="tr('contacts.noneSelected', 'Ничего не выбрано')"
                        :select-options-label="tr('contacts.selectOptions', 'Выберите варианты')"
                        :selected-count-suffix="tr('contacts.selectedCountSuffix', 'выбрано')"
                      />
                    </div>
                  </div>

                  <!-- Emails -->
                  <div class="space-y-2">
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      {{ t('contacts.email') }}
                    </label>
                    
                    <div
                      v-for="(email, index) in emails"
                      :key="'email-' + index"
                      class="flex gap-2"
                    >
                      <UFormGroup 
                        class="flex-1"
                        :help="email && !isEmailValid(email) ? t('contacts.invalidEmail') : ''"
                        :error="!!(email && !isEmailValid(email))"
                      >
                        <UInput
                          v-model="emails[index]"
                          type="email"
                          :placeholder="t('contacts.enterEmail')"
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
                        style="margin-top: 24px"
                        @click="removeEmail(index)"
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
                      {{ t('contacts.addEmail') }}
                    </UButton>
                  </div>

                  <!-- Telegram -->
                  <UFormGroup :label="t('contacts.telegram')">
                    <UInput
                      v-model="telegram"
                      type="text"
                      :placeholder="t('contacts.telegramPlaceholder')"
                      size="md"
                    />
                  </UFormGroup>

                  <!-- WhatsApp -->
                  <UFormGroup :label="t('contacts.whatsapp')">
                    <UInput
                      :model-value="whatsapp"
                      type="tel"
                      inputmode="tel"
                      pattern="[0-9+()\s-]*"
                      :placeholder="t('contacts.enterPhone')"
                      size="md"
                      @update:model-value="updateWhatsappValue"
                    />
                  </UFormGroup>

                  <!-- Website -->
                  <UFormGroup :label="t('contacts.website')">
                    <UInput
                      v-model="website"
                      type="url"
                      :placeholder="t('contacts.websitePlaceholder')"
                      size="md"
                    />
                  </UFormGroup>

                  <!-- Comments -->
                  <UFormGroup :label="t('contacts.comments')">
                    <UTextarea
                      v-model="comments"
                      :placeholder="t('contacts.commentsPlaceholder')"
                      size="md"
                    />
                  </UFormGroup>
                </div>
              </template>
            </UAccordion>
          </div>
        </form>
      </div>

      <!-- Action Buttons -->
      <div class="mt-6 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3">
        <div class="flex gap-2">
          <UButton
            color="primary"
            variant="soft"
            size="sm"
            :label="t('app.cancel')"
            @click="handleBack"
          />
          <UButton
            color="primary"
            variant="soft"
            size="md"
            :loading="loading"
            :disabled="!isFormValid || loading"
            icon="i-heroicons-check-circle"
            @click="handleSubmit"
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
            <UIcon
              name="i-heroicons-exclamation-triangle"
              class="w-6 h-6 text-amber-500"
            />
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
              {{ t('contacts.confirmLeave') }}
            </h3>
          </div>
        </template>

        <div class="text-gray-600 dark:text-gray-300">
          {{ t('contacts.unsavedChanges') }}
        </div>

        <template #footer>
          <div class="flex gap-3 justify-end">
            <UButton
              color="primary"
              variant="soft"
              :label="t('contacts.keepEditing')"
              @click="cancelLeave"
            />
            <UButton
              color="red"
              :label="t('contacts.discardChanges')"
              @click="confirmLeave"
            />
          </div>
        </template>
      </UCard>
    </UModal>
  </div>
</template>
