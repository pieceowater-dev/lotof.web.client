// Client-page personal-info edit mode: draft fields + save. Consumed by ContactPersonalInfo.vue.
import { ref, type Ref } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useContactsToken } from '@/composables/useContactsToken';
import { logError } from '@/utils/logger';
import { contactsUpdateIndividualClient, contactsUpdateLegalEntityClient } from '@/api/contacts/mutations';
import { createIdentity, updateIdentity, type ClientIdentity } from '@/api/contacts/identities';
import type { ClientRow } from '@/api/contacts/listClients';

export interface UseClientPersonalInfoEditDeps {
  client: Ref<ClientRow | null>;
  identities: Ref<ClientIdentity[]>;
  token: Ref<string | null | undefined>;
  selectedNS: Ref<string | undefined>;
  markLocalMutation: () => void;
  loadClient: () => Promise<void>;
}

export function useClientPersonalInfoEdit(deps: UseClientPersonalInfoEditDeps) {
  const { t } = useI18n();
  const toast = useToast();

  const editMode = ref(false);
  const backupClient = ref<ClientRow | null>(null);

  const editingFirstName = ref('');
  const editingLastName = ref('');
  const editingMiddleName = ref('');
  const editingBirthDate = ref('');
  const editingGender = ref<boolean | null>(null);
  const editingLegalName = ref('');
  const editingBrandName = ref('');
  const editingBinIin = ref('');
  const editingRegistrationCountry = ref('');
  const editingRegistrationDate = ref('');
  const editingAdditionalInfo = ref('');

  function getPreferredIdentityForAdditionalInfo(): ClientIdentity | undefined {
    return deps.identities.value.find((item) => item.type === 'phone' && item.isPrimary)
      || deps.identities.value.find((item) => item.type === 'phone')
      || deps.identities.value.find((item) => item.isPrimary)
      || deps.identities.value[0];
  }

  function getAdditionalInfoValue(): string {
    return getPreferredIdentityForAdditionalInfo()?.comments?.trim() || deps.client.value?.additionalInfo?.trim() || '';
  }

  function startEditPersonalInfo() {
    if (!deps.client.value) return;

    backupClient.value = JSON.parse(JSON.stringify(deps.client.value));

    if (deps.client.value.individual) {
      editingFirstName.value = deps.client.value.individual.firstName;
      editingLastName.value = deps.client.value.individual.lastName;
      editingMiddleName.value = deps.client.value.individual.middleName || '';
      editingBirthDate.value = deps.client.value.individual.birthDate
        ? new Date(deps.client.value.individual.birthDate).toISOString().split('T')[0]
        : '';
      editingGender.value = deps.client.value.individual.gender !== undefined ? deps.client.value.individual.gender : null;
    } else if (deps.client.value.legalEntity) {
      editingLegalName.value = deps.client.value.legalEntity.legalName;
      editingBrandName.value = deps.client.value.legalEntity.brandName || '';
      editingBinIin.value = deps.client.value.legalEntity.binIin || '';
      editingRegistrationCountry.value = deps.client.value.legalEntity.registrationCountry || '';
      editingRegistrationDate.value = deps.client.value.legalEntity.registrationDate
        ? new Date(deps.client.value.legalEntity.registrationDate).toISOString().split('T')[0]
        : '';
    }
    editingAdditionalInfo.value = getAdditionalInfoValue();

    editMode.value = true;
  }

  function cancelEditPersonalInfo() {
    editMode.value = false;
    backupClient.value = null;
  }

  async function savePersonalInfo() {
    if (!deps.client.value) return;
    if (!deps.token.value || !deps.selectedNS.value) return;

    try {
      const { ensure } = useContactsToken();
      const contactsToken = await ensure(deps.selectedNS.value, deps.token.value);
      if (!contactsToken) return;

      if (deps.client.value.individual) {
        await contactsUpdateIndividualClient(contactsToken, deps.selectedNS.value, deps.client.value.client.id, {
          firstName: editingFirstName.value.trim(),
          lastName: editingLastName.value.trim(),
          middleName: editingMiddleName.value.trim() || undefined,
          birthDate: editingBirthDate.value || undefined,
          gender: editingGender.value,
        });
      } else if (deps.client.value.legalEntity) {
        await contactsUpdateLegalEntityClient(contactsToken, deps.selectedNS.value, deps.client.value.client.id, {
          legalName: editingLegalName.value.trim(),
          brandName: editingBrandName.value.trim() || undefined,
          binIin: editingBinIin.value.trim() || undefined,
          registrationCountry: editingRegistrationCountry.value.trim() || undefined,
          registrationDate: editingRegistrationDate.value || undefined,
        });
      }

      const additionalInfo = editingAdditionalInfo.value.trim();
      const identityForInfo = getPreferredIdentityForAdditionalInfo();
      if (identityForInfo) {
        const currentComments = identityForInfo.comments?.trim() || '';
        if (currentComments !== additionalInfo) {
          await updateIdentity(
            contactsToken,
            deps.selectedNS.value,
            identityForInfo.id,
            identityForInfo.value,
            additionalInfo,
          );
        }
      } else if (additionalInfo) {
        // Persist additional info even when client has no existing identities.
        await createIdentity(
          contactsToken,
          deps.selectedNS.value,
          deps.client.value.client.id,
          'company',
          deps.client.value.client.shortId || deps.client.value.client.id,
          false,
          additionalInfo,
        );
      }

      editMode.value = false;
      deps.markLocalMutation();
      await deps.loadClient();
      toast.add({
        title: t('common.success'),
        description: t('contacts.clientDataUpdated'),
        color: 'emerald',
      });
    } catch (error) {
      logError('Failed to save personal info:', error);
      toast.add({
        title: t('common.error'),
        description: t('contacts.updateError'),
        color: 'red',
      });
    }
  }

  // Single handler bound to ContactPersonalInfo's @update-field, preserving
  // that component's existing emit contract: (field: string, value) => void.
  function updateField(field: string, value: string | boolean | null) {
    if (field === 'firstName') editingFirstName.value = value as string;
    if (field === 'lastName') editingLastName.value = value as string;
    if (field === 'middleName') editingMiddleName.value = value as string;
    if (field === 'birthDate') editingBirthDate.value = value as string;
    if (field === 'gender') editingGender.value = value as (boolean | null);
    if (field === 'legalName') editingLegalName.value = value as string;
    if (field === 'brandName') editingBrandName.value = value as string;
    if (field === 'binIin') editingBinIin.value = value as string;
    if (field === 'registrationCountry') editingRegistrationCountry.value = value as string;
    if (field === 'registrationDate') editingRegistrationDate.value = value as string;
    if (field === 'additionalInfo') editingAdditionalInfo.value = value as string;
  }

  return {
    editMode,
    editingFirstName,
    editingLastName,
    editingMiddleName,
    editingBirthDate,
    editingGender,
    editingLegalName,
    editingBrandName,
    editingBinIin,
    editingRegistrationCountry,
    editingRegistrationDate,
    editingAdditionalInfo,
    getAdditionalInfoValue,
    getPreferredIdentityForAdditionalInfo,
    startEditPersonalInfo,
    cancelEditPersonalInfo,
    savePersonalInfo,
    updateField,
  };
}
