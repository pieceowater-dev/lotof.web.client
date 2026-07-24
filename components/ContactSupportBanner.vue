<template>
  <div
    v-if="hasContact"
    class="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-blue-100 bg-blue-50/60 px-6 py-5 dark:border-blue-900/40 dark:bg-blue-950/20"
  >
    <div class="flex items-center gap-3 text-base font-medium text-blue-900 dark:text-blue-200">
      <Icon name="lucide:message-circle-question" class="h-6 w-6 flex-shrink-0" />
      <span>{{ t('billing.questionsContactUs') || 'Остались вопросы по тарифам? Мы на связи.' }}</span>
    </div>
    <div class="flex items-center gap-3">
      <a
        v-if="telHref"
        :href="telHref"
        class="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-50 dark:border-blue-800 dark:bg-slate-900 dark:text-blue-300 dark:hover:bg-slate-800"
      >
        <Icon name="lucide:phone" class="h-4 w-4" />
        {{ formattedPhone }}
      </a>
      <a
        v-if="whatsappHref"
        :href="whatsappHref"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-50 dark:border-emerald-800 dark:bg-slate-900 dark:text-emerald-300 dark:hover:bg-slate-800"
      >
        <Icon name="simple-icons:whatsapp" class="h-4 w-4" />
        WhatsApp
      </a>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useContactSettings } from '@/composables/useContactSettings';

const { t } = useI18n();
const { hasContact, telHref, whatsappHref, formattedPhone, load } = useContactSettings();

onMounted(() => {
  load();
});
</script>
