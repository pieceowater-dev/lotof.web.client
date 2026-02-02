<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch, nextTick } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { log, logError } from '@/utils/logger';
import { useRouter } from 'vue-router';
import { ALL_APPS, type AppConfig } from '@/config/apps';
import { hubUpdateMe } from '@/api/hub/updateMe';
import IntroSection from '@/components/IntroSection.vue';
import WelcomeSection from '@/components/WelcomeSection.vue';
import Modal from '@/components/Modal.vue';
import { CookieKeys } from '@/utils/storageKeys';

// Composables
const { user, isLoggedIn, fetchUser, login, logout } = useAuth();
const { selected: selectedNS, all: allNamespaces, setNamespace, load: loadNamespaces } = useNamespace();

const router = useRouter();
const toast = useToast();
const colorMode = useColorMode();
const isDarkMode = computed({
  get: () => colorMode.preference === 'dark',
  set: (val: boolean) => { colorMode.preference = val ? 'dark' : 'light'; }
});

const isModalOpen = ref(false);
const username = ref('');
const email = ref('');
const isLoading = ref(true);
const appInstalled: Record<string, boolean> = reactive({}); // key by bundle
let appsCheckSeq = 0; // sequence guard to avoid race conditions
const installingBundles = new Set<string>(); // prevent double-installs per app

onMounted(async () => {
  // 1) Wait a tick for cookies to be available after OAuth redirect
  await nextTick();
  
  // 2) Immediate auto-login if redirected with auth-needed flag
  const q0 = useRoute().query;
  if (!isLoggedIn.value && (q0['auth-needed'] === 'true' || q0['authNeeded'] === 'true')) {
    // Trigger login right away to avoid waiting on other async inits
    login();
    return;
  }

  // 3) Normal init flow
  await fetchUser();
  await loadNamespaces();
  await checkInstalledForVisibleApps();
  if (user.value) {
    username.value = user.value.username;
    email.value = user.value.email;
  }
  isLoading.value = false;

  // 2.5) If authenticated and we have a back-to target, redirect back once
  if (isLoggedIn.value && process.client) {
    try {
      const bt = localStorage.getItem('back-to');
      if (bt) {
        localStorage.removeItem('back-to');
        const target = bt.startsWith('/') ? bt : `/${bt}`;
        return router.replace(target);
      }
    } catch {}
  }

  // 3) If user is already logged in but URL still has the hint, scrub it
  const r = useRouter();
  const rInfo = useRoute();
  const needsScrub = rInfo.query['auth-needed'] === 'true' || rInfo.query['authNeeded'] === 'true';
  if (isLoggedIn.value && needsScrub) {
    const cleaned = { ...rInfo.query } as any;
    delete cleaned['auth-needed'];
    delete cleaned['authNeeded'];
    r.replace({ path: rInfo.path, query: cleaned });
  }
});

watch(user, (u) => {
  if (u) {
    username.value = u.username;
    email.value = u.email;
  }
});

const handleEditPeople = () => router.push('/people');

async function handleAppClick(appAddress: string) {
  if (!isLoggedIn.value) return login();
  const ns = selectedNS.value;
  if (!ns) return;
  // If opening A-Trace, first exchange for an app token with required headers
  if (appAddress === 'atrace') {
    try {
      const hubToken = useCookie<string | null>(CookieKeys.TOKEN).value;
      if (!hubToken) return login();
  const existing = useCookie<string | null>(CookieKeys.ATRACE_TOKEN);
      if (!existing.value) {
        const { atraceGetAppToken } = await import('@/api/atrace/auth/getAppToken');
  const atraceToken = await atraceGetAppToken(hubToken, ns);
  // Store in reactive global (clients.ts) so subsequent atrace GraphQL calls use it
  const { setAtraceAppToken } = await import('@/api/clients');
  setAtraceAppToken(atraceToken);
        // Persist token on the client so the A-Trace page guard won’t redirect
        useCookie(CookieKeys.ATRACE_TOKEN, {
          sameSite: 'lax',
          path: '/',
          expires: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000)
        }).value = atraceToken;
        // Give the cookie a tick to flush before navigating
        await nextTick();
      } else {
        // Token already present — skip extra auth request
        // Optionally: decode and refresh if near expiry
        // Ensure in-memory ref matches cookie (e.g., after page reload)
        const { setAtraceAppToken } = await import('@/api/clients');
        const existingVal = useCookie<string | null>(CookieKeys.ATRACE_TOKEN, { path: '/' }).value;
        if (existingVal) setAtraceAppToken(existingVal);
      }
      // Ensure cookie is present before navigating; otherwise, stop and notify
      if (!useCookie<string | null>(CookieKeys.ATRACE_TOKEN, { path: '/' }).value) {
        toast.add({ title: 'A-Trace', description: 'Не удалось получить токен приложения. Повторите попытку позже.', color: 'red' });
        return;
      }
    } catch (e) {
      logError('[atrace] getAppToken failed', e);
      toast.add({ title: 'A-Trace', description: 'Ошибка при получении токена приложения.', color: 'red' });
      return;
    }
  }
  // Navigate only after cookie is available (guards may read it immediately)
  await nextTick();
  router.push(`/${ns}/${appAddress}`);
}

async function handleGetApp(app: AppConfig) {
  if (!isLoggedIn.value) return login();
  if (!selectedNS.value) return;
  // Redirect to plan selection page before adding app to namespace
  // The user must select and subscribe to a plan first
  await router.push({
    path: `/${selectedNS.value}/${app.address}/plans`,
    query: { returnTo: `/${selectedNS.value}/${app.address}` }
  });
}

const handleSaveProfile = async () => {
  const token = useCookie<string | null>(CookieKeys.TOKEN).value;
  if (!token) return;
  const updatedUser = await hubUpdateMe(token, username.value);
  username.value = updatedUser.username;
  isModalOpen.value = false;
};

const { t, locale } = useI18n();
const greeting = computed(() => {
  const hours = new Date().getHours();
  if (hours >= 0 && hours < 4) return t('app.greetingNight');
  if (hours < 12) return t('app.greetingMorning');
  if (hours < 18) return t('app.greetingDay');
  return t('app.greetingEvening');
});

const activeApps = computed(() => ALL_APPS.filter(a => appInstalled[a.bundle]));
const possibleApps = computed(() => ALL_APPS.filter(a => !appInstalled[a.bundle] && a.canAdd));
const comingSoonApps = computed(() => ALL_APPS.filter(a => !a.canAdd));

function toCard(app: AppConfig) {
  return {
    key: app.bundle,
    icon: app.icon,
    title: t(app.titleKey),
    name: app.name,
    description: t(app.descriptionKey),
    action: appInstalled[app.bundle]
      ? () => handleAppClick(app.address)
      : (app.canAdd ? () => handleGetApp(app) : undefined),
    installed: appInstalled[app.bundle] ?? false,
    canAdd: app.canAdd,
  };
}

async function checkInstalledForVisibleApps() {
  const seq = ++appsCheckSeq;
  const token = useCookie<string | null>(CookieKeys.TOKEN).value;
  if (!token || !selectedNS.value) return;
  const { hubAreAppsInNamespace } = await import('@/api/hub/namespaces/isAppInNamespace');
  const bundles = ALL_APPS.map(a => a.bundle);
  const installedMap = await hubAreAppsInNamespace(token, selectedNS.value, bundles);
  console.debug('[apps] installedMap', installedMap);
  // Only apply the latest result
  if (seq === appsCheckSeq) {
    for (const b of bundles) appInstalled[b] = !!installedMap[b];
    console.debug('[apps] appInstalled reactive', JSON.parse(JSON.stringify(appInstalled)));
  } else {
    console.debug('[apps] skipped outdated result', { seq, appsCheckSeq });
  }
}

function handleSwitchNamespace(ns: string) {
  setNamespace(ns);
  checkInstalledForVisibleApps();
}

// Re-check when selected namespace changes outside of dropdown (e.g., deep link)
watch(() => selectedNS.value, () => {
  checkInstalledForVisibleApps();
});

function handleLogout() {
  logout();
  isModalOpen.value = false;
}
</script>

<template>
  <div class="h-full overflow-y-auto pb-safe-or-4">
  <div v-if="isLoading" class="flex flex-col items-center text-center justify-center space-y-4 min-h-[65vh]">
    <USkeleton class="h-12 w-12" :ui="{ rounded: 'rounded-full' }" />
    <USkeleton class="h-4 w-[250px]" />
    <USkeleton class="h-4 w-[200px]" />
  </div>

  <template v-else>
    <IntroSection v-if="!isLoggedIn" :onAction="login" />
    <WelcomeSection v-else :greeting="greeting" :username="username" :current-namespace="selectedNS" :all-namespaces="allNamespaces"
      @edit-profile="isModalOpen = true" @edit-people="handleEditPeople" @switch-namespace="handleSwitchNamespace" />
  </template>

  <div class="max-w-7xl mx-auto mb-20 px-2 md:px-4 space-y-6 md:space-y-10">
    <div v-if="activeApps.length">
      <h3 class="text-lg font-medium mb-4">{{ t('app.installedHead') }}</h3>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 lg:gap-10 items-stretch">
        <div v-for="(app, index) in activeApps" :key="app.bundle" class="h-full">
          <AppCard v-bind="toCard(app)" />
        </div>
      </div>
    </div>

    <div v-if="possibleApps.length">
      <h3 class="text-xl font-semibold mb-4">{{ t('app.availableHead') }}</h3>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 lg:gap-10 items-stretch">
        <div v-for="(app, index) in possibleApps" :key="app.bundle" class="h-full">
          <AppCard v-bind="toCard(app)" />
        </div>
      </div>
    </div>

    <div v-if="comingSoonApps.length">
      <h3 class="text-xl font-semibold mb-4">{{ t('app.comingSoonHead') }}</h3>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 lg:gap-10 items-stretch">
        <div v-for="(app, index) in comingSoonApps" :key="app.bundle" class="h-full">
          <AppCard v-bind="toCard(app)" />
        </div>
      </div>
    </div>
  </div>

  <div class="max-w-6xl mx-auto px-4 py-10 text-gray-700 dark:text-gray-300">
    <h2 class="text-xl font-semibold flex items-center mb-4">
  <UIcon name="lucide:briefcase" class="w-5 h-5 mr-2" />
      {{ t('app.businessAutomation') }}
    </h2>
    <p class="mb-4">{{ t('app.businessAutomationLongDesc') }}</p>

    <h2 class="text-xl font-semibold flex items-center mt-8 mb-4">
  <UIcon name="lucide:plus-circle" class="w-5 h-5 mr-2" />
      {{ t('app.processOptimization') }}
    </h2>
    <p class="mb-4">{{ t('app.processOptimizationLongDesc') }}</p>

    <h2 class="text-xl font-semibold flex items-center mt-8 mb-4">
  <UIcon name="lucide:folder-cog" class="w-5 h-5 mr-2" />
      {{ t('app.flexibility') }}
    </h2>
    <p class="mb-4">{{ t('app.flexibilityLongDesc') }}</p>

    <h2 class="text-xl font-semibold flex items-center mt-8 mb-4">
  <UIcon name="lucide:line-chart" class="w-5 h-5 mr-2" />
      {{ t('app.analytics') }}
    </h2>
    <p class="mb-4">{{ t('app.analyticsLongDesc') }}</p>
  </div>

  <Modal v-model="isModalOpen" :header="t('app.profileEditing')" :footerButtons="[
  { label: t('app.logout'), variant: 'link', onClick: () => { handleLogout(); } },
    { label: t('app.cancel'), color: 'primary', variant: 'soft', onClick: () => (isModalOpen = false) },
    { label: t('app.save'), color: 'primary', variant: 'solid', onClick: handleSaveProfile }
  ]">
    <div class="space-y-6">
      <UFormGroup label="Имя пользователя">
        <UInput v-model="username" />
      </UFormGroup>
      
      <UFormGroup label="Email">
        <UInput disabled v-model="email" type="email" />
      </UFormGroup>
      
      <UFormGroup :label="t('app.language')">
        <USelect :options="[{label:'English',value:'en'},{label:'Русский',value:'ru'}]" v-model="locale" />
      </UFormGroup>
      
      <UFormGroup :label="t('app.theme') || 'Theme'">
        <div class="flex items-center gap-3">
          <UToggle v-model="isDarkMode" />
          <span class="text-sm text-gray-700 dark:text-gray-200">
            {{ isDarkMode ? (t('app.dark') || 'Dark') : (t('app.light') || 'Light') }}
          </span>
        </div>
      </UFormGroup>
    </div>
  </Modal>

  <div class="m-4">
    <AppFooter />
  </div>
  </div>
</template>

<style scoped>
.pb-safe-or-4 {
  padding-bottom: max(env(safe-area-inset-bottom), 1rem);
}
</style>
