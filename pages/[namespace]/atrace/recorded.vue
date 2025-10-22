<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { CookieKeys } from '@/utils/storageKeys';
const { t } = useI18n();

const router = useRouter();
const route = useRoute();

const ok = computed(() => {
  const v = (route.query.ok as string) || '0';
  return v === '1' || v.toLowerCase?.() === 'true';
});

function goHomeAndBurn() {
  try { useCookie(CookieKeys.ATRACE_TOKEN, { path: '/' }).value = null as any; } catch {}
  try { useCookie(CookieKeys.TOKEN, { path: '/' }).value = null as any; } catch {}
  router.push('/');
}

// Success countdown: 10s progress and auto-redirect home
const totalMs = 10000;
const leftMs = ref(totalMs);
const running = ref(false);
let timer: ReturnType<typeof setInterval> | null = null;

const progress = computed(() => Math.min(100, Math.max(0, ((totalMs - leftMs.value) / totalMs) * 100)));
const secondsLeft = computed(() => Math.ceil(leftMs.value / 1000));

function startCountdown() {
  if (running.value) return;
  running.value = true;
  const step = 100; // 0.1s steps
  timer = setInterval(() => {
    leftMs.value = Math.max(0, leftMs.value - step);
    if (leftMs.value <= 0) {
      stopCountdown();
      router.push('/');
    }
  }, step);
}

function stopCountdown() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  running.value = false;
}

onMounted(() => {
  if (ok.value) startCountdown();
});

onBeforeUnmount(() => {
  stopCountdown();
});
</script>

<template>
  <div class="min-h-[80vh] bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-950 flex items-center justify-center px-4">
    <UCard
      class="max-w-xl w-full shadow-lg"
      :ui="{ ring: '', divide: 'divide-y divide-gray-100 dark:divide-gray-800' }"
    >
      <template #header>
        <div class="flex items-center justify-between">
          <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">
            {{ t('app.atraceRecordedHeader') }}
          </h3>
        </div>
      </template>

      <div class="py-8 text-center">
        <template v-if="ok">
          <div class="flex flex-col items-center gap-4">
            <!-- Success icon -->
            <div class="h-16 w-16 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
              <svg class="h-10 w-10 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <p class="text-2xl font-bold text-emerald-600">{{ t('app.atraceRecordedSuccess') }}</p>

            <!-- Countdown progress -->
            <div class="w-full max-w-md mt-2">
              <div class="flex items-center justify-between mb-1 text-sm text-gray-500 dark:text-gray-400">
                <span>{{ t('app.atraceRecordedRedirecting') }} {{ secondsLeft }}s</span>
                <!-- <span>{{ Math.round(progress) }}%</span> -->
              </div>
              <div class="h-2 w-full bg-gray-200/70 dark:bg-gray-800 rounded-full overflow-hidden">
                <div class="h-full bg-emerald-500 transition-[width] duration-100 ease-linear" :style="{ width: progress + '%' }" />
              </div>
            </div>

            <div class="mt-4">
              <UButton color="primary" variant="outline" @click="router.push('/')">
                <UIcon name="i-heroicons-home" class="h-5 w-5 mr-2" />
                {{ t('app.home') }}
              </UButton>
            </div>
          </div>
        </template>
        <template v-else>
          <div class="flex flex-col items-center gap-4">
            <!-- Error icon -->
            <div class="h-16 w-16 rounded-full bg-red-50 dark:bg-red-900/30 flex items-center justify-center">
              <svg class="h-10 w-10 text-red-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
            </div>
            <p class="text-xl font-semibold text-red-600">{{ t('app.atraceRecordedFail') }}</p>
            <div class="mt-2">
              <UButton color="primary" variant="outline" @click="goHomeAndBurn">
                <UIcon name="i-heroicons-home" class="h-5 w-5 mr-2" />
                {{ t('app.home') }}
              </UButton>
            </div>
          </div>
        </template>
      </div>
    </UCard>
  </div>
</template>
