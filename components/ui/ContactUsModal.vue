<template>
  <Modal
    :model-value="isOpen"
    :header="t('billing.contactUsTitle') || 'Свяжитесь с командой lota'"
    @update:model-value="close"
  >
    <template #header>
      <div class="flex items-center gap-3">
        <span class="icon-tile !h-10 !w-10 !rounded-[0.9rem]"><Icon name="lucide:phone-call" class="h-5 w-5" /></span>
        <span>{{ t('billing.contactUsTitle') || 'Свяжитесь с командой lota' }}</span>
      </div>
    </template>

    <div class="space-y-4">
      <p class="text-gray-700 dark:text-gray-300">
        {{ t('billing.contactUsBody') || 'Оплата пока подключается вручную — напишите или позвоните нам, и мы включим тариф в течение дня.' }}
      </p>

      <div v-if="!hasContact" class="at-banner text-sm">
        {{ t('billing.contactUsNotConfigured') || 'Контакты пока не заполнены в админке.' }}
      </div>
      <div v-else class="flex flex-col gap-2">
        <a
          v-if="telHref"
          :href="telHref"
          class="at-btn at-btn--primary w-full !py-2.5"
          @click="() => trackContactClick('call')"
        >
          <Icon name="lucide:phone" class="h-4 w-4" />
          {{ t('billing.callUs') || 'Позвонить' }} {{ formattedPhone }}
        </a>
        <a
          v-if="whatsappHref"
          :href="whatsappHref"
          target="_blank"
          rel="noopener noreferrer"
          class="at-btn w-full !py-2.5 !text-white" style="background: #25d366"
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
import Modal from '@/components/ui/Modal.vue';
import { useContactUsModal } from '@/composables/useContactUsModal';
import { useContactSettings } from '@/composables/useContactSettings';

const { t } = useI18n();
const { isOpen, context, close } = useContactUsModal();
const { hasContact, telHref, whatsappHref, formattedPhone, load } = useContactSettings();

onMounted(() => {
  load();
});

function trackContactClick(channel: 'call' | 'whatsapp') {
  try {
    useAnalytics().track('contact_us_clicked', { channel, app: context.value?.app, plan: context.value?.planName });
  } catch {}
}
</script>
