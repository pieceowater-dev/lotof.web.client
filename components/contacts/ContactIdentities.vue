<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';
import type { ClientIdentity } from '@/api/contacts/identities';

interface Props {
  identities: ClientIdentity[];
  identityDisplayValues?: Record<string, string>;
  editMode?: boolean;
  editingPhones?: string[];
  editingEmails?: string[];
  loading?: boolean;
}

interface Emits {
  startEdit: [];
  saveEdit: [];
  cancelEdit: [];
  addPhone: [];
  removePhone: [index: number];
  addEmail: [];
  removeEmail: [index: number];
  updatePhone: [index: number, value: string];
  updateEmail: [index: number, value: string];
  phoneAction: [phone: string];
  emailAction: [email: string];
  telegramAction: [handle: string];
  whatsappAction: [phone: string];
  copyToClipboard: [text: string];
}

const props = withDefaults(defineProps<Props>(), {
  editMode: false,
  editingPhones: () => [],
  editingEmails: () => [],
  loading: false,
});

const emit = defineEmits<Emits>();
const { t } = useI18n();
const copiedIdentityId = ref<string | null>(null);
let copiedTimeout: ReturnType<typeof setTimeout> | null = null;

function getDisplayValue(identity: ClientIdentity): string {
  return props.identityDisplayValues?.[identity.id] || identity.value;
}

function handleCopy(identity: ClientIdentity) {
  emit('copyToClipboard', getDisplayValue(identity));
  copiedIdentityId.value = identity.id;

  if (copiedTimeout) clearTimeout(copiedTimeout);
  copiedTimeout = setTimeout(() => {
    copiedIdentityId.value = null;
  }, 1500);
}

onBeforeUnmount(() => {
  if (copiedTimeout) clearTimeout(copiedTimeout);
});

function getIdentityIcon(type: string): string {
  const iconMap: Record<string, string> = {
    phone: 'i-heroicons-phone',
    email: 'i-heroicons-envelope',
    telegram: 'i-heroicons-paper-airplane',
    whatsapp: 'i-heroicons-chat-bubble-left-right',
    website: 'i-heroicons-globe-alt',
  };
  return iconMap[type] || 'i-heroicons-link';
}

function getIdentityTypeLabel(type: string): string {
  const keyMap: Record<string, string> = {
    phone: 'contacts.phone',
    email: 'contacts.email',
    telegram: 'contacts.telegram',
    whatsapp: 'contacts.whatsapp',
    website: 'contacts.website',
  };
  const key = keyMap[type];
  return key ? (t(key) || type) : type;
}
</script>

<template>
  <div v-if="identities.length > 0" class="bg-white dark:bg-gray-800 rounded-lg shadow ring-1 ring-gray-200 dark:ring-gray-700 overflow-hidden">
    <!-- Header -->
    <div class="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <UIcon name="i-heroicons-phone" class="w-5 h-5 text-violet-600 dark:text-violet-400" />
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('contacts.identities') }}</h2>
      </div>
      <div class="flex gap-2">
        <UButton
          v-if="!editMode"
          icon="i-heroicons-pencil"
          size="xs"
          color="gray"
          variant="ghost"
          @click="() => emit('startEdit')"
        />
        <template v-else>
          <UButton size="xs" color="primary" variant="soft" @click="() => emit('saveEdit')">{{ t('common.save') }}</UButton>
          <UButton size="xs" color="gray" variant="ghost" @click="() => emit('cancelEdit')">{{ t('common.cancel') }}</UButton>
        </template>
      </div>
    </div>

    <!-- Content -->
    <div class="px-5 py-5">
      <template v-if="!editMode">
        <div class="space-y-2">
          <div
            v-for="identity in identities"
            :key="identity.id"
            class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <div class="flex items-center gap-3 flex-1 min-w-0">
              <div class="h-8 w-8 rounded-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 flex items-center justify-center flex-shrink-0">
                <UIcon :name="getIdentityIcon(identity.type)" class="w-4 h-4 text-gray-500 dark:text-gray-300" />
              </div>
              <div class="min-w-0">
                <p class="text-xs text-gray-500 dark:text-gray-400">{{ getIdentityTypeLabel(identity.type) }}</p>
                <p :class="['text-sm text-gray-900 dark:text-white truncate', identity.isPrimary ? 'font-bold' : 'font-medium']">
                  {{ getDisplayValue(identity) }}
                </p>
              </div>
            </div>
            <div class="flex items-center gap-1 flex-shrink-0">
              <UButton
                v-if="identity.type === 'phone'"
                icon="i-heroicons-phone"
                size="xs"
                color="blue"
                variant="soft"
                :title="t('contacts.call') || 'Позвонить'"
                @click="() => emit('phoneAction', identity.value)"
                class="h-8 w-8 p-0 justify-center"
              />
              <UButton
                v-else-if="identity.type === 'email'"
                icon="i-heroicons-envelope"
                size="xs"
                color="blue"
                variant="soft"
                :title="t('contacts.sendEmail') || 'Написать email'"
                @click="() => emit('emailAction', identity.value)"
                class="h-8 w-8 p-0 justify-center"
              />
              <UButton
                v-else-if="identity.type === 'telegram'"
                icon="i-heroicons-paper-airplane"
                size="xs"
                color="blue"
                variant="soft"
                :title="t('contacts.openTelegram') || 'Открыть Telegram'"
                @click="() => emit('telegramAction', identity.value.replace(/^@/, ''))"
                class="h-8 w-8 p-0 justify-center"
              />
              <UButton
                v-else-if="identity.type === 'whatsapp'"
                icon="i-heroicons-chat-bubble-left-right"
                size="xs"
                color="green"
                variant="soft"
                :title="t('contacts.openWhatsApp') || 'Открыть WhatsApp'"
                @click="() => emit('whatsappAction', identity.value)"
                class="h-8 w-8 p-0 justify-center"
              />
              <UButton
                :icon="copiedIdentityId === identity.id ? 'i-heroicons-check' : 'i-heroicons-clipboard-document'"
                size="xs"
                color="gray"
                :variant="copiedIdentityId === identity.id ? 'soft' : 'ghost'"
                @click="() => handleCopy(identity)"
                class="h-8 w-8 p-0 justify-center"
                :title="copiedIdentityId === identity.id ? t('contacts.copied') : t('contacts.copy')"
              />
            </div>
          </div>
        </div>
      </template>

      <template v-else>
        <form class="space-y-6">
          <!-- Phones -->
          <div class="space-y-2">
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-phone" class="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('contacts.phones') }}</label>
            </div>
            
            <div v-for="(phone, idx) in editingPhones" :key="`phone-${idx}`" class="flex gap-2">
              <UFormGroup :label="''" class="flex-1">
                <UInput
                  :model-value="phone"
                  type="tel"
                  :placeholder="idx === 0 ? t('contacts.primaryNumber') + ' *' : t('contacts.additionalNumber')"
                  size="md"
                  @update:model-value="$emit('updatePhone', idx, $event)"
                />
              </UFormGroup>
              <UButton
                icon="i-heroicons-trash"
                color="red"
                variant="ghost"
                size="md"
                @click="() => $emit('removePhone', idx)"
                :disabled="editingPhones.length === 1"
                style="margin-top: 0"
              />
            </div>

            <UButton
              v-if="editingPhones.length < 5"
              icon="i-heroicons-plus"
              variant="outline"
              color="blue"
              size="sm"
              @click="() => $emit('addPhone')"
            >
              {{ t('contacts.addPhone') }}
            </UButton>
          </div>

          <!-- Emails -->
          <div class="space-y-2 pt-4">
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-envelope" class="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('contacts.emails') }}</label>
            </div>
            
            <div v-for="(email, idx) in editingEmails" :key="`email-${idx}`" class="flex gap-2">
              <UFormGroup :label="''" class="flex-1">
                <UInput
                  :model-value="email"
                  type="email"
                  placeholder="example@email.com"
                  size="md"
                  @update:model-value="$emit('updateEmail', idx, $event)"
                />
              </UFormGroup>
              <UButton
                v-if="editingEmails.length > 0"
                icon="i-heroicons-trash"
                color="red"
                variant="ghost"
                size="md"
                @click="() => $emit('removeEmail', idx)"
                style="margin-top: 0"
              />
            </div>

            <UButton
              v-if="editingEmails.length < 5"
              icon="i-heroicons-plus"
              variant="outline"
              color="blue"
              size="sm"
              @click="() => $emit('addEmail')"
            >
              {{ t('contacts.addEmail') }}
            </UButton>
          </div>
        </form>
      </template>
    </div>
  </div>
</template>
