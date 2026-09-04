<script lang="ts" setup>
import { useAuth } from '@/composables/useAuth';
import { atraceCheck } from '@/api/atrace/record/check';
import { atraceGetAppToken } from '@/api/atrace/auth/getAppToken';
import { atraceRequestOnboarding } from '@/api/atrace/onboarding/onboarding';
import { useI18n } from '@/composables/useI18n';
import { CookieKeys } from '@/utils/storageKeys';
import { logError } from '@/utils/logger';
import { useAtraceToken } from '@/composables/useAtraceToken';
import { getGeolocationOnce } from '@/utils/geolocation';

definePageMeta({
  layout: false
});

const { t } = useI18n();

const router = useRouter();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);

useHead({ title: 'Отметка по QR — A-Trace' });

const { isLoggedIn, token: hubToken, user, fetchUser, login } = useAuth();

// A hub-authenticated user who scans a post's QR but isn't an active atrace
// member of this namespace yet (never joined, or joined but not activated)
// gets offered an onboarding request instead of a bare failure -- see
// tracker's ReleaseToken, which is the source of both distinguishing error
// messages checked below.
function needsOnboarding(err: unknown): boolean {
  const msg = String((err as any)?.message || err || '').toLowerCase();
  return msg.includes('not a member of the namespace') || msg.includes('not active in atrace');
}

// Maps a raw backend error to a short reason code recorded.vue can localize
// -- a bare ok=0 gave no indication of what actually went wrong (expired
// code vs. no access vs. a bad link), so people had no idea whether to
// rescan, ask their manager, or just try again. Substring-matched against
// the exact wrapped messages tracker's record.svc.Check / ctrl.Check
// produce (see record.ctrl.go's "failed to check record: %w").
function classifyCheckFailure(err: unknown): string {
  const msg = String((err as any)?.message || err || '').toLowerCase();
  if (msg.includes('invalid totp code')) return 'expired';
  if (msg.includes('invalid static code') || msg.includes('invalid phrase')) return 'invalid_code';
  if (msg.includes('access denied') || msg.includes('not active in atrace')) return 'not_active';
  if (msg.includes('not a member of the namespace')) return 'not_member';
  if (msg.includes('failed to get post')) return 'post_not_found';
  if (msg.includes('location confirmation required')) return 'geo_required';
  return '';
}

async function tryRequestOnboarding(): Promise<boolean> {
  try {
    await atraceRequestOnboarding(
      hubToken.value as string,
      nsSlug.value,
      qPid.value || undefined,
      user.value?.username || '',
      user.value?.email || undefined
    );
    return true;
  } catch (e) {
    logError('[atrace/qr] requestOnboarding failed', e);
    return false;
  }
}

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
      router.replace({ name: 'namespace-atrace-recorded', params: { namespace: nsSlug.value }, query: { ok: '0', reason: 'invalid_link' } });
      return;
    }

    // Ensure A-Trace app token
    const at = await ensureAtraceToken(nsSlug.value, hubToken.value);
    if (!at) {
      // ensureAtraceToken swallows the underlying error after retrying
      // transient failures; make one direct call to see whether this was
      // specifically "not a member" / "not active" (not transient, tracker
      // fails these immediately) before treating it as a hard failure.
      try {
        await atraceGetAppToken(hubToken.value as string, nsSlug.value);
      } catch (e) {
        if (needsOnboarding(e)) {
          const submitted = await tryRequestOnboarding();
          router.replace({
            name: 'namespace-atrace-recorded',
            params: { namespace: nsSlug.value },
            query: { ok: submitted ? 'pending' : '0' }
          });
          return;
        }
        router.replace({ name: 'namespace-atrace-recorded', params: { namespace: nsSlug.value }, query: { ok: '0', reason: classifyCheckFailure(e) } });
        return;
      }
      router.replace({ name: 'namespace-atrace-recorded', params: { namespace: nsSlug.value }, query: { ok: '0' } });
      return;
    }

    // Request geolocation (skip only if the browser permission is a real,
    // explicit denial). alwaysPrompt: check-in is exactly the situation
    // getGeolocationOnce's normal 24h "don't re-nag" cooldown is wrong for --
    // a post can require a confirmed location for the check-in to count at
    // all, so silently giving up on asking again after one dismissed/timed-
    // out dialog would fail every check-in in between with no visible reason.
    let latitude: number | undefined;
    let longitude: number | undefined;
    if (process.client) {
      try {
        const coords = await getGeolocationOnce({ timeout: 5000, enableHighAccuracy: false }, { alwaysPrompt: true });
        latitude = coords.latitude;
        longitude = coords.longitude;
      } catch (e) {
        logError('[atrace/qr] Geolocation request failed', e);
      }
    }

    // Perform check
    const res = await atraceCheck(at, nsSlug.value, {
      method: methodEnum,
      postId: String(qPid.value),
      secret: String(qSecret.value),
      latitude,
      longitude,
    });

    const ok = !!(res && res.id);
    useAnalytics().track('atrace_check', { method: methodEnum, ok });
    // Set cooldown for static QR regardless of result to avoid spam
    if (qMethodNum.value === '3') setCooldown();
    router.replace({ name: 'namespace-atrace-recorded', params: { namespace: nsSlug.value }, query: { ok: ok ? '1' : '0' } });
  } catch (e: unknown) {
    logError('[atrace/qr] runCheck failed', e);
    router.replace({ name: 'namespace-atrace-recorded', params: { namespace: nsSlug.value }, query: { ok: '0', reason: classifyCheckFailure(e) } });
  } finally {
    // no-op
  }
}

// Static QR (m=3) is a fixed, non-expiring link -- unlike TOTP/dynamic QR
// (a few seconds' validity) or a typed phrase (needs active input each
// time), the exact same URL stays live indefinitely. Auto-firing the check
// the instant this page mounted meant ANY passive re-trigger of that URL --
// a phone restoring a backgrounded tab, an impatient re-tap of the same
// sticker a minute later once the cooldown had *just* lapsed -- silently
// recorded a brand-new, fully real check-in with no user action taken and
// no confirmation shown. Confirmed live: one member picked up a phantom
// checkout 72 minutes after their real one; another racked up 12 real
// scans in one day from repeated ~61s-apart re-triggers. Now static QR
// shows a button instead of firing on mount -- every check-in this method
// records requires one deliberate tap, so a stale reload can no longer
// create one on its own.
const showConfirmButton = ref(false);
const confirming = ref(false);

async function onConfirmClick() {
  if (confirming.value) return;
  confirming.value = true;
  await runCheck();
  // runCheck always navigates away (success/fail/wait) or throws into its
  // own catch -- confirming only needs resetting if somehow neither
  // happened (defensive, not expected in practice).
  confirming.value = false;
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
  if (!allowed) return;
  if (qMethodNum.value === '3') {
    showConfirmButton.value = true;
  } else {
    runCheck();
  }
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
            {{ showConfirmButton && !confirming ? (t('app.atraceConfirmHeader') || 'Отметка о присутствии') : t('app.atraceCheckingHeader') }}
          </h3>
        </div>
      </template>

      <div class="py-8">
        <div
          v-if="showConfirmButton && !confirming"
          class="flex flex-col items-center text-center gap-4"
        >
          <div class="h-16 w-16 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
            <UIcon
              name="i-heroicons-qr-code"
              class="h-9 w-9 text-emerald-600"
            />
          </div>
          <p class="text-lg text-gray-700 dark:text-gray-300">
            {{ t('app.atraceConfirmText') || 'Нажмите, чтобы отметиться' }}
          </p>
          <UButton
            size="lg"
            color="primary"
            @click="onConfirmClick"
          >
            {{ t('app.atraceConfirmButton') || 'Отметиться' }}
          </UButton>
        </div>
        <div
          v-else
          class="flex flex-col items-center text-center gap-4"
        >
          <div class="h-16 w-16 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
            <div
              class="h-9 w-9 rounded-full border-[3px] border-emerald-200 border-t-emerald-600 animate-spin"
              aria-hidden="true"
            />
          </div>
          <p class="text-lg text-gray-700 dark:text-gray-300">
            {{ t('app.atraceCheckingText') }}
          </p>
        </div>
      </div>
    </UCard>
  </div>
</template>
