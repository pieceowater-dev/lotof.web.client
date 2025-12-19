<script lang="ts" setup>
import { useAuth } from '@/composables/useAuth';
import { atraceCheck } from '@/api/atrace/record/check';
import { useI18n } from '@/composables/useI18n';
import { CookieKeys } from '@/utils/storageKeys';
import { logError } from '@/utils/logger';
import { useAtraceToken } from '@/composables/useAtraceToken';

const { t } = useI18n();

const router = useRouter();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);

const { isLoggedIn, token: hubToken, fetchUser, login } = useAuth();

// Parse incoming query params
const qPid = computed(() => (route.query.pid as string) || '');
const qMethodNum = computed(() => (route.query.m as string) || '');
const qSecret = computed(() => (route.query.c as string) || '');

// Map numeric method to GraphQL enum name
const METHOD_MAP: Record<string, string> = {
  '1': 'METHOD_POST_PHRASE',
  '2': 'METHOD_QR',
  '3': 'METHOD_QR_STATIC',
};

function decodeMethod(numStr: string): string | null {
  return METHOD_MAP[numStr] || null;
}

// Cooldown only for static QR method (m=3)
const COOLDOWN_MS = 60_000; // 1 minute
function cooldownKey() {
  const raw = `${nsSlug.value}|${qPid.value}|${qMethodNum.value}|${qSecret.value}`;
  return `atrace-qr-cooldown:${btoa(raw)}`;
}
function getCooldownRemainingMs(): number {
  if (!process.client) return 0;
  try {
    const v = localStorage.getItem(cooldownKey());
    if (!v) return 0;
    const exp = parseInt(v, 10) || 0;
    const rem = exp - Date.now();
    return rem > 0 ? rem : 0;
  } catch { return 0; }
}
function setCooldown() {
  if (!process.client) return;
  try {
    localStorage.setItem(cooldownKey(), String(Date.now() + COOLDOWN_MS));
  } catch {}
}

const { ensure: ensureAtraceToken } = useAtraceToken();

async function runCheck() {
  try {
    // Auth guard: require hub login
    await fetchUser();
    if (!isLoggedIn.value) {
      // Redirect to home with a hint to trigger login automatically
      router.replace({ path: '/', query: { 'auth-needed': 'true' } });
      return;
    }

    // Validate required params
    const methodEnum = decodeMethod(qMethodNum.value);
    if (!qPid.value || !methodEnum || !qSecret.value) {
      // Redirect to recorded page with failure
      router.replace({ name: 'namespace-atrace-recorded', params: { namespace: nsSlug.value }, query: { ok: '0' } });
      return;
    }

    // Ensure A-Trace app token
    const at = await ensureAtraceToken(nsSlug.value, hubToken.value);
    if (!at) {
      router.replace({ name: 'namespace-atrace-recorded', params: { namespace: nsSlug.value }, query: { ok: '0' } });
      return;
    }

    // Perform check
    const res = await atraceCheck(at, nsSlug.value, {
      method: methodEnum,
      postId: String(qPid.value),
      secret: String(qSecret.value),
    });

    const ok = !!(res && res.id);
    // Set cooldown for static QR regardless of result to avoid spam
    if (qMethodNum.value === '3') setCooldown();
    router.replace({ name: 'namespace-atrace-recorded', params: { namespace: nsSlug.value }, query: { ok: ok ? '1' : '0' } });
  } catch (e: unknown) {
    logError('[atrace/qr] runCheck failed', e);
    router.replace({ name: 'namespace-atrace-recorded', params: { namespace: nsSlug.value }, query: { ok: '0' } });
  } finally {
    // no-op
  }
}

function paranoidAntiSpamAndScrubUrl() {
  if (!process.client) return;
  try {
    // 1) Scrub sensitive query params from the visible URL without changing the current route state
    const pathOnly = window.location.pathname + window.location.hash;
    window.history.replaceState(window.history.state, document.title, pathOnly);

    // 2) Client-side cooldown for static QR (method=3)
    if (qMethodNum.value === '3') {
      const rem = getCooldownRemainingMs();
      if (rem > 0) {
        const waitSec = Math.ceil(rem / 1000);
        const target = `/${nsSlug.value}/atrace/qr?pid=${encodeURIComponent(qPid.value)}&m=${encodeURIComponent(qMethodNum.value)}&c=${encodeURIComponent(qSecret.value)}`;
        router.replace({
          name: 'namespace-atrace-recorded',
          params: { namespace: nsSlug.value },
          query: { ok: 'wait', wait: String(waitSec), u: btoa(target) }
        });
        return false;
      }
    }
    return true;
  } catch {
    return true;
  }
}

onMounted(() => {
  const allowed = paranoidAntiSpamAndScrubUrl();
  if (allowed) runCheck();
});
</script>

<template>
  <!-- Friendly checking screen: redirects to recorded page after mutation -->
  <div class="min-h-[80vh] bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-950 flex items-center justify-center px-4">
    <UCard
      class="max-w-xl w-full shadow-lg"
      :ui="{ ring: '', divide: 'divide-y divide-gray-100 dark:divide-gray-800' }"
    >
      <template #header>
        <div class="flex items-center justify-between">
          <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">
            {{ t('app.atraceCheckingHeader') }}
          </h3>
        </div>
      </template>

      <div class="py-8">
        <div class="flex flex-col items-center text-center gap-4">
          <div class="h-16 w-16 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
            <svg class="h-10 w-10 text-blue-600 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10" class="opacity-25"/>
              <path d="M22 12a10 10 0 0 1-10 10" class="opacity-75" />
            </svg>
          </div>
          <p class="text-lg text-gray-700 dark:text-gray-300">{{ t('app.atraceCheckingText') }}</p>
        </div>
      </div>
    </UCard>
  </div>
</template>
