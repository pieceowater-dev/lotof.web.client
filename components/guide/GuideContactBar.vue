<template>
  <div
    v-if="phone || whatsapp"
    :class="variant === 'bar'
      ? 'mx-5 mb-5 rounded-2xl bg-gray-900/[0.04] px-4 py-3 dark:bg-white/[0.06]'
      : 'rounded-3xl px-5 py-4 sm:px-6 sm:py-5 bg-gray-900/[0.03] shadow-[inset_0_0_0_1px_rgba(15,23,42,0.07)] dark:bg-white/[0.04] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]'"
  >
    <p class="mb-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
      {{ t('guide.stillHaveQuestions') }}
    </p>
    <div class="flex flex-wrap gap-4 text-sm">
      <a
        v-if="phone"
        :href="`tel:${phone.replace(/\s+/g, '')}`"
        class="inline-flex items-center gap-1.5 font-semibold text-gray-700 hover:text-blue-600 dark:text-gray-200 dark:hover:text-blue-300"
      >
        <UIcon name="lucide:phone" class="h-4 w-4" />
        {{ phone }}
      </a>
      <a
        v-if="whatsapp"
        :href="`https://wa.me/${whatsapp.replace(/\D/g, '')}`"
        target="_blank"
        rel="noopener"
        class="inline-flex items-center gap-1.5 font-semibold text-gray-700 hover:text-blue-600 dark:text-gray-200 dark:hover:text-blue-300"
      >
        <UIcon name="lucide:message-circle" class="h-4 w-4" />
        WhatsApp
      </a>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useAuth } from '@/composables/useAuth';
import { capitalGetContactSettings } from '@/api/capital/admin';

withDefaults(defineProps<{ variant?: 'bar' | 'card' }>(), { variant: 'bar' });

const { t } = useI18n();
const { token } = useAuth();

const phone = ref('');
const whatsapp = ref('');

onMounted(async () => {
  // contactSettings is public -- the Гид must work fully without
  // authorization, including for anonymous visitors on /guide. token is
  // passed along when we happen to have one, but isn't required.
  try {
    const settings = await capitalGetContactSettings(token.value);
    phone.value = settings?.phone || '';
    whatsapp.value = settings?.whatsapp || '';
  } catch {
    // Non-fatal -- the bar simply doesn't render.
  }
});
</script>
