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
// Ring geometry (viewBox 80, stroke 9) and a per-instance gradient id (several cards can share a page).
const R = 34;
const C = 2 * Math.PI * R;
const gid = `su-${Math.random().toString(36).slice(2, 8)}`;
const ratio = computed(() => (usage.value && usage.value.limitBytes > 0 ? Math.min(1, usage.value.usedBytes / usage.value.limitBytes) : 0));
// Share of the ring that is filled; without a limit a thin sliver shows that something is stored.
const arc = computed(() => (usage.value && usage.value.limitBytes > 0 ? Math.max(0.02, ratio.value) : usage.value && usage.value.usedBytes > 0 ? 0.02 : 0));
const ringStroke = computed(() => (ratio.value >= 0.9 ? '#f43f5e' : ratio.value >= 0.7 ? '#f59e0b' : `url(#${gid})`));
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
  <div v-if="usage" class="at-panel !p-4">
    <div class="flex items-center gap-4">
      <!-- Doughnut: used share of the plan's quota (a plain ring when the plan has no limit). -->
      <div class="relative h-[5.5rem] w-[5.5rem] flex-shrink-0" role="img" :aria-label="`${t('common.storage.title')}: ${fmt(usage.usedBytes)}${usage.limitBytes > 0 ? ' / ' + fmt(usage.limitBytes) : ''}`">
        <svg viewBox="0 0 80 80" class="h-full w-full -rotate-90" aria-hidden="true">
          <defs>
            <linearGradient :id="gid" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#2563eb" />
              <stop offset="100%" stop-color="#10b981" />
            </linearGradient>
          </defs>
          <circle cx="40" cy="40" :r="R" fill="none" stroke-width="9" class="stroke-slate-100 dark:stroke-white/10" />
          <circle
            v-if="usage.limitBytes > 0 || usage.usedBytes > 0"
            cx="40"
            cy="40"
            :r="R"
            fill="none"
            stroke-width="9"
            stroke-linecap="round"
            :stroke="ringStroke"
            :stroke-dasharray="C"
            :stroke-dashoffset="C * (1 - arc)"
            style="transition: stroke-dashoffset 0.5s cubic-bezier(0.32, 0.72, 0, 1)"
          />
        </svg>
        <div class="absolute inset-0 flex flex-col items-center justify-center text-center leading-tight">
          <template v-if="usage.limitBytes > 0">
            <span class="text-lg font-extrabold tabular-nums text-gray-900 dark:text-white">{{ Math.round(ratio * 100) }}%</span>
          </template>
          <template v-else>
            <span class="text-sm font-extrabold tabular-nums text-gray-900 dark:text-white">{{ fmt(usage.usedBytes) }}</span>
          </template>
        </div>
      </div>

      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2">
          <Icon name="lucide:hard-drive" class="h-4 w-4 flex-shrink-0 text-slate-500" />
          <div class="at-h2 flex-1">{{ t('common.storage.title') }}</div>
        </div>
        <div class="mt-1 text-sm tabular-nums text-gray-900 dark:text-white">
          <span class="font-semibold">{{ fmt(usage.usedBytes) }}</span><span v-if="usage.limitBytes > 0" class="text-gray-400">&nbsp;/ {{ fmt(usage.limitBytes) }}</span>
        </div>
        <p class="at-hint">
          {{ usage.limitBytes > 0 ? t('common.storage.hint') : t('common.storage.unlimited') }} · {{ usage.files }} {{ t('common.storage.files') }}
        </p>
        <p v-if="usage.limitBytes > 0 && ratio >= 0.9" class="mt-1 text-xs font-medium text-rose-600">{{ t('common.storage.almostFull') }}</p>
      </div>
    </div>
  </div>
</template>
