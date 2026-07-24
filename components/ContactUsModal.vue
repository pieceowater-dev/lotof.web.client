<template>
  <Modal
    :model-value="isOpen"
    :header="t('billing.contactUsTitle') || 'Свяжитесь с командой lota'"
    @update:model-value="close"
  >
    <template #header>
      <div class="flex items-center gap-2">
        <Icon name="lucide:phone-call" class="h-5 w-5 text-blue-600 dark:text-blue-400" />
        <span>{{ t('billing.contactUsTitle') || 'Свяжитесь с командой lota' }}</span>
      </div>
    </template>

    <div class="space-y-4">
      <p class="text-gray-700 dark:text-gray-300">
        {{ t('billing.contactUsBody') || 'Оплата пока подключается вручную — напишите или позвоните нам, и мы включим тариф в течение дня.' }}
      </p>

      <div v-if="!hasContact" class="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-500 dark:bg-slate-800 dark:text-slate-400">
        {{ t('billing.contactUsNotConfigured') || 'Контакты пока не заполнены в админке.' }}
      </div>
      <div v-else class="flex flex-col gap-2">
        <a
          v-if="telHref"
          :href="telHref"
          class="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
          @click="() => trackContactClick('call')"
        >
          <Icon name="lucide:phone" class="h-4 w-4" />
          {{ t('billing.callUs') || 'Позвонить' }} {{ phone }}
        </a>
        <a
          v-if="whatsappHref"
          :href="whatsappHref"
          target="_blank"
          rel="noopener noreferrer"
          class="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
          @click="() => trackContactClick('whatsapp')"
        >
          <Icon name="simple-icons:whatsapp" class="h-4 w-4" />
          {{ t('billing.whatsappUs') || 'Написать в WhatsApp' }}
        </a>
      </div>
    </div>
  </Modal>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useContactUsModal } from '@/composables/useContactUsModal';
import { useContactSettings } from '@/composables/useContactSettings';

const { t } = useI18n();
const { isOpen, context, close } = useContactUsModal();
const { phone, whatsapp, hasContact, telHref, whatsappHref, load } = useContactSettings();

onMounted(() => {
  load();
});

function trackContactClick(channel: 'call' | 'whatsapp') {
  try {
    useAnalytics().track('contact_us_clicked', { channel, app: context.value?.app, plan: context.value?.planName });
  } catch {}
}
</script>
