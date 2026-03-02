<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useI18n } from '@/composables/useI18n';
import { useContactsToken } from '@/composables/useContactsToken';
import { logError } from '@/utils/logger';
import { contactsUpdateClientStatus } from '@/api/contacts/mutations';
import type { ClientRow } from '@/api/contacts/listClients';
import { getClient } from '@/api/contacts/getClient';
import { getClientIdentities, type ClientIdentity } from '@/api/contacts/identities';
import { getClientTags } from '@/api/contacts/tags';
import { getClientEvents, type ClientEvent } from '@/api/contacts/events';
import { getBonusBalance, getClientTier, getStampCards, getClientStampProgress, type BonusBalance, type ClientTier, type StampCard, type ClientStampProgress } from '@/api/contacts/loyalty';
import { useNamespace } from '@/composables/useNamespace';
import ContactHeader from '@/components/contacts/ContactHeader.vue';
import ContactPersonalInfo from '@/components/contacts/ContactPersonalInfo.vue';
import ContactIdentities from '@/components/contacts/ContactIdentities.vue';
import ContactLoyalty from '@/components/contacts/ContactLoyalty.vue';
import ContactTimeline from '@/components/contacts/ContactTimeline.vue';
import ContactTags from '@/components/contacts/ContactTags.vue';

definePageMeta({
  viewTransition: false,
});

const router = useRouter();
const route = useRoute();
const toast = useToast();
const { t } = useI18n();
const { token } = useAuth();
const { selected: selectedNS, titleBySlug } = useNamespace();
const clientId = computed(() => route.params.id as string);

const client = ref<ClientRow | null>(null);
const identities = ref<ClientIdentity[]>([]);
const tags = ref<any[]>([]);
const events = ref<ClientEvent[]>([]);
const bonusBalance = ref<BonusBalance | null>(null);
const clientTier = ref<ClientTier | null>(null);
const stampCards = ref<StampCard[]>([]);
const stampProgress = ref<ClientStampProgress[]>([]);
const loading = ref(true);
const statusChangeLoading = ref(false);

// Mock data for preview
const useMockData = ref(true);

// Edit mode state
const editMode = ref({
  personalInfo: false,
  identities: false,
});

// Backup for canceling edits
const backupClient = ref<ClientRow | null>(null);
const backupIdentities = ref<ClientIdentity[]>([]);

// Edit form data - Personal Info
const editingFirstName = ref('');
const editingLastName = ref('');
const editingMiddleName = ref('');
const editingBirthDate = ref('');
const editingGender = ref('');
const editingLegalName = ref('');
const editingBrandName = ref('');
const editingBinIin = ref('');
const editingRegistrationCountry = ref('');
const editingRegistrationDate = ref('');

// Edit form data - Identities
const editingPhones = ref<string[]>([]);
const editingEmails = ref<string[]>([]);

const displayName = computed(() => {
  if (!client.value) return '';
  const c = client.value;
  if (c.client.clientType === 'INDIVIDUAL' && c.individual) {
    const parts = [c.individual.lastName, c.individual.firstName, c.individual.middleName].filter(Boolean);
    return parts.join(' ');
  }
  return c.legalEntity?.legalName || 'Unknown';
});

const nsSlug = computed(() => route.params.namespace as string);
const nsTitle = computed(() => titleBySlug(nsSlug.value) || nsSlug.value || '');
const pageTitle = computed(() => {
  return displayName.value ? `${displayName.value} — ${nsTitle.value}` : t('common.loading');
});

useHead(() => ({
  title: pageTitle.value,
}));

onMounted(async () => {
  await loadClient();
});

async function loadClient() {
  // Use mock data for preview
  if (useMockData.value) {
    loading.value = true;
    
    // Simulate loading delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Mock client data
    client.value = {
      client: {
        id: '550e8400-e29b-41d4-a716-446655440000',
        shortId: 'a9B2mX7q',
        clientType: 'INDIVIDUAL',
        status: 'ACTIVE',
        createdAt: '2024-01-15T10:30:00Z',
        updatedAt: '2024-03-01T14:22:00Z',
      },
      individual: {
        firstName: 'Александр',
        lastName: 'Петров',
        middleName: 'Иванович',
        birthDate: '1990-05-15',
        gender: 'male',
      },
    };
    
    // Mock identities
    identities.value = [
      {
        id: '1',
        clientId: client.value.client.id,
        type: 'phone',
        value: '+7 (777) 123-45-67',
        isPrimary: true,
        verifiedAt: '2024-01-15T10:30:00Z',
      },
      {
        id: '2',
        clientId: client.value.client.id,
        type: 'email',
        value: 'a.petrov@example.com',
        isPrimary: true,
        verifiedAt: '2024-01-16T11:20:00Z',
      },
      {
        id: '3',
        clientId: client.value.client.id,
        type: 'telegram',
        value: '@apetrov',
        isPrimary: false,
      },
    ];
    
    // Mock tags
    tags.value = [
      { id: '1', name: 'VIP' },
      { id: '2', name: 'Постоянный клиент' },
      { id: '3', name: 'Оптовик' },
    ];
    
    // Mock events
    events.value = [
      {
        id: '1',
        clientId: client.value.client.id,
        eventType: 'CLIENT_CREATED',
        payload: '{}',
        createdAt: '2024-01-15T10:30:00Z',
        createdBy: 'system',
      },
      {
        id: '2',
        clientId: client.value.client.id,
        eventType: 'IDENTITY_ADDED',
        payload: JSON.stringify({ type: 'phone', value: '+7 (777) 123-45-67' }),
        createdAt: '2024-01-15T10:31:00Z',
        createdBy: 'system',
      },
      {
        id: '3',
        clientId: client.value.client.id,
        eventType: 'IDENTITY_ADDED',
        payload: JSON.stringify({ type: 'email', value: 'a.petrov@example.com' }),
        createdAt: '2024-01-16T11:20:00Z',
        createdBy: 'admin@example.com',
      },
      {
        id: '4',
        clientId: client.value.client.id,
        eventType: 'TAG_ADDED',
        payload: JSON.stringify({ tagName: 'VIP' }),
        createdAt: '2024-01-20T09:15:00Z',
        createdBy: 'manager@example.com',
      },
      {
        id: '5',
        clientId: client.value.client.id,
        eventType: 'TAG_ADDED',
        payload: JSON.stringify({ tagName: 'Постоянный клиент' }),
        createdAt: '2024-01-22T14:30:00Z',
        createdBy: 'manager@example.com',
      },
      {
        id: '6',
        clientId: client.value.client.id,
        eventType: 'BONUS_EARNED',
        payload: JSON.stringify({ amount: 1500, reason: 'REGISTRATION' }),
        createdAt: '2024-02-01T08:00:00Z',
        createdBy: 'system',
      },
      {
        id: '7',
        clientId: client.value.client.id,
        eventType: 'BONUS_SPENT',
        payload: JSON.stringify({ amount: 500, description: 'Скидка 10% на покупку' }),
        createdAt: '2024-02-05T16:45:00Z',
        createdBy: 'system',
      },
      {
        id: '8',
        clientId: client.value.client.id,
        eventType: 'TAG_ADDED',
        payload: JSON.stringify({ tagName: 'Оптовик' }),
        createdAt: '2024-02-08T10:20:00Z',
        createdBy: 'admin@example.com',
      },
      {
        id: '9',
        clientId: client.value.client.id,
        eventType: 'IDENTITY_ADDED',
        payload: JSON.stringify({ type: 'telegram', value: '@apetrov' }),
        createdAt: '2024-02-10T12:00:00Z',
        createdBy: 'user',
      },
      {
        id: '10',
        clientId: client.value.client.id,
        eventType: 'BONUS_EARNED',
        payload: JSON.stringify({ amount: 2500, reason: 'PURCHASE' }),
        createdAt: '2024-02-15T09:30:00Z',
        createdBy: 'system',
      },
      {
        id: '11',
        clientId: client.value.client.id,
        eventType: 'TIER_UPGRADED',
        payload: JSON.stringify({ from: 'SILVER', to: 'GOLD' }),
        createdAt: '2024-02-20T13:22:00Z',
        createdBy: 'system',
      },
      {
        id: '12',
        clientId: client.value.client.id,
        eventType: 'BONUS_SPENT',
        payload: JSON.stringify({ amount: 1200, description: 'Скидка 20% на покупку' }),
        createdAt: '2024-02-22T11:15:00Z',
        createdBy: 'system',
      },
      {
        id: '13',
        clientId: client.value.client.id,
        eventType: 'BONUS_EARNED',
        payload: JSON.stringify({ amount: 3000, reason: 'TIER_BONUS' }),
        createdAt: '2024-02-25T08:00:00Z',
        createdBy: 'system',
      },
      {
        id: '14',
        clientId: client.value.client.id,
        eventType: 'IDENTITY_VERIFIED',
        payload: JSON.stringify({ type: 'email', value: 'a.petrov@example.com' }),
        createdAt: '2024-02-26T15:45:00Z',
        createdBy: 'system',
      },
      {
        id: '15',
        clientId: client.value.client.id,
        eventType: 'COMMENT_ADDED',
        payload: JSON.stringify({ text: 'Звоним только с 10:00 до 12:00' }),
        createdAt: '2024-02-28T09:00:00Z',
        createdBy: 'manager@example.com',
      },
      {
        id: '16',
        clientId: client.value.client.id,
        eventType: 'BONUS_EARNED',
        payload: JSON.stringify({ amount: 1800, reason: 'VISIT' }),
        createdAt: '2024-03-01T10:30:00Z',
        createdBy: 'system',
      },
      {
        id: '17',
        clientId: client.value.client.id,
        eventType: 'STATUS_CHANGED',
        payload: JSON.stringify({ from: 'ACTIVE', to: 'ACTIVE' }),
        createdAt: '2024-03-01T14:22:00Z',
        createdBy: 'admin@example.com',
      },
      {
        id: '18',
        clientId: client.value.client.id,
        eventType: 'IDENTITY_ADDED',
        payload: JSON.stringify({ type: 'whatsapp', value: '+7 777 123-45-67' }),
        createdAt: '2024-03-02T10:15:00Z',
        createdBy: 'user',
      },
      {
        id: '19',
        clientId: client.value.client.id,
        eventType: 'RECORD_UPDATED',
        payload: JSON.stringify({ field: 'birthDate', oldValue: '1990-05-15', newValue: '1990-05-15' }),
        createdAt: '2024-03-02T11:00:00Z',
        createdBy: 'admin@example.com',
      },
      {
        id: '20',
        clientId: client.value.client.id,
        eventType: 'BONUS_EXPIRED',
        payload: JSON.stringify({ amount: 520 }),
        createdAt: '2024-03-02T23:59:00Z',
        createdBy: 'system',
      },
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    // Mock bonus balance
    bonusBalance.value = {
      clientId: client.value.client.id,
      totalBonuses: 15420,
      availableBonuses: 12850,
      expiringSoon: 2570,
      updatedAt: '2024-03-01T14:22:00Z',
    };
    
    // Mock client tier
    clientTier.value = {
      id: '1',
      clientId: client.value.client.id,
      tierId: 'tier-gold',
      currentValue: 78500,
      nextTierThreshold: 100000,
      achievedAt: '2024-02-01T10:00:00Z',
      updatedAt: '2024-03-01T14:22:00Z',
    };
    
    // Mock stamp cards and progress
    stampCards.value = [
      {
        id: 'stamp-1',
        name: 'Кофейная карта',
        description: 'Каждый 10-й кофе бесплатно',
        type: 'COFFEE',
        status: 'ACTIVE',
        totalStamps: 10,
        rewardDescription: 'Бесплатный кофе любого размера',
        validFrom: '2024-01-01T00:00:00Z',
        validUntil: '2024-12-31T23:59:59Z',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
      {
        id: 'stamp-2',
        name: 'Обеды',
        description: 'Соберите 15 штампов за обеды',
        type: 'MEAL',
        status: 'ACTIVE',
        totalStamps: 15,
        rewardDescription: 'Скидка 50% на следующий обед',
        validFrom: '2024-01-01T00:00:00Z',
        validUntil: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
    ];
    
    stampProgress.value = [
      {
        id: 'progress-1',
        clientId: client.value.client.id,
        stampCardId: 'stamp-1',
        currentStamps: 7,
        completedRounds: 3,
        lastStampAt: '2024-02-28T12:30:00Z',
        stampCard: stampCards.value[0],
      },
      {
        id: 'progress-2',
        clientId: client.value.client.id,
        stampCardId: 'stamp-2',
        currentStamps: 11,
        completedRounds: 0,
        lastStampAt: '2024-02-27T13:15:00Z',
        stampCard: stampCards.value[1],
      },
    ];
    
    loading.value = false;
    return;
  }
  
  // Real data loading
  if (!token.value || !selectedNS.value) {
    loading.value = false;
    return;
  }

  try {
    loading.value = true;
    const { ensure } = useContactsToken();
    const contactsToken = await ensure(selectedNS.value, token.value);
    if (!contactsToken) return;

    const clientData = await getClient(contactsToken, selectedNS.value, clientId.value);
    if (!clientData) {
      toast.add({
        title: t('common.error'),
        description: t('common.contacts.notFound'),
        color: 'red',
      });
      router.push(`/${selectedNS.value}/contacts`);
      return;
    }
    client.value = clientData;

    const fullClientId = client.value.client.id;

    const identitiesData = await getClientIdentities(contactsToken, fullClientId);
    identities.value = identitiesData.clientIdentities.rows;

    const tagsData = await getClientTags(contactsToken, fullClientId);
    tags.value = tagsData.tags || [];

    const eventsData = await getClientEvents(contactsToken, fullClientId);
    events.value = eventsData.rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    bonusBalance.value = await getBonusBalance(contactsToken, fullClientId);
    clientTier.value = await getClientTier(contactsToken, fullClientId);
    
    const cards = await getStampCards(contactsToken);
    stampCards.value = cards;
    
    const progressPromises = cards.map(card => 
      getClientStampProgress(contactsToken, fullClientId, card.id)
    );
    const progressResults = await Promise.all(progressPromises);
    stampProgress.value = progressResults.filter(p => p !== null) as ClientStampProgress[];
  } catch (error) {
    logError('Failed to load client:', error);
    toast.add({
      title: t('common.error'),
      description: t('common.contacts.loadError'),
      color: 'red',
    });
  } finally {
    loading.value = false;
  }
}

async function updateStatus(newStatus: 'ACTIVE' | 'ARCHIVED' | 'BLOCKED') {
  if (!token.value || !selectedNS.value || !client.value) return;

  try {
    statusChangeLoading.value = true;
    await contactsUpdateClientStatus(token.value, selectedNS.value, clientId.value, newStatus);
    client.value.client.status = newStatus;
    toast.add({
      title: t('common.success'),
      description: t('common.contacts.statusUpdated'),
      color: 'green',
    });
  } catch (error) {
    logError('Failed to update client status:', error);
    toast.add({
      title: t('common.error'),
      description: t('common.contacts.updateError'),
      color: 'red',
    });
  } finally {
    statusChangeLoading.value = false;
  }
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.add({
      title: 'Скопировано',
      icon: 'i-heroicons-clipboard-document-check',
      color: 'green',
    });
  } catch (err) {
    logError('Failed to copy to clipboard', err);
  }
}

function handlePhoneAction(phone: string) {
  window.location.href = `tel:${phone}`;
}

function handleEmailAction(email: string) {
  window.location.href = `mailto:${email}`;
}

function handleTelegramAction(telegram: string) {
  const handle = telegram.replace(/^@/, '');
  window.open(`https://t.me/${handle}`, '_blank');
}

function handleWhatsappAction(phone: string) {
  const clean = phone.replace(/\D/g, '');
  window.open(`https://wa.me/${clean}`, '_blank');
}

function handleBack() {
  router.back();
}

// Edit mode functions
function startEditPersonalInfo() {
  if (!client.value) return;
  
  backupClient.value = JSON.parse(JSON.stringify(client.value));
  
  if (client.value.individual) {
    editingFirstName.value = client.value.individual.firstName;
    editingLastName.value = client.value.individual.lastName;
    editingMiddleName.value = client.value.individual.middleName || '';
    editingBirthDate.value = client.value.individual.birthDate ? new Date(client.value.individual.birthDate).toISOString().split('T')[0] : '';
    editingGender.value = client.value.individual.gender || '';
  } else if (client.value.legalEntity) {
    editingLegalName.value = client.value.legalEntity.legalName;
    editingBrandName.value = client.value.legalEntity.brandName || '';
    editingBinIin.value = client.value.legalEntity.binIin || '';
    editingRegistrationCountry.value = client.value.legalEntity.registrationCountry || '';
    editingRegistrationDate.value = client.value.legalEntity.registrationDate ? new Date(client.value.legalEntity.registrationDate).toISOString().split('T')[0] : '';
  }
  
  editMode.value.personalInfo = true;
}

function cancelEditPersonalInfo() {
  editMode.value.personalInfo = false;
  backupClient.value = null;
}

function savePersonalInfo() {
  if (!client.value) return;
  
  if (useMockData.value) {
    if (client.value.individual) {
      client.value.individual.firstName = editingFirstName.value;
      client.value.individual.lastName = editingLastName.value;
      client.value.individual.middleName = editingMiddleName.value;
      client.value.individual.birthDate = editingBirthDate.value ? editingBirthDate.value : undefined;
      client.value.individual.gender = editingGender.value;
    } else if (client.value.legalEntity) {
      client.value.legalEntity.legalName = editingLegalName.value;
      client.value.legalEntity.brandName = editingBrandName.value;
      client.value.legalEntity.binIin = editingBinIin.value;
      client.value.legalEntity.registrationCountry = editingRegistrationCountry.value;
      client.value.legalEntity.registrationDate = editingRegistrationDate.value ? editingRegistrationDate.value : undefined;
    }
    
    editMode.value.personalInfo = false;
    toast.add({
      title: t('common.success'),
      description: 'Данные клиента обновлены',
      color: 'green',
    });
  }
}

function startEditIdentities() {
  backupIdentities.value = JSON.parse(JSON.stringify(identities.value));
  
  editingPhones.value = identities.value
    .filter(id => id.type === 'phone')
    .map(id => id.value)
    .slice(0, 5);
  if (editingPhones.value.length === 0) {
    editingPhones.value = [''];
  }
  
  editingEmails.value = identities.value
    .filter(id => id.type === 'email')
    .map(id => id.value)
    .slice(0, 5);
  if (editingEmails.value.length === 0) {
    editingEmails.value = [''];
  }
  
  editMode.value.identities = true;
}

function cancelEditIdentities() {
  editMode.value.identities = false;
  backupIdentities.value = [];
}

function saveIdentities() {
  if (!client.value) return;
  
  if (useMockData.value) {
    identities.value = [
      ...editingPhones.value
        .filter(p => p.trim())
        .map((value, idx) => ({
          id: `phone-${idx}`,
          clientId: client.value!.client.id,
          type: 'phone',
          value,
          isPrimary: idx === 0,
          verifiedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })),
      ...editingEmails.value
        .filter(e => e.trim())
        .map((value, idx) => ({
          id: `email-${idx}`,
          clientId: client.value!.client.id,
          type: 'email',
          value,
          isPrimary: idx === 0,
          verifiedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })),
    ];
    
    editMode.value.identities = false;
    toast.add({
      title: t('common.success'),
      description: 'Контактные данные обновлены',
      color: 'green',
    });
  }
}

function addPhoneField() {
  if (editingPhones.value.length < 5) {
    editingPhones.value.push('');
  }
}

function removePhoneField(index: number) {
  if (editingPhones.value.length > 1) {
    editingPhones.value.splice(index, 1);
  }
}

function addEmailField() {
  if (editingEmails.value.length < 5) {
    editingEmails.value.push('');
  }
}

function removeEmailField(index: number) {
  if (editingEmails.value.length > 1) {
    editingEmails.value.splice(index, 1);
  }
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <!-- Page Header -->
    <ContactHeader 
      :client="client" 
      :namespace="nsSlug"
      @back="handleBack"
    />

    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center py-20">
      <div class="text-center">
        <UIcon name="lucide:loader" class="w-8 h-8 mx-auto text-gray-400 animate-spin mb-4" />
        <p class="text-gray-600 dark:text-gray-400">{{ t('common.loading') }}</p>
      </div>
    </div>

    <!-- Main Content -->
    <div v-else-if="client" class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Left Column -->
        <div class="lg:col-span-2 space-y-6">
          <!-- Personal Info Section -->
          <ContactPersonalInfo
            :client="client"
            :edit-mode="editMode.personalInfo"
            :editing-first-name="editingFirstName"
            :editing-last-name="editingLastName"
            :editing-middle-name="editingMiddleName"
            :editing-birth-date="editingBirthDate"
            :editing-gender="editingGender"
            :editing-legal-name="editingLegalName"
            :editing-brand-name="editingBrandName"
            :editing-bin-iin="editingBinIin"
            :editing-registration-country="editingRegistrationCountry"
            :editing-registration-date="editingRegistrationDate"
            @start-edit="startEditPersonalInfo"
            @save-edit="savePersonalInfo"
            @cancel-edit="cancelEditPersonalInfo"
            @update-field="(field, value) => {
              if (field === 'firstName') editingFirstName = value;
              if (field === 'lastName') editingLastName = value;
              if (field === 'middleName') editingMiddleName = value;
              if (field === 'birthDate') editingBirthDate = value;
              if (field === 'gender') editingGender = value;
              if (field === 'legalName') editingLegalName = value;
              if (field === 'brandName') editingBrandName = value;
              if (field === 'binIin') editingBinIin = value;
              if (field === 'registrationCountry') editingRegistrationCountry = value;
              if (field === 'registrationDate') editingRegistrationDate = value;
            }"
          />

          <!-- Identities Section -->
          <ContactIdentities
            :identities="identities"
            :edit-mode="editMode.identities"
            :editing-phones="editingPhones"
            :editing-emails="editingEmails"
            @start-edit="startEditIdentities"
            @save-edit="saveIdentities"
            @cancel-edit="cancelEditIdentities"
            @add-phone="addPhoneField"
            @remove-phone="removePhoneField"
            @add-email="addEmailField"
            @remove-email="removeEmailField"
            @update-phone="(idx, val) => editingPhones[idx] = val"
            @update-email="(idx, val) => editingEmails[idx] = val"
            @phone-action="handlePhoneAction"
            @email-action="handleEmailAction"
            @telegram-action="handleTelegramAction"
            @whatsapp-action="handleWhatsappAction"
            @copy-to-clipboard="copyToClipboard"
          />

          <!-- Loyalty Section -->
          <ContactLoyalty
            :bonus-balance="bonusBalance"
            :client-tier="clientTier"
            :stamp-cards="stampCards"
            :stamp-progress="stampProgress"
          />

          <!-- Additional Fields Section -->
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow ring-1 ring-gray-200 dark:ring-gray-700 overflow-hidden">
            <div class="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div class="flex items-center gap-2">
                <UIcon name="i-heroicons-adjustments-horizontal" class="w-5 h-5 text-purple-600 dark:text-purple-400" />
                <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
                  Дополнительно
                </h2>
              </div>
              <UButton
                icon="lucide:pencil"
                size="xs"
                color="gray"
                variant="ghost"
              />
            </div>
            <div class="px-5 py-5">
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <p class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Источник лида</p>
                  <p class="text-sm text-gray-900 dark:text-white">Instagram</p>
                </div>
                <div>
                  <p class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Ответственный менеджер</p>
                  <p class="text-sm text-gray-900 dark:text-white">Иванова Мария</p>
                </div>
                <div>
                  <p class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Предпочитаемый канал связи</p>
                  <p class="text-sm text-gray-900 dark:text-white">Telegram</p>
                </div>
                <div>
                  <p class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Скидка (%)</p>
                  <p class="text-sm text-gray-900 dark:text-white">15%</p>
                </div>
                <div class="col-span-2">
                  <p class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Примечания</p>
                  <p class="text-sm text-gray-900 dark:text-white">Предпочитает утренние звонки. Заказывает регулярно оптом на сумму от 500 000 ₸</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Tags Section -->
          <ContactTags :tags="tags" />
        </div>

        <!-- Right Column - Timeline -->
        <div class="lg:col-span-1">
          <ContactTimeline :events="events" />
        </div>
      </div>
    </div>
  </div>
</template>
