<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useI18n } from '@/composables/useI18n';
import { useNamespace } from '@/composables/useNamespace';
import { useClientPage } from '@/composables/useClientPage';
import { useClientEvents } from '@/composables/useClientEvents';
import { useClientDynamicFields } from '@/composables/useClientDynamicFields';
import { useClientIdentityDisplay } from '@/composables/useClientIdentityDisplay';
import { useClientLiveSync } from '@/composables/useClientLiveSync';
import { useClientPersonalInfoEdit } from '@/composables/useClientPersonalInfoEdit';
import { useClientIdentitiesEdit } from '@/composables/useClientIdentitiesEdit';
import {
  copyToClipboard,
  handlePhoneAction,
  handleEmailAction,
  handleTelegramAction,
  handleWhatsappAction,
  handleBack,
} from '@/utils/contacts/contactActions';
import { contactsUpdateClientStatus } from '@/api/contacts/mutations';
import { logError } from '@/utils/logger';
import ContactHeader from '@/components/contacts/ContactHeader.vue';
import ContactPersonalInfo from '@/components/contacts/ContactPersonalInfo.vue';
import ContactIdentities from '@/components/contacts/ContactIdentities.vue';
import ContactLoyalty from '@/components/contacts/ContactLoyalty.vue';
import ContactTimeline from '@/components/contacts/ContactTimeline.vue';
import ContactTags from '@/components/contacts/ContactTags.vue';
import ContactDynamicFields from '@/components/contacts/ContactDynamicFields.vue';
import TagsModal from '@/components/contacts/TagsModal.vue';

definePageMeta({
  viewTransition: false,
});

const router = useRouter();
const route = useRoute();
const toast = useToast();
const { t } = useI18n();
const { token, user } = useAuth();
const { selected: selectedNS, titleBySlug } = useNamespace();

const clientId = computed(() => route.params.id as string);
const nsSlug = computed(() => route.params.namespace as string);
const createdByUserId = computed(() => user.value?.id || '00000000-0000-0000-0000-000000000000');
const currentUserId = computed(() => user.value?.id || '');

const isTagsModalOpen = ref(false);
const statusChangeLoading = ref(false);

// Core client data (client/identities/tags/loyalty) + load orchestration.
const clientPage = useClientPage({ token, selectedNS, clientId, router });
const {
  client, identities, tags, tagNameById, bonusBalance, stampCards, stampProgress,
  contactsAppToken, loading,
} = clientPage;

// Timeline pagination, feeding ContactTimeline via events/hasMoreEvents/loadMoreEvents.
const {
  events, hasMoreEvents, eventsLoadingMore, loadInitialEvents, loadMoreEvents: fetchMoreEvents,
} = useClientEvents();
function loadMoreEvents() {
  return fetchMoreEvents(contactsAppToken.value);
}

// Dynamic-field draft/save state, feeding the extracted ContactDynamicFields.
const {
  dynamicFields, dynamicFieldDrafts, dynamicFieldsLoading, dynamicFieldsError, dynamicFieldsSaving,
  dynamicFieldNameById, loadDynamicFieldsForClient, saveDynamicFields, resetDynamicFields,
} = useClientDynamicFields({
  contactsAppToken,
  selectedNS,
  clientId: computed(() => client.value?.client.id),
  clientType: computed(() => client.value?.client.clientType),
});

// Related-client identity display (company/contact_person resolution).
const {
  identityDisplayValues, relatedClientTargets, loadRelatedClientNames, resolveIdentityDisplayValues, openRelatedClient,
} = useClientIdentityDisplay({ identities, contactsAppToken, selectedNS, nsSlug, router });

// Single load entry point: sequences the core client load with the sibling
// composables' own loaders via injected hooks.
async function loadClient() {
  await clientPage.loadClient({
    loadIdentityDisplay: async () => {
      await loadRelatedClientNames();
      await resolveIdentityDisplayValues();
    },
    loadEvents: loadInitialEvents,
    loadDynamicFields: loadDynamicFieldsForClient,
    resetDynamicFields,
  });
}

// Live-update subscription + staleness banner.
const { isClientDataStale, initClientSubscription, markLocalMutation, refreshStaleClientData } = useClientLiveSync({
  token,
  selectedNS,
  client,
  currentUserId,
  loadClient,
});

// Edit-mode state for the personal-info / identities cards.
const {
  editMode: personalInfoEditMode, editingFirstName, editingLastName, editingMiddleName, editingBirthDate, editingGender,
  editingLegalName, editingBrandName, editingBinIin, editingRegistrationCountry, editingRegistrationDate,
  editingAdditionalInfo, getAdditionalInfoValue, startEditPersonalInfo, cancelEditPersonalInfo, savePersonalInfo,
  updateField: updatePersonalInfoField,
} = useClientPersonalInfoEdit({ client, identities, token, selectedNS, markLocalMutation, loadClient });

const {
  editMode: identitiesEditMode, editingPhones, editingEmails, editingTelegrams, editingWhatsapps,
  startEditIdentities, cancelEditIdentities, saveIdentities,
  addPhoneField, removePhoneField, addEmailField, removeEmailField,
  addTelegramField, removeTelegramField, addWhatsappField, removeWhatsappField,
} = useClientIdentitiesEdit({ client, identities, token, selectedNS, markLocalMutation, loadClient });

const displayName = computed(() => {
  if (!client.value) return '';
  const c = client.value;
  if (c.client.clientType === 'INDIVIDUAL' && c.individual) {
    const parts = [c.individual.lastName, c.individual.firstName, c.individual.middleName].filter(Boolean);
    return parts.join(' ');
  }
  return c.legalEntity?.legalName || '---';
});

const nsTitle = computed(() => titleBySlug(nsSlug.value) || nsSlug.value || '');
const pageTitle = computed(() => {
  return displayName.value ? `${displayName.value} — ${nsTitle.value}` : t('common.loading');
});

useHead(() => ({
  title: pageTitle.value,
}));

onMounted(async () => {
  await loadClient();
  await initClientSubscription();
});

async function updateStatus(newStatus: 'ACTIVE' | 'ARCHIVED' | 'BLOCKED') {
  if (!token.value || !selectedNS.value || !client.value) return;

  try {
    statusChangeLoading.value = true;
    await contactsUpdateClientStatus(token.value, selectedNS.value, clientId.value, newStatus);
    client.value.client.status = newStatus;
    markLocalMutation();
    toast.add({
      title: t('common.success'),
      description: t('contacts.statusUpdated'),
      color: 'emerald',
    });
  } catch (error) {
    logError('Failed to update client status:', error);
    toast.add({
      title: t('common.error'),
      description: t('contacts.updateError'),
      color: 'red',
    });
  } finally {
    statusChangeLoading.value = false;
  }
}

function onBack() {
  handleBack(router, nsSlug.value);
}

function onCopyToClipboard(text: string) {
  return copyToClipboard(text, toast, t);
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <!-- Page Header -->
    <ContactHeader
      :client="client"
      :namespace="nsSlug"
      @back="onBack"
    />

    <!-- Loading State -->
    <div
      v-if="loading"
      class="flex items-center justify-center py-20"
    >
      <div class="text-center">
        <UIcon
          name="lucide:loader"
          class="w-8 h-8 mx-auto text-gray-400 animate-spin mb-4"
        />
        <p class="text-gray-600 dark:text-gray-400">
          {{ t('common.loading') }}
        </p>
      </div>
    </div>

    <!-- Main Content -->
    <div
      v-else-if="client"
      class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6"
    >
      <div
        v-if="isClientDataStale"
        class="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/60 dark:bg-amber-950/30"
      >
        <div class="flex items-center justify-between gap-3">
          <div class="text-sm text-amber-900 dark:text-amber-200">
            {{ t('contacts.staleClientBanner') || 'Данные клиента изменились в другом окне.' }}
          </div>
          <UButton
            size="xs"
            color="amber"
            variant="soft"
            icon="lucide:refresh-cw"
            @click="refreshStaleClientData"
          >
            {{ t('contacts.refreshUpdates') || 'Обновить' }}
          </UButton>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Left Column -->
        <div class="lg:col-span-2 space-y-6">
          <!-- Personal Info Section -->
          <ContactPersonalInfo
            :client="client"
            :edit-mode="personalInfoEditMode"
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
            :additional-info="getAdditionalInfoValue()"
            :editing-additional-info="editingAdditionalInfo"
            @start-edit="startEditPersonalInfo"
            @save-edit="savePersonalInfo"
            @cancel-edit="cancelEditPersonalInfo"
            @update-field="updatePersonalInfoField"
          />

          <!-- Identities Section -->
          <ContactIdentities
            :identities="identities"
            :identity-display-values="identityDisplayValues"
            :related-client-targets="relatedClientTargets"
            :edit-mode="identitiesEditMode"
            :editing-phones="editingPhones"
            :editing-emails="editingEmails"
            :editing-telegrams="editingTelegrams"
            :editing-whatsapps="editingWhatsapps"
            @start-edit="startEditIdentities"
            @save-edit="saveIdentities"
            @cancel-edit="cancelEditIdentities"
            @add-phone="addPhoneField"
            @remove-phone="removePhoneField"
            @add-email="addEmailField"
            @remove-email="removeEmailField"
            @add-telegram="addTelegramField"
            @remove-telegram="removeTelegramField"
            @add-whatsapp="addWhatsappField"
            @remove-whatsapp="removeWhatsappField"
            @update-phone="(idx, val) => editingPhones[idx] = val"
            @update-email="(idx, val) => editingEmails[idx] = val"
            @update-telegram="(idx, val) => editingTelegrams[idx] = val"
            @update-whatsapp="(idx, val) => editingWhatsapps[idx] = val"
            @phone-action="handlePhoneAction"
            @email-action="handleEmailAction"
            @telegram-action="handleTelegramAction"
            @whatsapp-action="handleWhatsappAction"
            @copy-to-clipboard="onCopyToClipboard"
            @navigate-related-client="openRelatedClient"
          />

          <!-- Loyalty Section -->
          <ContactLoyalty
            :bonus-balance="bonusBalance"
            :stamp-cards="stampCards"
            :stamp-progress="stampProgress"
            :contacts-token="contactsAppToken"
            :client-id="client?.client.id"
            :namespace="selectedNS || nsSlug"
            :created-by="createdByUserId"
            @bonus-earned="loadClient"
          />

          <!-- Tags Section -->
          <ContactTags
            :tags="tags"
            :client-id="client?.client.id"
            @open-tags-modal="isTagsModalOpen = true"
            @tag-added="loadClient"
            @tag-removed="loadClient"
          />

          <!-- Dynamic Fields Section -->
          <ContactDynamicFields
            :fields="dynamicFields"
            :drafts="dynamicFieldDrafts"
            :loading="dynamicFieldsLoading"
            :error="dynamicFieldsError"
            :saving="dynamicFieldsSaving"
            @save-all="saveDynamicFields"
            @update-draft="(fieldId, value) => dynamicFieldDrafts[fieldId] = value"
          />
        </div>

        <!-- Right Column - Timeline -->
        <div class="lg:col-span-1">
          <ContactTimeline
            :events="events"
            :tag-name-by-id="tagNameById"
            :dynamic-field-name-by-id="dynamicFieldNameById"
            :loading="loading"
            :has-more="hasMoreEvents"
            :loading-more="eventsLoadingMore"
            @load-more="loadMoreEvents"
          />
        </div>
      </div>
    </div>

    <!-- Tags Modal -->
    <TagsModal
      :is-open="isTagsModalOpen"
      mode="select"
      :client-id="client?.client.id"
      @close="isTagsModalOpen = false"
      @tag-added="loadClient"
    />
  </div>
</template>
