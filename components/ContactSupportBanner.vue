<template>
  <div
    v-if="hasContact"
    class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3 dark:border-blue-900/40 dark:bg-blue-950/20"
  >
    <div class="flex items-center gap-2 text-sm text-blue-900 dark:text-blue-200">
      <Icon name="lucide:message-circle-question" class="h-4 w-4 flex-shrink-0" />
      <span>{{ t('billing.questionsContactUs') || 'Остались вопросы по тарифам? Мы на связи.' }}</span>
    </div>
    <div class="flex items-center gap-2">
      <a
        v-if="telHref"
        :href="telHref"
        class="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-50 dark:border-blue-800 dark:bg-slate-900 dark:text-blue-300 dark:hover:bg-slate-800"
      >
        <Icon name="lucide:phone" class="h-3.5 w-3.5" />
        {{ phone }}
      </a>
      <a
        v-if="whatsappHref"
        :href="whatsappHref"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-50 dark:border-emerald-800 dark:bg-slate-900 dark:text-emerald-300 dark:hover:bg-slate-800"
      >
        <Icon name="simple-icons:whatsapp" class="h-3.5 w-3.5" />
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
const { phone, hasContact, telHref, whatsappHref, load } = useContactSettings();

onMounted(() => {
  load();
});
</script>
