<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import type { CoverageApprovalBanner } from '@/composables/useAtraceCoverageApprovalBanners';

const props = defineProps<{
  banners: CoverageApprovalBanner[];
}>();

const emit = defineEmits<{
  (e: 'dismiss', id: string): void;
}>();

const { t, locale } = useI18n();

function formatDate(date: string): string {
  try {
    return new Date(date).toLocaleDateString(locale.value === 'ru' ? 'ru-RU' : 'en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return date;
  }
}
</script>

<template>
  <div
    v-if="banners.length > 0"
    class="w-full flex flex-col gap-2 px-4 pt-4 flex-shrink-0"
  >
    <UAlert
      v-for="banner in banners"
      :key="banner.id"
      icon="lucide:check-circle-2"
      color="emerald"
      variant="soft"
      :close-button="{ icon: 'lucide:x', color: 'emerald', variant: 'link', padded: false }"
      :title="t('app.coverageApprovedTitle') || 'Подмена согласована'"
      :description="t('app.coverageApprovedDesc', { name: banner.coveringUserName, date: formatDate(banner.date) })
        || `Ваша подмена сотрудником ${banner.coveringUserName} на ${formatDate(banner.date)} успешно согласована.`"
      @close="emit('dismiss', banner.id)"
    />
  </div>
</template>
