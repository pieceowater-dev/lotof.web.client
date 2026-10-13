<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { logError } from '@/utils/logger';
import { fetchStorageUsage, type StorageApp, type StorageUsage } from '@/api/storage/usage';

// Storage of the namespace in this app against the plan's quota. Hidden when
// the usage cannot be read (e.g. the gateway has not been updated yet).
const props = defineProps<{ app: StorageApp; nsSlug: string; getToken: () => string | undefined | null | Promise<string | undefined | null> }>();
const { t } = useI18n();

const usage = ref<StorageUsage | null>(null);
const ratio = computed(() => (usage.value && usage.value.limitBytes > 0 ? Math.min(1, usage.value.usedBytes / usage.value.limitBytes) : 0));
const fmt = (b: number) => (b >= 1073741824 ? `${(b / 1073741824).toFixed(2)} GB` : b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`);

onMounted(async () => {
  try {
    const token = await props.getToken();
    if (!token) return;
    usage.value = await fetchStorageUsage(props.app, token, props.nsSlug);
  } catch (e) {
    logError('[StorageUsageCard] load failed', e);
  }
});
</script>

<template>
  <div v-if="usage" class="at-panel !p-4 space-y-2">
    <div class="flex items-center gap-2">
      <Icon name="lucide:hard-drive" class="w-4 h-4 text-slate-500" />
      <div class="at-h2 flex-1">{{ t('common.storage.title') }}</div>
      <span class="text-sm tabular-nums">{{ fmt(usage.usedBytes) }}<template v-if="usage.limitBytes > 0"> / {{ fmt(usage.limitBytes) }}</template></span>
    </div>
    <div v-if="usage.limitBytes > 0" class="h-2 rounded-full bg-slate-100 dark:bg-white/10">
      <div class="h-2 rounded-full transition-all" :class="ratio >= 0.9 ? 'bg-rose-500' : ratio >= 0.7 ? 'bg-amber-500' : 'bg-accent-500'" :style="{ width: Math.max(2, ratio * 100) + '%' }" />
    </div>
    <p class="at-hint">
      {{ usage.limitBytes > 0 ? t('common.storage.hint') : t('common.storage.unlimited') }} · {{ usage.files }} {{ t('common.storage.files') }}
    </p>
    <p v-if="usage.limitBytes > 0 && ratio >= 0.9" class="text-xs font-medium text-rose-600">{{ t('common.storage.almostFull') }}</p>
  </div>
</template>
