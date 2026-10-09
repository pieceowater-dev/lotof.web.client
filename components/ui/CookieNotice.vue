<script lang="ts" setup>
import { onMounted, ref } from 'vue';
import { useI18n } from '@/composables/useI18n';

// Deliberately a *notice*, not a consent wall. lota only sets strictly
// necessary cookies (auth/session) plus a cookie-less analytics device id;
// under KZ/RU law that calls for clear information + an easy opt-out (see
// the Cookie Policy), not a blocking opt-in gate. So this is one quiet,
// dismissible strip that:
//   - only mounts when analytics is actually configured for this deploy
//     (no Amplitude key -> nothing non-essential is collected -> no strip),
//   - waits out the first paint so it never competes with page content,
//   - remembers dismissal locally and never shows again.
const ACK_KEY = 'lota_cookie_notice';

const { t } = useI18n();
const visible = ref(false);

onMounted(() => {
  const cfg = useRuntimeConfig();
  const analyticsActive = !!String(cfg.public.amplitudeApiKey || '');
  if (!analyticsActive) return;

  let acked = false;
  try {
    acked = localStorage.getItem(ACK_KEY) === '1';
  } catch {
    // Private mode / storage blocked -- treat as not-acked but the dismiss
    // below will just no-op the write; showing it once per session is fine.
  }
  if (acked) return;

  window.setTimeout(() => {
    visible.value = true;
  }, 1200);
});

function dismiss() {
  visible.value = false;
  try {
    localStorage.setItem(ACK_KEY, '1');
  } catch {
    // ignore -- worst case it shows again next session
  }
}
</script>

<template>
  <Transition
    enter-active-class="transition duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
    enter-from-class="translate-y-6 opacity-0"
    enter-to-class="translate-y-0 opacity-100"
    leave-active-class="transition duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
    leave-from-class="translate-y-0 opacity-100"
    leave-to-class="translate-y-6 opacity-0"
  >
    <div
      v-if="visible"
      class="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-3 pb-safe-or-4"
    >
      <div class="ck pointer-events-auto">
        <p class="min-w-0 flex-1">
          {{ t('legal.cookieNotice') || 'Только необходимые cookie и обезличенная аналитика.' }}
          <NuxtLink
            to="/guide/global/cookies"
            target="_blank"
            rel="noopener noreferrer"
            class="ck-link"
          >
            {{ t('legal.cookieMore') || 'Подробнее' }}
          </NuxtLink>
        </p>
        <button type="button" class="ck-btn" @click="dismiss">
          {{ t('legal.cookieAccept') || 'Хорошо' }}
        </button>
      </div>
    </div>
  </Transition>
</template>
