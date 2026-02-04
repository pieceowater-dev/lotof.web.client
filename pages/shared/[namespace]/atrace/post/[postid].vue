<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { log, logWarn } from '@/utils/logger';
import PinPrompt from '@/components/PinPrompt.vue';
import { useRoute } from 'vue-router';
import { useI18n } from '@/composables/useI18n';
import { dynamicLS } from '@/utils/storageKeys';

const { t } = useI18n();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);
// Nuxt provides param as 'postid' (all lowercase, no dash), fallback to others for robustness
const postId = computed(() => {
  return (
    (route.params.postid as string) ||
    (route.params['postid'] as string) ||
    (route.params.postId as string)
  );
});

const pinKey = computed(() => {
  if (nsSlug.value && postId.value) {
    return dynamicLS.atracePostPin(nsSlug.value, postId.value);
  }
  return '';
});
const pin = ref('');
const pinInput = ref('');
const pinError = ref('');
const showPinPrompt = ref(false);
const wakeLockSupported = ref(false);
const wakeLockActive = ref(false);
const wakeLockError = ref('');


function loadPin() {
  if (process.client && pinKey.value) {
    pin.value = localStorage.getItem(pinKey.value) || '';
  }
}
function savePin(val: string) {
  if (process.client && pinKey.value && nsSlug.value && postId.value) {
    log('savePin', 'key:', pinKey.value, 'val:', val, 'ns:', nsSlug.value, 'postId:', postId.value);
    localStorage.setItem(pinKey.value, val);
    pin.value = val;
  } else {
    logWarn('savePin: missing nsSlug or postId', nsSlug.value, postId.value);
  }
}
function clearPin() {
  if (process.client && pinKey.value) {
    localStorage.removeItem(pinKey.value);
    pin.value = '';
  }
}

function askPin() {
  showPinPrompt.value = true;
}
function handlePinSubmit(val: string) {
  savePin(val);
  pin.value = val;
  requestWakeLock();
}


watch([nsSlug, postId], () => {
  loadPin();
});


import CryptoJS from 'crypto-js';

// Server controls refresh interval - frontend doesn't set default
const REFRESH_INTERVAL = ref<number | null>(null);
const qrRefreshCountdownValue = ref(0);
const qrRefreshCountdown = computed(() => qrRefreshCountdownValue.value);
let qrCountdownTimer: any = null;
const nextRefreshAt = ref<number | null>(null);

function updateCountdown() {
  if (!nextRefreshAt.value || !REFRESH_INTERVAL.value) {
    qrRefreshCountdownValue.value = REFRESH_INTERVAL.value || 0;
    return;
  }
  const msLeft = Math.max(0, nextRefreshAt.value - Date.now());
  const secLeft = Math.max(0, Math.ceil(msLeft / 1000));
  qrRefreshCountdownValue.value = secLeft || 0;
}

function startCountdown() {
  if (qrCountdownTimer) clearInterval(qrCountdownTimer);
  updateCountdown();
  qrCountdownTimer = setInterval(updateCountdown, 1000);
}

const qrBase64 = ref('');
const qrError = ref('');
const qrPostTitle = ref('');
const qrPostAddress = ref('');
const polling = ref(false);
let sseSource: EventSource | null = null;
let sseRetryTimer: ReturnType<typeof setTimeout> | null = null;
let sseRetryAttempt = 0;
const SSE_MAX_DELAY_MS = 30000;
let sseWatchdogTimer: any = null;
let lastSseAt = 0;
let sseEnabled = true;
let sseReconnectTimer: any = null; // Periodic reconnect to clean up server resources
const SSE_RECONNECT_INTERVAL = 60000; // Reconnect every 60 seconds to ensure old connections close

function computeWatchdogMs() {
  return ((REFRESH_INTERVAL.value || 5) * 2 + 5) * 1000;
}

function scheduleSseRetry() {
  if (!process.client) return;
  if (!sseEnabled) return;
  if (sseRetryTimer) return;
  if (document.visibilityState === 'hidden') return;
  const delay = Math.min(1000 * Math.pow(2, sseRetryAttempt), SSE_MAX_DELAY_MS);
  sseRetryAttempt += 1;
  sseRetryTimer = setTimeout(() => {
    sseRetryTimer = null;
    startSse();
  }, delay);
}

function resetSseRetry() {
  sseRetryAttempt = 0;
  if (sseRetryTimer) {
    clearTimeout(sseRetryTimer);
    sseRetryTimer = null;
  }
}

function stopSse() {
  if (sseSource) {
    console.log('[SSE] Closing EventSource');
    try { sseSource.close(); } catch {}
    sseSource = null;
  }
  resetSseRetry();
  if (sseWatchdogTimer) {
    clearInterval(sseWatchdogTimer);
    sseWatchdogTimer = null;
  }
  if (sseReconnectTimer) {
    clearTimeout(sseReconnectTimer);
    sseReconnectTimer = null;
  }
}

function startSse() {
  if (!process.client) return;
  if (!sseEnabled) {
    console.log('[SSE] startSse called but sseEnabled=false, ignoring');
    return;
  }
  stopSse();
  if (!pin.value || !postId.value || !nsSlug.value) {
    logWarn('startSse: missing pin, postId, or nsSlug', pin.value, postId.value, nsSlug.value);
    return;
  }

  polling.value = true;
  qrError.value = '';
  const secret = CryptoJS.MD5(pin.value).toString();
  // Use Nuxt server proxy to atrace gateway SSE (server determines refresh interval)
  const url = `/api/atrace/qr/stream?namespace=${encodeURIComponent(nsSlug.value)}&postId=${encodeURIComponent(postId.value)}&method=METHOD_QR&secret=${encodeURIComponent(secret)}`;
  console.log('[SSE] Creating new EventSource:', url);
  sseSource = new EventSource(url);

  lastSseAt = Date.now();
  if (!sseWatchdogTimer) {
    sseWatchdogTimer = setInterval(() => {
      if (!sseSource) return;
      if (Date.now() - lastSseAt > computeWatchdogMs()) {
        try { sseSource.close(); } catch {}
        sseSource = null;
        scheduleSseRetry();
      }
    }, 5000);
  }

  sseSource.addEventListener('qr', (ev: MessageEvent) => {
    try {
      const data = JSON.parse(ev.data || '{}');
      if (data?.qr) {
        lastSseAt = Date.now();
        
        // Update interval from server if provided
        if (data.refreshInterval && typeof data.refreshInterval === 'number') {
          REFRESH_INTERVAL.value = data.refreshInterval;
        }
        
        qrBase64.value = data.qr;
        qrPostTitle.value = data.postTitle || '';
        qrPostAddress.value = data.postFullAddress || '';
        qrError.value = '';
        polling.value = false;
        nextRefreshAt.value = Date.now() + (REFRESH_INTERVAL.value || 5) * 1000;
        updateCountdown();
        resetSseRetry();
      }
    } catch (e) {
      logWarn('SSE parse error', e as any);
    }
  });

  sseSource.addEventListener('error', () => {
    if (!qrBase64.value) polling.value = false;
    qrError.value = t('app.loading') || 'Loading...';
    lastSseAt = Date.now();
    try { sseSource?.close(); } catch {}
    sseSource = null;
    scheduleSseRetry();
  });

  // Schedule periodic reconnect to clean up server resources
  // This ensures old server connections don't stay alive when client closes tab
  if (sseReconnectTimer) clearTimeout(sseReconnectTimer);
  sseReconnectTimer = setTimeout(() => {
    if (!sseEnabled) return;
    console.log('[SSE] Periodic reconnect to clean up server resources');
    startSse(); // This will close old connection and create new one
  }, SSE_RECONNECT_INTERVAL);
}

watch(pin, (val) => {
  if (val) startSse();
  else stopSse();
});

onMounted(() => {
  loadPin();
  if (!pin.value) askPin();
  else startSse();
});

onBeforeUnmount(() => {
  sseEnabled = false;
  stopSse();
});

if (process.client) {
  const onVisibility = () => {
    if (!sseEnabled) return;
    if (document.visibilityState === 'visible') {
      if (!sseSource) {
        scheduleSseRetry();
      }
      // Re-request wake lock when page becomes visible
      requestWakeLock();
    }
  };
  document.addEventListener('visibilitychange', onVisibility);

  onBeforeUnmount(() => {
    document.removeEventListener('visibilitychange', onVisibility);
  });
}

const nowTime = ref('');
let clockTimer: any = null;
function updateClock() {
  nowTime.value = new Date().toLocaleTimeString();
}

// Wake Lock API to keep screen awake
let wakeLock: any = null;

async function requestWakeLock() {
  if (!process.client) return;
  try {
    wakeLockSupported.value = 'wakeLock' in navigator;
    if (wakeLockSupported.value) {
      wakeLock = await (navigator as any).wakeLock.request('screen');
      wakeLockActive.value = true;
      wakeLockError.value = '';
      log('[WakeLock] Screen wake lock activated');
      
      wakeLock.addEventListener('release', () => {
        wakeLockActive.value = false;
        log('[WakeLock] Screen wake lock released');
      });
    }
  } catch (err: any) {
    wakeLockActive.value = false;
    wakeLockError.value = err?.message || 'Wake lock failed';
    logWarn('[WakeLock] Failed to activate:', err.message);
  }
}

async function releaseWakeLock() {
  if (wakeLock) {
    try {
      await wakeLock.release();
      wakeLock = null;
      wakeLockActive.value = false;
    } catch (err) {
      logWarn('[WakeLock] Failed to release:', err);
    }
  }
}

onMounted(() => {
  log('[DEBUG] route.params:', JSON.stringify(route.params));
  startCountdown();
  updateClock();
  clockTimer = setInterval(updateClock, 1000);
  requestWakeLock();
});

onBeforeUnmount(() => {
  if (qrCountdownTimer) clearInterval(qrCountdownTimer);
  if (clockTimer) clearInterval(clockTimer);
  if (sseRetryTimer) clearTimeout(sseRetryTimer);
  releaseWakeLock();
});

</script>

<template>
  <div class="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
    <div class="w-full max-w-md bg-white/80 dark:bg-gray-900/80 rounded-2xl shadow-xl p-6 flex flex-col items-center">
      <h1 class="text-xl font-semibold mb-2 text-blue-900 dark:text-white flex flex-col items-center justify-center w-full">
        <span class="flex items-center justify-center w-full gap-2">
          <UIcon name="i-lucide-qr-code" class="w-7 h-7 text-blue-500 dark:text-blue-300" />
          <span>{{ t('app.atraceTitle') }}</span>
        </span>
      </h1>
      <p class="text-base text-gray-700 dark:text-gray-200 text-center mb-4">
        {{ t('app.publicPostInstruction') || 'Сканируй QR ниже, чтобы отметить свое посещение!' }}
      </p>
      <div v-if="!pin" class="w-full flex flex-col items-center">
        <UButton color="primary" icon="i-lucide-key" class="w-full" @click="askPin">{{ t('app.enterPin') || 'Enter PIN' }}</UButton>
      </div>
      <PinPrompt
        v-model="showPinPrompt"
        :title="t('app.enterPin') || 'Enter PIN'"
        :description="t('app.pinPromptDesc') || 'Enter the 6-digit PIN for this post. The PIN was shown to the post creator and is required to view this page.'"
        :error-text="t('app.pinMustBe6Digits') || 'PIN must be 6 digits'"
        @submit="handlePinSubmit"
      />
      <div v-if="pin" class="w-full flex flex-col items-center">
        <div class="flex flex-col items-center justify-center w-full my-6">
          <div v-if="qrBase64" class="flex flex-col items-center justify-center w-full">
            <div class="mb-2 text-center">
              <div v-if="qrPostTitle" class="font-semibold text-lg">{{ qrPostTitle }}</div>
              <div v-if="qrPostAddress" class="text-sm text-gray-500">{{ qrPostAddress }}</div>
            </div>
            <div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 flex items-center justify-center" style="min-width:180px; min-height:180px;">
              <img :src="`data:image/png;base64,${qrBase64}`" alt="QR" class="qr-image w-full max-w-xs h-auto aspect-square object-contain" style="max-width:320px; min-width:120px;" />
            </div>
          </div>
          <div v-else-if="polling" class="text-blue-500 dark:text-blue-300 mt-4 flex items-center gap-2">
            <i class="i-lucide-loader animate-spin"></i>
            {{ t('app.loading') || 'Loading...' }}
          </div>
          <div v-else-if="qrError" class="text-red-500 mt-4">{{ qrError }}</div>
          <ClientOnly>
            <div class="text-xs text-gray-500 mt-2 text-center">QR обновится через {{ qrRefreshCountdown }}с.</div>
            <div class="text-xs text-gray-500 mt-1 text-center flex items-center justify-center gap-2">
              <i class="i-lucide-clock"></i>
              <span>{{ nowTime }}</span>
            </div>
            <div v-if="wakeLockSupported" class="text-xs mt-2 text-center">
              <span v-if="wakeLockActive" class="text-emerald-600">Экран не будет гаснуть</span>
              <span v-else class="text-amber-600">Экран может гаснуть</span>
            </div>
            <div v-if="wakeLockSupported && !wakeLockActive" class="mt-2">
              <UButton size="xs" variant="soft" color="primary" @click="requestWakeLock">Включить удержание экрана</UButton>
            </div>
            <div v-if="wakeLockError" class="text-xs text-red-500 mt-1 text-center">{{ wakeLockError }}</div>
          </ClientOnly>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dark .qr-image {
  filter: invert(0.8) hue-rotate(180deg);
}
</style>
