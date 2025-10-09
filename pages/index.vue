<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { useRouter } from 'vue-router';
import { hubUpdateMe } from '@/api/hub/updateMe';
import IntroSection from '@/components/IntroSection.vue';
import WelcomeSection from '@/components/WelcomeSection.vue';
import Modal from '@/components/Modal.vue';

// Composables
const { user, isLoggedIn, fetchUser, login, logout } = useAuth();
const { selected: selectedNS, all: allNamespaces, setNamespace, load: loadNamespaces } = useNamespace();

const router = useRouter();

const isModalOpen = ref(false);
const username = ref('');
const email = ref('');
const isLoading = ref(true);

onMounted(async () => {
  await fetchUser();
  await loadNamespaces();
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

const handleAppClick = (app: string) => {
  if (isLoggedIn.value) {
    router.push(`/${selectedNS.value}/${app}`);
  } else {
    login();
  }
};

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

const apps = computed(() => ([
  { icon: 'i-lucide-qr-code', title: t('app.attendance'), description: t('app.attendanceDesc'), onClick: () => handleAppClick('atrace') },
  { icon: 'i-lucide-clipboard-check', title: t('app.tasks'), description: t('app.tasksDesc'), onClick: undefined },
  { icon: 'i-lucide-briefcase', title: t('app.clients'), description: t('app.clientsDesc'), onClick: undefined },
  { icon: 'i-lucide-route', title: t('app.routes'), description: t('app.routesDesc'), onClick: undefined },
  { icon: 'i-lucide-file-text', title: t('app.reports'), description: t('app.reportsDesc'), onClick: undefined },
  { icon: 'i-lucide-headset', title: t('app.calls'), description: t('app.callsDesc'), onClick: undefined },
]));

function handleSwitchNamespace(ns: string) {
  setNamespace(ns);
}

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

  <div class="flex flex-wrap justify-center gap-10 max-w-7xl mx-auto mb-20">
    <div v-for="(app, index) in apps" :key="index">
      <AppCard :icon="app.icon" :title="app.title" :description="app.description" :onClick="app.onClick" />
    </div>
  </div>

  <div class="max-w-6xl mx-auto px-4 py-10 text-gray-700 dark:text-gray-300">
    <h2 class="text-2xl font-bold flex items-center mb-4">
  <UIcon name="i-lucide-briefcase" class="w-5 h-5 mr-2" />
      {{ t('app.businessAutomation') }}
    </h2>
    <p class="mb-4">{{ t('app.businessAutomationLongDesc') }}</p>

    <h2 class="text-2xl font-bold flex items-center mt-8 mb-4">
  <UIcon name="i-lucide-plus-circle" class="w-5 h-5 mr-2" />
      {{ t('app.processOptimization') }}
    </h2>
    <p class="mb-4">{{ t('app.processOptimizationLongDesc') }}</p>

    <h2 class="text-2xl font-bold flex items-center mt-8 mb-4">
  <UIcon name="i-lucide-folder-cog" class="w-5 h-5 mr-2" />
      {{ t('app.flexibility') }}
    </h2>
    <p class="mb-4">{{ t('app.flexibilityLongDesc') }}</p>

    <h2 class="text-2xl font-bold flex items-center mt-8 mb-4">
  <UIcon name="i-lucide-line-chart" class="w-5 h-5 mr-2" />
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
