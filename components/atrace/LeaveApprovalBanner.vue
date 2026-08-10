<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import type { LeaveApprovalBanner } from '@/composables/useAtraceLeaveApprovalBanners';

const props = defineProps<{
  banners: LeaveApprovalBanner[];
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

function typeLabel(type: string): string {
  return type === 'vacation' ? (t('app.leaveTypeVacation') || 'Отпуск') : (t('app.leaveTypeDayOff') || 'Отгул');
}

function rangeLabel(banner: LeaveApprovalBanner): string {
  return banner.startDate === banner.endDate
    ? formatDate(banner.startDate)
    : `${formatDate(banner.startDate)} — ${formatDate(banner.endDate)}`;
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
      :title="t('app.leaveApprovedTitle') || 'Заявка согласована'"
      :description="t('app.leaveApprovedDesc', { type: typeLabel(banner.type), range: rangeLabel(banner) })
        || `Ваш(а) ${typeLabel(banner.type).toLowerCase()} на ${rangeLabel(banner)} успешно согласован(а).`"
      @close="emit('dismiss', banner.id)"
    />
  </div>
</template>
