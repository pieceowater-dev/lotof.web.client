<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useCookies } from '@vueuse/integrations/useCookies';
import { hubLogin } from '@/api/hub/auth';
import { hubMe } from '@/api/hub/me';
import IntroSection from '@/components/IntroSection.vue';
import WelcomeSection from '@/components/WelcomeSection.vue';
import Modal from '@/components/Modal.vue';

const router = useRouter();
const cookies = useCookies(['token', 'userId']);

const isLoggedIn = ref(false);
const isModalOpen = ref(false);
const username = ref('');
const email = ref('');
const isLoading = ref(true);

const checkAuth = async () => {
  const token = cookies.get('token');
  if (token) {
    isLoggedIn.value = true;
    await fetchUserData(token);
  }
  isLoading.value = false;
};

const handleLogin = async () => {
  try {
    const data = await hubLogin("pieceowater@gmail.com", "dima3raza"); // todo: temporary
    cookies.set('token', data.login.token, { path: '/', maxAge: 360000 }); 
    cookies.set('userId', data.login.user.id, { path: '/', maxAge: 360000 });
    isLoggedIn.value = true;
    await fetchUserData(data.login.token);
  } catch (err) {
    console.error("Ошибка авторизации:", err);
  }
};

const fetchUserData = async (token: string) => {
  try {
    const userData = await hubMe(token);
    username.value = userData.username;
    email.value = userData.email;
  } catch (error) {
    console.error('Ошибка при получении данных пользователя:', error);
  }
};

const handleLogout = () => {
  cookies.remove('token');
  cookies.remove('userId');
  isLoggedIn.value = false;
  username.value = '';
  email.value = '';
};

const greeting = computed(() => {
  const hours = new Date().getHours();
  if (hours >= 0 && hours < 4) return 'Доброй ночи';
  if (hours < 12) return 'Доброе утро';
  if (hours < 18) return 'Добрый день';
  return 'Добрый вечер';
});

watch(() => cookies.get('token'), (newToken) => {
  isLoggedIn.value = !!newToken;
  if (newToken) {
    fetchUserData(newToken);
  }
});

onMounted(checkAuth);

const apps = [
  { icon: 'i-lucide-qr-code', title: 'Посещаемость', description: 'Следите за посещаемостью своих сотрудников.', onClick: () => router.push('/pieceowater/atrace') },
  { icon: 'i-lucide-clipboard-check', title: 'Менеджер задач', description: 'Управляйте своими проектами и задачами легко и эффективно.', onClick: null },
  { icon: 'i-lucide-briefcase-business', title: 'Клиенты & Услуги', description: 'Ведите учет своих клиентов и оказанных услугах.', onClick: null },
  { icon: 'i-lucide-route', title: 'Маршруты', description: 'Планируйте и следите за своими сотрудниками в реальном времени.', onClick: null },
  { icon: 'i-lucide-file-text', title: 'Отчеты', description: 'Собирайте важные отчеты в одном месте.', onClick: null },
  { icon: 'i-lucide-headset', title: 'Звонки', description: 'Отслеживайте входящие звонки и их уникальность.', onClick: null },
];
</script>

<template>
  <div v-if="isLoading" class="flex flex-col items-center text-center justify-center space-y-4 min-h-[65vh]">
    <USkeleton class="h-12 w-12" :ui="{ rounded: 'rounded-full' }" />
    <USkeleton class="h-4 w-[250px]" />
    <USkeleton class="h-4 w-[200px]" />
  </div>
  
    <template v-else>
      <IntroSection v-if="!isLoggedIn" :onAction="handleLogin" />
      <WelcomeSection v-else 
        :greeting="greeting" 
        :username="username" 
        @edit-profile="isModalOpen = true" 
      />
    </template>
    
    <div class="flex flex-wrap justify-center gap-10 max-w-7xl mx-auto mb-20">
      <div v-for="(app, index) in apps" :key="index">
        <AppCard :icon="app.icon" :title="app.title" :description="app.description" :onClick="app.onClick" />
      </div>
    </div>
  

  <Modal v-model="isModalOpen" header="Редактирование профиля" :footerButtons="[
    { label: 'Выйти из аккаунта', variant: 'link', onClick: () => { handleLogout(); isModalOpen = false; } },
    { label: 'Отмена', variant: 'ghost', onClick: () => (isModalOpen = false) },
    { label: 'Сохранить', variant: 'solid', onClick: () => (isModalOpen = false) }
  ]">
    <UFormGroup class="mb-5" label="Имя пользователя">
      <UInput v-model="username" />
    </UFormGroup>
    <UFormGroup label="Email">
      <UInput v-model="email" type="email" />
    </UFormGroup>
  </Modal>
</template>