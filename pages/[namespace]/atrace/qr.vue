<script lang="ts" setup>
import { useAuth } from '@/composables/useAuth';
import { atraceGetAppToken } from '@/api/atrace/auth/getAppToken';
import { atraceCheck } from '@/api/atrace/record/check';
import { useI18n } from '@/composables/useI18n';

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

async function ensureAtraceToken(): Promise<string | null> {
  // Use previously obtained app token if present and valid
  const cookie = useCookie<string | null>('atrace-token', { path: '/' });
  const tok = cookie.value;
  if (tok) {
    try {
      const parts = tok.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1]));
        const expSec = payload.exp as number | undefined;
        if (expSec && Date.now() / 1000 >= expSec) {
          cookie.value = null;
        } else {
          return tok;
        }
      }
    } catch {/* ignore and refresh below */}
  }

  // If no valid token, exchange hub token -> atrace app token
  const hub = hubToken.value;
  if (!hub) return null;
  try {
    const at = await atraceGetAppToken(hub, nsSlug.value);
    useCookie('atrace-token', {
      sameSite: 'lax',
      path: '/',
      // 6 days validity window, server token may expire earlier; we still validate on each use
      expires: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
    }).value = at;
    return at;
  } catch (e) {
    return null;
  }
}

async function runCheck() {
  try {
    // Auth guard: require hub login
    await fetchUser();
    if (!isLoggedIn.value) {
      return login();
    }

    // Validate required params
    const methodEnum = decodeMethod(qMethodNum.value);
    if (!qPid.value || !methodEnum || !qSecret.value) {
      // Redirect to recorded page with failure
      router.replace({ name: 'namespace-atrace-recorded', params: { namespace: nsSlug.value }, query: { ok: '0' } });
      return;
    }

    // Ensure A-Trace app token
    const at = await ensureAtraceToken();
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
    router.replace({ name: 'namespace-atrace-recorded', params: { namespace: nsSlug.value }, query: { ok: ok ? '1' : '0' } });
  } catch (e: any) {
    router.replace({ name: 'namespace-atrace-recorded', params: { namespace: nsSlug.value }, query: { ok: '0' } });
  } finally {
    // no-op
  }
}

onMounted(() => { runCheck(); });
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
          <UButton size="xs" color="gray" variant="ghost" @click="router.push('/')">{{ t('app.home') }}</UButton>
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
