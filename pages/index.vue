<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch, nextTick } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useRouter } from 'vue-router';
import { ALL_APPS, type AppConfig } from '@/config/apps';
import { hubUpdateMe } from '@/api/hub/updateMe';
import IntroSection from '@/components/IntroSection.vue';
import WelcomeSection from '@/components/WelcomeSection.vue';
import Modal from '@/components/Modal.vue';

// Composables
const { user, isLoggedIn, fetchUser, login, logout } = useAuth();
const { selected: selectedNS, all: allNamespaces, setNamespace, load: loadNamespaces } = useNamespace();

const router = useRouter();
const toast = useToast();

const isModalOpen = ref(false);
const username = ref('');
const email = ref('');
const isLoading = ref(true);
const appInstalled: Record<string, boolean> = reactive({}); // key by bundle
let appsCheckSeq = 0; // sequence guard to avoid race conditions
const installingBundles = new Set<string>(); // prevent double-installs per app

onMounted(async () => {
  await fetchUser();
  await loadNamespaces();
  await checkInstalledForVisibleApps();
  if (user.value) {
    username.value = user.value.username;
    email.value = user.value.email;
  }
  isLoading.value = false;
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
      const hubToken = useCookie<string | null>('token').value;
      if (!hubToken) return login();
      const existing = useCookie<string | null>('atrace-token');
      if (!existing.value) {
        const { atraceGetAppToken } = await import('@/api/atrace/auth/getAppToken');
        const atraceToken = await atraceGetAppToken(hubToken, ns);
        // Persist token on the client so the A-Trace page guard won’t redirect
        useCookie('atrace-token', {
          sameSite: 'lax',
          path: '/',
          expires: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000)
        }).value = atraceToken;
        // Give the cookie a tick to flush before navigating
        await nextTick();
      } else {
        // Token already present — skip extra auth request
        // Optionally: decode and refresh if near expiry
      }
      // Ensure cookie is present before navigating; otherwise, stop and notify
      if (!useCookie<string | null>('atrace-token', { path: '/' }).value) {
        toast.add({ title: 'A-Trace', description: 'Не удалось получить токен приложения. Повторите попытку позже.', color: 'red' });
        return;
      }
    } catch (e) {
      console.error('[atrace] getAppToken failed', e);
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
  const token = useCookie<string | null>('token').value;
  if (!token || !selectedNS.value) return;
  if (installingBundles.has(app.bundle)) return; // guard
  installingBundles.add(app.bundle);
  try {
    const { hubAddAppToNamespace } = await import('@/api/hub/namespaces/addAppToNamespace');
    const res = await hubAddAppToNamespace(token, selectedNS.value, app.bundle);
    console.info('[apps] Installed app into namespace', res);
    // Mark installed and navigate
    appInstalled[app.bundle] = true;
    // Optionally re-check entire list for consistency
    // await checkInstalledForVisibleApps();
    await router.push(`/${selectedNS.value}/${app.address}`);
  } catch (e: any) {
    console.error('[apps] Install failed', e);
    if (typeof window !== 'undefined') {
      console.error(e?.message || 'Failed to install app');
    }
  } finally {
    installingBundles.delete(app.bundle);
  }
}

const handleSaveProfile = async () => {
  const token = useCookie<string | null>('token').value;
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
  const token = useCookie<string | null>('token').value;
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

  <div class="max-w-7xl mx-auto mb-20 px-4 space-y-10">
    <div v-if="activeApps.length">
      <h3 class="text-xl font-semibold mb-4">{{ t('app.installedHead') }}</h3>
      <div class="flex flex-wrap gap-10 justify-start"> 
        <div v-for="(app, index) in activeApps" :key="app.bundle">
          <AppCard v-bind="toCard(app)" />
        </div>
      </div>
    </div>

    <div v-if="possibleApps.length">
      <h3 class="text-xl font-semibold mb-4">{{ t('app.availableHead') }}</h3>
      <div class="flex flex-wrap gap-10 justify-start">
        <div v-for="(app, index) in possibleApps" :key="app.bundle">
          <AppCard v-bind="toCard(app)" />
        </div>
      </div>
    </div>

    <div v-if="comingSoonApps.length">
      <h3 class="text-xl font-semibold mb-4">{{ t('app.comingSoonHead') }}</h3>
      <div class="flex flex-wrap gap-10 justify-start">
        <div v-for="(app, index) in comingSoonApps" :key="app.bundle">
          <AppCard v-bind="toCard(app)" />
        </div>
      </div>
    </div>
  </div>

  <div class="max-w-6xl mx-auto px-4 py-10 text-gray-700 dark:text-gray-300">
    <h2 class="text-2xl font-bold flex items-center mb-4">
  <UIcon name="lucide:briefcase" class="w-5 h-5 mr-2" />
      {{ t('app.businessAutomation') }}
    </h2>
    <p class="mb-4">{{ t('app.businessAutomationLongDesc') }}</p>

    <h2 class="text-2xl font-bold flex items-center mt-8 mb-4">
  <UIcon name="lucide:plus-circle" class="w-5 h-5 mr-2" />
      {{ t('app.processOptimization') }}
    </h2>
    <p class="mb-4">{{ t('app.processOptimizationLongDesc') }}</p>

    <h2 class="text-2xl font-bold flex items-center mt-8 mb-4">
  <UIcon name="lucide:folder-cog" class="w-5 h-5 mr-2" />
      {{ t('app.flexibility') }}
    </h2>
    <p class="mb-4">{{ t('app.flexibilityLongDesc') }}</p>

    <h2 class="text-2xl font-bold flex items-center mt-8 mb-4">
  <UIcon name="lucide:line-chart" class="w-5 h-5 mr-2" />
      {{ t('app.analytics') }}
    </h2>
    <p class="mb-4">{{ t('app.analyticsLongDesc') }}</p>
  </div>

  <Modal v-model="isModalOpen" :header="t('app.profileEditing')" :footerButtons="[
  { label: t('app.logout'), variant: 'link', onClick: () => { handleLogout(); } },
    { label: t('app.cancel'), variant: 'ghost', onClick: () => (isModalOpen = false) },
    { label: t('app.save'), variant: 'solid', onClick: handleSaveProfile }
  ]">
    <UFormGroup class="mb-5" label="Имя пользователя">
      <UInput v-model="username" />
    </UFormGroup>
    <UFormGroup label="Email">
      <UInput disabled v-model="email" type="email" />
    </UFormGroup>
    <UFormGroup :label="t('app.language')">
      <USelect :options="[{label:'English',value:'en'},{label:'Русский',value:'ru'}]" v-model="locale" />
    </UFormGroup>
  </Modal>

  <div class="m-2">
    <AppFooter />
  </div>
</template>
