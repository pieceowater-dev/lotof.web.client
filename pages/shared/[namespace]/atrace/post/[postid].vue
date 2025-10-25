<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import PinPrompt from '@/components/PinPrompt.vue';
import { useRoute } from 'vue-router';
import { useI18n } from '@/composables/useI18n';
import { CookieKeys, dynamicLS } from '@/utils/storageKeys';

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


function loadPin() {
  if (process.client && pinKey.value) {
    pin.value = localStorage.getItem(pinKey.value) || '';
  }
}
function savePin(val: string) {
  if (process.client && pinKey.value && nsSlug.value && postId.value) {
    console.log('savePin', 'key:', pinKey.value, 'val:', val, 'ns:', nsSlug.value, 'postId:', postId.value);
    localStorage.setItem(pinKey.value, val);
    pin.value = val;
  } else {
    console.warn('savePin: missing nsSlug or postId', nsSlug.value, postId.value);
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
}


onMounted(() => {
  console.log('[DEBUG] route.params:', JSON.stringify(route.params));
  loadPin();
  if (!pin.value) askPin();
});

watch([nsSlug, postId], () => {
  loadPin();
});


import { qrGenPublic, type QrGenResult } from '@/api/atrace/record/qrgen';
import CryptoJS from 'crypto-js';

const qrBase64 = ref('');
const qrError = ref('');
const qrPostTitle = ref('');
const qrPostAddress = ref('');
const polling = ref(false);
let pollTimer: any = null;

async function fetchQr() {
  if (!pin.value || !postId.value || !nsSlug.value) {
    console.warn('fetchQr: missing pin, postId, or nsSlug', pin.value, postId.value, nsSlug.value);
    return;
  }
  polling.value = true;
  qrError.value = '';
  try {
    // Use md5(pin) as secret
    const secret = CryptoJS.MD5(pin.value).toString();
    console.log('fetchQr', 'postId:', postId.value, 'nsSlug:', nsSlug.value, 'secret:', secret);
    const qrRes = await qrGenPublic(postId.value, 'METHOD_QR', secret, nsSlug.value);
    if (qrRes && qrRes.qr) {
      qrBase64.value = qrRes.qr;
      qrPostTitle.value = qrRes.postTitle || '';
      qrPostAddress.value = qrRes.postFullAddress || '';
    } else {
      qrBase64.value = '';
      qrPostTitle.value = '';
      qrPostAddress.value = '';
      qrError.value = 'No QR returned';
    }
  } catch (e: any) {
    qrError.value = e?.message || 'Failed to fetch QR';
  } finally {
    polling.value = false;
  }
}

function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  fetchQr();
  pollTimer = setInterval(fetchQr, 15000);
}
function stopPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}

watch(pin, (val) => {
  if (val) startPolling();
  else stopPolling();
});
onMounted(() => {
  loadPin();
  if (!pin.value) askPin();
  else startPolling();
});
onBeforeUnmount(() => stopPolling());

const REFRESH_INTERVAL = 15;
const qrRefreshCountdown = ref(REFRESH_INTERVAL);
let qrCountdownTimer: any = null;

function startCountdown() {
  qrRefreshCountdown.value = REFRESH_INTERVAL;
  if (qrCountdownTimer) clearInterval(qrCountdownTimer);
  qrCountdownTimer = setInterval(() => {
    if (qrRefreshCountdown.value > 1) {
      qrRefreshCountdown.value--;
    } else {
      qrRefreshCountdown.value = REFRESH_INTERVAL;
    }
  }, 1000);
}

onMounted(() => {
  startCountdown();
});
onBeforeUnmount(() => {
  if (qrCountdownTimer) clearInterval(qrCountdownTimer);
});

</script>

<template>
  <div class="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
    <div class="w-full max-w-md bg-white/80 dark:bg-gray-900/80 rounded-2xl shadow-xl p-6 flex flex-col items-center">
      <h1 class="text-2xl font-bold mb-2 text-blue-900 dark:text-white flex flex-col items-center justify-center w-full">
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
              <img :src="`data:image/png;base64,${qrBase64}`" alt="QR" class="w-full max-w-xs h-auto aspect-square object-contain" style="max-width:320px; min-width:120px;" />
            </div>
          </div>
          <div v-else-if="polling" class="text-blue-500 dark:text-blue-300 mt-4 flex items-center gap-2">
            <i class="i-lucide-loader animate-spin"></i>
            {{ t('app.loading') || 'Loading...' }}
          </div>
          <div v-else-if="qrError" class="text-red-500 mt-4">{{ qrError }}</div>
          <div class="text-xs text-gray-500 mt-2 text-center">QR обновится через {{ qrRefreshCountdown }}с.</div>
        </div>
      </div>
    </div>
  </div>
</template>
