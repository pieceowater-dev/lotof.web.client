<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { hubUpdateMe } from '@/api/hub/updateMe';
import IntroSection from '@/components/IntroSection.vue';
import WelcomeSection from '@/components/WelcomeSection.vue';
import Modal from '@/components/Modal.vue';

// Composables
const { user, isLoggedIn, fetchUser, login, logout } = useAuth();
const { selected: selectedNS, all: allNamespaces, setNamespace } = useNamespace();

const router = useRouter();

const isModalOpen = ref(false);
const username = ref('');
const email = ref('');
const isLoading = ref(true);

onMounted(async () => {
  await fetchUser();
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

const greeting = computed(() => {
  const hours = new Date().getHours();
  if (hours >= 0 && hours < 4) return 'Доброй ночи';
  if (hours < 12) return 'Доброе утро';
  if (hours < 18) return 'Добрый день';
  return 'Добрый вечер';
});

const apps = [
  { icon: 'i-lucide-qr-code', title: 'Посещаемость', description: 'Следите за посещаемостью своих сотрудников.', onClick: () => handleAppClick('atrace') },
  { icon: 'i-lucide-clipboard-check', title: 'Менеджер задач', description: 'Управляйте своими проектами и задачами легко и эффективно.', onClick: undefined },
  { icon: 'i-lucide-briefcase-business', title: 'Клиенты & Услуги', description: 'Ведите учет своих клиентов и оказанных услугах.', onClick: undefined },
  { icon: 'i-lucide-route', title: 'Маршруты', description: 'Планируйте и следите за своими сотрудниками в реальном времени.', onClick: undefined },
  { icon: 'i-lucide-file-text', title: 'Отчеты', description: 'Собирайте важные отчеты в одном месте.', onClick: undefined },
  { icon: 'i-lucide-headset', title: 'Звонки', description: 'Отслеживайте входящие звонки и их уникальность.', onClick: undefined },
];

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
      Умная автоматизация бизнеса
    </h2>
    <p class="mb-4">Наше приложение создано для того, чтобы избавить вас от рутины. Контролируйте посещаемость
      сотрудников, управляйте задачами и клиентами в одном удобном интерфейсе. Система интегрируется с передовыми
      сервисами, позволяя вести учет без лишних усилий.</p>

    <h2 class="text-2xl font-bold flex items-center mt-8 mb-4">
      <UIcon name="i-lucide-circle-fading-plus" class="w-5 h-5 mr-2" />
      Оптимизация рабочих процессов
    </h2>
    <p class="mb-4">Благодаря автоматизированному подходу вы сможете минимизировать затраты времени на рутинные задачи.
      Приложение помогает отслеживать эффективность сотрудников, анализировать данные и оперативно принимать решения.
    </p>

    <h2 class="text-2xl font-bold flex items-center mt-8 mb-4">
      <UIcon name="i-lucide-folder-cog" class="w-5 h-5 mr-2" />
      Гибкость и удобство
    </h2>
    <p class="mb-4">Мы предлагаем интуитивно понятный интерфейс, который легко адаптируется под потребности вашего
      бизнеса. Независимо от масштаба компании, система поможет вам организовать работу наиболее эффективным способом.
    </p>

    <h2 class="text-2xl font-bold flex items-center mt-8 mb-4">
      <UIcon name="i-lucide-chart-no-axes-combined" class="w-5 h-5 mr-2" />
      Аналитика и контроль
    </h2>
    <p class="mb-4">Отчеты и визуализация данных помогают вам всегда быть в курсе текущих процессов. Получайте ключевую
      информацию в удобном формате и повышайте продуктивность команды.</p>
  </div>

  <Modal v-model="isModalOpen" header="Редактирование профиля" :footerButtons="[
  { label: 'Выйти из аккаунта', variant: 'link', onClick: () => { handleLogout(); } },
    { label: 'Отмена', variant: 'ghost', onClick: () => (isModalOpen = false) },
    { label: 'Сохранить', variant: 'solid', onClick: handleSaveProfile }
  ]">
    <UFormGroup class="mb-5" label="Имя пользователя">
      <UInput v-model="username" />
    </UFormGroup>
    <UFormGroup label="Email">
      <UInput disabled v-model="email" type="email" />
    </UFormGroup>
  </Modal>

  <div class="m-2">
    <AppFooter />
  </div>
</template>
