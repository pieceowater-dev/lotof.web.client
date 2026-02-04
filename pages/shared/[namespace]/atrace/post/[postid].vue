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
let ws: WebSocket | null = null;
let wsRetryTimer: ReturnType<typeof setTimeout> | null = null;
let wsRetryAttempt = 0;
const WS_MAX_DELAY_MS = 30000;
let wsWatchdogTimer: any = null;
let lastWsAt = 0;
let wsEnabled = true;
let isHydrated = false;

function computeWatchdogMs() {
  return ((REFRESH_INTERVAL.value || 5) * 2 + 5) * 1000;
}

function scheduleWsRetry() {
  if (!process.client) return;
  if (!wsEnabled) return;
  if (wsRetryTimer) return;
  if (document.visibilityState === 'hidden') return;
  const delay = Math.min(1000 * Math.pow(2, wsRetryAttempt), WS_MAX_DELAY_MS);
  wsRetryAttempt += 1;
  wsRetryTimer = setTimeout(() => {
    wsRetryTimer = null;
    startWs();
  }, delay);
}

function resetWsRetry() {
  wsRetryAttempt = 0;
  if (wsRetryTimer) {
    clearTimeout(wsRetryTimer);
    wsRetryTimer = null;
  }
}

function stopWs() {
  if (ws) {
    console.log('[WS] Closing WebSocket');
    try { 
      ws.close(); 
    } catch {}
    ws = null;
  }
  resetWsRetry();
  if (wsWatchdogTimer) {
    clearInterval(wsWatchdogTimer);
    wsWatchdogTimer = null;
  }
}

function startWs() {
  if (!process.client) return;
  if (!wsEnabled) {
    console.log('[WS] startWs called but wsEnabled=false, ignoring');
    return;
  }
  stopWs();
  if (!pin.value || !postId.value || !nsSlug.value) {
    logWarn('startWs: missing pin, postId, or nsSlug', pin.value, postId.value, nsSlug.value);
    return;
  }

  polling.value = true;
  qrError.value = '';
  const secret = CryptoJS.MD5(pin.value).toString();
  
  // Build WebSocket URL - connect directly to backend gateway
  const atraceApiUrl = import.meta.env.VITE_API_ATRACE || 'http://localhost:8081';
  const protocol = atraceApiUrl.startsWith('https') ? 'wss:' : 'ws:';
  const host = atraceApiUrl.replace(/^https?:\/\//, '');
  const wsUrl = `${protocol}//${host}/api/v1/atrace/qr/stream?namespace=${encodeURIComponent(nsSlug.value)}&postId=${encodeURIComponent(postId.value)}&method=METHOD_QR&secret=${encodeURIComponent(secret)}`;
  
  console.log('[WS] Creating new WebSocket:', wsUrl);
  ws = new WebSocket(wsUrl);

  lastWsAt = Date.now();
  if (!wsWatchdogTimer) {
    wsWatchdogTimer = setInterval(() => {
      if (!ws) return;
      if (Date.now() - lastWsAt > computeWatchdogMs()) {
        console.log('[WS] Watchdog timeout, closing connection');
        try { ws.close(); } catch {}
        ws = null;
        scheduleWsRetry();
      }
    }, 5000);
  }

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data || '{}');
      lastWsAt = Date.now();
      
      if (data.type === 'qr' && data.qr) {
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
        resetWsRetry();
      } else if (data.type === 'error') {
        qrError.value = data.message || t('app.loadingError');
        polling.value = false;
      } else if (data.type === 'ping') {
        // Server ping, connection is alive
      }
    } catch (e) {
      logWarn('WS parse error', e as any);
    }
  };

  ws.onerror = (error) => {
    console.log('[WS] WebSocket error:', error);
    if (!qrBase64.value) polling.value = false;
    qrError.value = t('app.loading') || 'Loading...';
    lastWsAt = Date.now();
  };

  ws.onclose = () => {
    console.log('[WS] WebSocket closed');
    ws = null;
    if (!qrBase64.value) polling.value = false;
    scheduleWsRetry();
  };

  ws.onopen = () => {
    console.log('[WS] WebSocket opened');
    resetWsRetry();
  };
}

let stopWatch: (() => void) | null = null;

onMounted(() => {
  isHydrated = true;
  loadPin();
  
  // Set up watcher only after hydration
  stopWatch = watch(pin, (val) => {
    if (val) startWs();
    else stopWs();
  });
  
  if (!pin.value) askPin();
  else startWs();
});

onBeforeUnmount(() => {
  wsEnabled = false;
  stopWs();
  if (stopWatch) stopWatch();
});

if (process.client) {
  const onVisibility = () => {
    if (!wsEnabled) return;
    if (document.visibilityState === 'visible') {
      if (!ws) {
        scheduleWsRetry();
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
  if (wsRetryTimer) clearTimeout(wsRetryTimer);
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
