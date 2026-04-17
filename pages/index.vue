<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch, nextTick } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { log, logError } from '@/utils/logger';
import { useRouter } from 'vue-router';
import { ALL_APPS, type AppConfig } from '@/config/apps';
import { hubUpdateMe } from '@/api/hub/updateMe';
import IntroSection from '@/components/IntroSection.vue';
import Modal from '@/components/Modal.vue';
import { CookieKeys } from '@/utils/storageKeys';
import { useAtraceToken } from '@/composables/useAtraceToken';
import { useContactsToken } from '@/composables/useContactsToken';

// Composables
const { user, isLoggedIn, fetchUser, login, logout } = useAuth();
const { selected: selectedNS, all: allNamespaces, setNamespace, titleBySlug } = useNamespace();

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
      const { ensure } = useAtraceToken();
      const atraceToken = await ensure(ns, hubToken);
      // Ensure cookie is present before navigating; otherwise, stop and notify
      if (!atraceToken || !useCookie<string | null>(CookieKeys.ATRACE_TOKEN, { path: '/' }).value) {
        toast.add({
          title: t('app.atraceTitle') || 'A-Trace',
          description: t('app.appTokenFailed') || 'Failed to get app token. Please try again later.',
          color: 'red'
        });
        return;
      }
    } catch (e) {
      logError('[atrace] getAppToken failed', e);
      toast.add({
        title: t('app.atraceTitle') || 'A-Trace',
        description: t('app.appTokenError') || 'Failed to get app token.',
        color: 'red'
      });
      return;
    }
  }
  if (appAddress === 'contacts') {
    try {
      const hubToken = useCookie<string | null>(CookieKeys.TOKEN).value;
      if (!hubToken) return login();
      const { ensure } = useContactsToken();
      const contactsToken = await ensure(ns, hubToken);
      if (!contactsToken || !useCookie<string | null>(CookieKeys.CONTACTS_TOKEN, { path: '/' }).value) {
        toast.add({
          title: t('app.contacts') || 'Contacts',
          description: t('app.appTokenFailed') || 'Failed to get app token. Please try again later.',
          color: 'red'
        });
        return;
      }
    } catch (e) {
      logError('[contacts] getAppToken failed', e);
      toast.add({
        title: t('app.contacts') || 'Contacts',
        description: t('app.appTokenError') || 'Failed to get app token.',
        color: 'red'
      });
      return;
    }
  }
  // Navigate only after cookie is available (guards may read it immediately)
  await nextTick();
  // For A-Trace, always navigate to attendance/all
  const path = appAddress === 'atrace' ? `/${ns}/atrace/attendance/all` : `/${ns}/${appAddress}`;
  router.push(path);
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
const config = useRuntimeConfig();
const siteUrl = (config.public.siteUrl || 'https://lota.tools').replace(/\/$/, '');

useSeoMeta({
  title: () => t('app.title') || 'lota',
  description: () => t('app.description') || 'Платформа автоматизации для современного бизнеса.',
  ogTitle: () => t('app.title') || 'lota',
  ogDescription: () => t('app.description') || 'Платформа автоматизации для современного бизнеса.',
  ogType: 'website',
  ogUrl: siteUrl,
  ogImage: () => `${siteUrl}/og-image.png`,
  twitterCard: 'summary_large_image',
  twitterTitle: () => t('app.title') || 'lota',
  twitterDescription: () => t('app.description') || 'Платформа автоматизации для современного бизнеса.',
  twitterImage: () => `${siteUrl}/og-image.png`
});

useHead({
  title: 'lota',
  titleTemplate: null,
  link: [{ rel: 'canonical', href: siteUrl }]
});

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
  // Note: checkInstalledForVisibleApps() is called automatically by the watch below
}

// Re-check when selected namespace changes outside of dropdown (e.g., deep link)
watch(() => selectedNS.value, () => {
  checkInstalledForVisibleApps();
});

function handleLogout() {
  logout();
  isModalOpen.value = false;
}

const dashboardApps = computed(() => [
  ...activeApps.value,
  ...possibleApps.value,
  ...comingSoonApps.value,
]);

const languageOptions = [
  { value: 'en', label: 'English', flag: '🇺🇸' },
  { value: 'ru', label: 'Русский', flag: '🇷🇺' },
  { value: 'kk', label: 'Қазақша', flag: '🇰🇿' },
] as const;

const currentLanguage = computed(() => {
  const current = String(locale.value || 'en');
  return languageOptions.find((item) => item.value === current) || languageOptions[0];
});

function setLanguage(lang: 'en' | 'ru' | 'kk') {
  locale.value = lang;
}

function handleDashboardApp(app: AppConfig) {
  if (appInstalled[app.bundle]) {
    handleAppClick(app.address);
    return;
  }
  if (app.canAdd) {
    handleGetApp(app);
  }
}
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <div class="pb-safe-or-4">
    <ClientOnly>
      <template #fallback>
        <div class="flex flex-col items-center text-center justify-center space-y-4 min-h-[65vh]">
          <USkeleton
            class="h-12 w-12"
            :ui="{ rounded: 'rounded-full' }"
          />
          <USkeleton class="h-4 w-[250px]" />
          <USkeleton class="h-4 w-[200px]" />
        </div>
      </template>
    
      <IntroSection
        v-if="!isLoggedIn"
        :on-action="login"
      />
    </ClientOnly>

    <div
      v-if="isLoggedIn"
      class="max-w-7xl mx-auto mt-4 md:mt-6 mb-16 px-3 md:px-4"
    >
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">
        <div class="lg:col-span-4 rounded-3xl p-6 md:p-7 bg-gradient-to-br from-blue-50 to-blue-100/80 dark:from-gray-800 dark:to-gray-900 border border-blue-100/70 dark:border-gray-700 shadow-sm">
          <div class="flex items-start justify-between gap-3">
            <div class="w-20 h-20 rounded-full bg-white/80 dark:bg-gray-700 flex items-center justify-center text-3xl font-semibold text-gray-900 dark:text-gray-100 shadow-sm">
              {{ (username || '?').charAt(0).toUpperCase() }}
            </div>
            <UButton
              icon="lucide:door-open"
              color="gray"
              variant="ghost"
              size="xs"
              class="mt-1"
              :aria-label="t('app.logout') || 'Logout'"
              @click="handleLogout"
            />
          </div>
          <p class="mt-4 text-sm text-gray-500 dark:text-gray-400">
            {{ greeting }}
          </p>
          <h2 class="mt-1 text-4xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
            {{ username }}
          </h2>
          <p class="mt-2 text-lg text-gray-600 dark:text-gray-300 break-all">
            {{ email }}
          </p>

          <div class="mt-6 flex flex-wrap gap-2">
            <button
              class="px-3 py-1.5 rounded-md bg-gradient-to-r from-blue-500 to-emerald-500 text-white font-medium text-sm hover:from-blue-600 hover:to-emerald-600 transition-all flex items-center gap-1.5 shadow-sm hover:shadow-md"
              @click="handleEditPeople"
            >
              <UIcon name="i-lucide-user-round-check" class="w-4 h-4" />
              {{ t('app.myPeople') }}
            </button>
            <UButton
              variant="soft"
              size="sm"
              @click="isModalOpen = true"
            >
              {{ t('app.configureProfile') }}
            </UButton>
          </div>
        </div>

        <div class="lg:col-span-8 rounded-3xl p-5 md:p-6 bg-gradient-to-br from-blue-50/90 to-blue-100/70 dark:from-gray-800 dark:to-gray-900 border border-blue-100/70 dark:border-gray-700 shadow-sm">
          <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 md:gap-4">
            <button
              v-for="app in dashboardApps"
              :key="app.bundle"
              :disabled="!appInstalled[app.bundle] && !app.canAdd"
              class="group rounded-2xl p-3 text-center transition-all disabled:opacity-45 disabled:cursor-not-allowed"
              :class="appInstalled[app.bundle]
                ? 'bg-white/85 dark:bg-gray-800 hover:shadow-md border border-blue-200 dark:border-blue-800'
                : 'bg-white/75 dark:bg-gray-800 hover:shadow-sm border border-transparent hover:border-blue-200 dark:hover:border-blue-800'"
              @click="handleDashboardApp(app)"
            >
              <div
                class="mx-auto w-14 h-14 rounded-2xl flex items-center justify-center"
                :class="appInstalled[app.bundle]
                  ? ''
                  : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'"
              >
                <UIcon
                  :name="app.icon"
                  class="w-8 h-8"
                  :class="appInstalled[app.bundle]
                    ? 'bg-gradient-to-r from-blue-600 to-emerald-500 [background-color:transparent]'
                    : ''"
                />
              </div>
              <p class="mt-2 text-sm font-medium text-gray-800 dark:text-gray-100 line-clamp-1">
                {{ t(app.titleKey) }}
              </p>
              <p class="mt-1 text-[11px] leading-4"
                 :class="appInstalled[app.bundle]
                   ? 'bg-gradient-to-r from-blue-600 to-emerald-600 text-transparent bg-clip-text font-semibold'
                   : (app.canAdd ? 'text-blue-600 dark:text-blue-300' : 'text-gray-400 dark:text-gray-500')"
              >
                {{ appInstalled[app.bundle] ? (t('app.open') || 'Open') : (app.canAdd ? (t('app.getApp') || 'Get') : (t('app.comingSoon') || 'Soon')) }}
              </p>
            </button>
          </div>
        </div>
      </div>

      <div class="mt-4 rounded-3xl p-5 md:p-6 bg-gradient-to-br from-blue-50/90 to-blue-100/70 dark:from-gray-800 dark:to-gray-900 border border-blue-100/70 dark:border-gray-700 shadow-sm">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-700 dark:text-blue-300">
            <UIcon
              name="lucide:building-2"
              class="w-5 h-5"
            />
          </div>
          <div>
            <h3 class="text-base md:text-lg font-semibold text-gray-900 dark:text-gray-100">
              {{ t('app.currentNamespace') || 'Namespace' }}
            </h3>
            <p class="text-xs md:text-sm text-gray-500 dark:text-gray-400">
              {{ t('app.selectNamespace') || 'Select active workspace' }}
            </p>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          <button
            v-for="slug in allNamespaces"
            :key="slug"
            type="button"
            class="text-left rounded-2xl p-4 border transition-all duration-200"
            :class="selectedNS === slug
              ? 'bg-white border-2 border-blue-500 dark:bg-blue-900/30 dark:border-blue-500 shadow-sm'
              : 'bg-white/80 border-white/70 dark:bg-gray-800/70 dark:border-gray-700 hover:border-blue-200 dark:hover:border-blue-700'"
            @click="handleSwitchNamespace(slug)"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <p class="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                  {{ titleBySlug(slug) || slug }}
                </p>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
                  {{ slug }}
                </p>
              </div>
              <UIcon
                v-if="selectedNS === slug"
                name="lucide:check-circle-2"
                class="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0"
              />
            </div>
          </button>
        </div>
      </div>

      <div class="mt-4 rounded-3xl p-5 md:p-6 bg-gradient-to-br from-blue-50/90 to-blue-100/70 dark:from-gray-800 dark:to-gray-900 border border-blue-100/70 dark:border-gray-700 shadow-sm">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-700 dark:text-blue-300">
            <UIcon
              name="lucide:sliders-horizontal"
              class="w-5 h-5"
            />
          </div>
          <div>
            <h3 class="text-base md:text-lg font-semibold text-gray-900 dark:text-gray-100">
              {{ t('app.preferences') || 'Preferences' }}
            </h3>
            <p class="text-xs md:text-sm text-gray-500 dark:text-gray-400">
              {{ t('app.preferencesSubtitle') || 'Language, theme & display' }}
            </p>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
          <button
            type="button"
            class="rounded-2xl p-5 border bg-white/80 border-white/70 dark:bg-gray-800/70 dark:border-gray-700 text-left transition-all duration-200 hover:border-blue-200 dark:hover:border-blue-700"
            @click="isDarkMode = !isDarkMode"
          >
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="text-sm font-medium text-gray-800 dark:text-gray-100">
                  {{ t('app.theme') || 'Theme' }}
                </p>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {{ isDarkMode ? (t('app.dark') || 'Dark') : (t('app.light') || 'Light') }}
                </p>
              </div>
              <div
                class="w-14 h-14 rounded-2xl flex items-center justify-center bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
              >
                <UIcon
                  :name="isDarkMode ? 'lucide:moon-star' : 'lucide:sun-medium'"
                  class="w-8 h-8"
                />
              </div>
            </div>
          </button>

          <div class="rounded-2xl p-5 border bg-white/80 border-white/70 dark:bg-gray-800/70 dark:border-gray-700">
            <div class="flex items-start justify-between gap-3 mb-4">
              <div>
                <p class="text-sm font-medium text-gray-800 dark:text-gray-100">
                  {{ t('app.language') }}
                </p>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {{ currentLanguage.label }}
                </p>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-2">
              <button
                v-for="lang in languageOptions"
                :key="lang.value"
                type="button"
                class="h-11 rounded-xl border text-sm font-medium transition-all"
                :class="String(locale) === lang.value
                  ? 'bg-blue-50 border-blue-300 text-blue-700 font-semibold dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-300'
                  : 'bg-white border-gray-200 text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200 hover:border-blue-300 dark:hover:border-blue-700'"
                @click="setLanguage(lang.value)"
              >
                <span class="mr-1.5">{{ lang.flag }}</span>{{ lang.label }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="!isLoggedIn"
      class="max-w-7xl mx-auto mb-20 px-2 md:px-4 space-y-6 md:space-y-10"
    >
      <div v-if="activeApps.length">
        <h3 class="text-lg font-medium mb-4">
          {{ t('app.installedHead') }}
        </h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 lg:gap-10 items-stretch">
          <div
            v-for="app in activeApps"
            :key="app.bundle"
            class="h-full"
          >
            <AppCard v-bind="toCard(app)" />
          </div>
        </div>
      </div>

      <div v-if="possibleApps.length">
        <h3 class="text-xl font-semibold mb-4">
          {{ t('app.availableHead') }}
        </h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 lg:gap-10 items-stretch">
          <div
            v-for="app in possibleApps"
            :key="app.bundle"
            class="h-full"
          >
            <AppCard v-bind="toCard(app)" />
          </div>
        </div>
      </div>

      <div v-if="comingSoonApps.length">
        <h3 class="text-xl font-semibold mb-4">
          {{ t('app.comingSoonHead') }}
        </h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 lg:gap-10 items-stretch">
          <div
            v-for="app in comingSoonApps"
            :key="app.bundle"
            class="h-full"
          >
            <AppCard v-bind="toCard(app)" />
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="!isLoggedIn"
      class="max-w-6xl mx-auto px-4 py-10 text-gray-700 dark:text-gray-300"
    >
      <h2 class="text-xl font-semibold flex items-center mb-4">
        <UIcon
          name="lucide:briefcase"
          class="w-5 h-5 mr-2"
        />
        {{ t('app.businessAutomation') }}
      </h2>
      <p class="mb-4">
        {{ t('app.businessAutomationLongDesc') }}
      </p>

      <h2 class="text-xl font-semibold flex items-center mt-8 mb-4">
        <UIcon
          name="lucide:plus-circle"
          class="w-5 h-5 mr-2"
        />
        {{ t('app.processOptimization') }}
      </h2>
      <p class="mb-4">
        {{ t('app.processOptimizationLongDesc') }}
      </p>

      <h2 class="text-xl font-semibold flex items-center mt-8 mb-4">
        <UIcon
          name="lucide:folder-cog"
          class="w-5 h-5 mr-2"
        />
        {{ t('app.flexibility') }}
      </h2>
      <p class="mb-4">
        {{ t('app.flexibilityLongDesc') }}
      </p>

      <h2 class="text-xl font-semibold flex items-center mt-8 mb-4">
        <UIcon
          name="lucide:line-chart"
          class="w-5 h-5 mr-2"
        />
        {{ t('app.analytics') }}
      </h2>
      <p class="mb-4">
        {{ t('app.analyticsLongDesc') }}
      </p>
    </div>

    <Modal
      v-model="isModalOpen"
      :header="t('app.profileEditing')"
      :disable-autofocus="true"
      :footer-buttons="[
        { label: t('app.cancel'), color: 'primary', variant: 'soft', onClick: () => (isModalOpen = false) },
        { label: t('app.save'), color: 'primary', variant: 'solid', onClick: handleSaveProfile }
      ]"
    >
      <div class="space-y-6">
        <UFormGroup label="Имя пользователя">
          <UInput v-model="username" />
        </UFormGroup>
      
        <UFormGroup label="Email">
          <UInput
            v-model="email"
            disabled
            type="email"
          />
        </UFormGroup>
      </div>
    </Modal>
    </div>

    <div class="m-4 mt-auto">
      <AppFooter />
    </div>
  </div>
</template>

<style scoped>
.pb-safe-or-4 {
  padding-bottom: max(env(safe-area-inset-bottom), 1rem);
}
</style>
