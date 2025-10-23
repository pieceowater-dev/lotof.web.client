<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
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
    (route.params['post-id'] as string) ||
    (route.params.postId as string)
  );
});

const pinKey = computed(() => {
  if (nsSlug.value && postId.value) {
    return dynamicLS.atracePostPin(nsSlug.value, postId.value);
  definePageMeta({
    middleware: [] // Отключаем все middleware, включая auth
  });
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


import { qrGenPublic } from '@/api/atrace/record/qrgen';
import CryptoJS from 'crypto-js';

const qrBase64 = ref('');
const qrError = ref('');
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
    const qr = await qrGenPublic(postId.value, 'METHOD_QR', secret, nsSlug.value);
    qrBase64.value = qr || '';
    if (!qr) qrError.value = 'No QR returned';
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

</script>

<template>
  <div class="max-w-lg mx-auto py-10">
    <h1 class="text-2xl font-bold mb-4">{{ t('app.publicPostPage') }}</h1>
    <div v-if="!pin">
      <UButton color="primary" @click="askPin">{{ t('app.enterPin') || 'Enter PIN' }}</UButton>
    </div>
    <PinPrompt
      v-model="showPinPrompt"
      :title="t('app.enterPin') || 'Enter PIN'"
      :description="t('app.pinPromptDesc') || 'Enter the 6-digit PIN for this post. The PIN was shown to the post creator and is required to view this page.'"
      :error-text="t('app.pinMustBe6Digits') || 'PIN must be 6 digits'"
      @submit="handlePinSubmit"
    />
    <div v-if="pin">
      <div class="mt-8 flex flex-col items-center">
        <div v-if="qrBase64">
          <img :src="`data:image/png;base64,${qrBase64}`" alt="QR" class="w-64 h-64 border shadow" />
        </div>
        <div v-else-if="polling">{{ t('app.loading') || 'Loading...' }}</div>
        <div v-else-if="qrError" class="text-red-500">{{ qrError }}</div>
        <div class="text-xs text-gray-500 mt-2">QR обновляется каждые 15 секунд</div>
      </div>
      <UButton class="mt-4" color="gray" variant="ghost" @click="clearPin">{{ t('app.forgetPin') || 'Forget PIN' }}</UButton>
    </div>
  </div>
</template>
