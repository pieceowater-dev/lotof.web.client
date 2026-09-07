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
    enter-active-class="transition duration-300 ease-out"
    enter-from-class="translate-y-4 opacity-0"
    enter-to-class="translate-y-0 opacity-100"
    leave-active-class="transition duration-200 ease-in"
    leave-from-class="translate-y-0 opacity-100"
    leave-to-class="translate-y-4 opacity-0"
  >
    <div
      v-if="visible"
      class="fixed inset-x-0 bottom-0 z-50 flex justify-center px-2.5 pb-safe-or-4"
    >
      <div
        class="pointer-events-auto flex w-full max-w-sm items-center gap-2 rounded-lg border border-gray-200 bg-white/95 px-3 py-2 text-[11px] leading-snug text-gray-500 shadow-md backdrop-blur dark:border-gray-700 dark:bg-gray-900/95 dark:text-gray-400"
      >
        <p class="min-w-0 flex-1">
          {{ t('legal.cookieNotice') || 'Только необходимые cookie и обезличенная аналитика.' }}
          <NuxtLink
            to="/guide/global/cookies"
            target="_blank"
            rel="noopener noreferrer"
            class="whitespace-nowrap underline underline-offset-2 hover:text-gray-700 dark:hover:text-gray-200"
          >
            {{ t('legal.cookieMore') || 'Подробнее' }}
          </NuxtLink>
        </p>
        <UButton size="xs" color="primary" variant="soft" class="flex-shrink-0" @click="dismiss">
          {{ t('legal.cookieAccept') || 'Хорошо' }}
        </UButton>
      </div>
    </div>
  </Transition>
</template>
