<script setup lang="ts">
import { useRouter } from 'vue-router';
import { hubLogin } from '@/api/hub/auth';

const router = useRouter();

// const handleLogin = () => {
//   console.log('Вход');
//   // alert('Google auth will be here later');
//   tempLoggedIn.value = !tempLoggedIn.value;
// };

const handleLogin = async () => {
  try {
    const data = await hubLogin("pieceowater@gmail.com", "dima3raza");
    console.log("Успешный вход:", data);
    localStorage.setItem("token", data.login.token);
    tempLoggedIn.value = !tempLoggedIn.value;
  } catch (err) {
    console.error("Ошибка авторизации:", err);
  }
};

const handleEditClick = () => {
  alert('Edit will be here later');
};

const apps = [
  { icon: 'i-lucide-qr-code', title: 'Посещаемость', description: 'Следите за посещаемостью своих сотрудников.', onClick: () => router.push('/pieceowater/atrace') }, // A-Trace
  { icon: 'i-lucide-clipboard-check', title: 'Менеджер задач', description: 'Управляйте своими проектами и задачами легко и эффективно.', onClick: null }, // issues
  { icon: 'i-lucide-briefcase-business', title: 'Клиенты & Услуги', description: 'Ведите учет своих клиентов и оказанных услугах.', onClick: null }, // People & Tickets
  { icon: 'i-lucide-route', title: 'Маршруты', description: 'Планируйте и следите за своими сотрудниками в реальном времени.', onClick: null }, // Streets
  { icon: 'i-lucide-file-text', title: 'Отчеты', description: 'Собирайте важные отчеты в одном месте.', onClick: null },
  { icon: 'i-lucide-bar-chart', title: 'Аналитика', description: 'Отслеживайте ключевые показатели и улучшайте продуктивность.', onClick: null },
];

const tempLoggedIn = ref(false);
</script>

<template>

  <IntroSection v-if="!tempLoggedIn" :onAction="handleLogin" />
  <WelcomeSection v-else :userName="'Yury'" :namespaceName="'pieceowater Namespace'" :onAction="handleEditClick" />



  <div class="flex flex-wrap justify-center gap-10 max-w-7xl mx-auto mb-20">
    <div v-for="(app, index) in apps" :key="index">
      <AppCard :icon="app.icon" :title="app.title" :description="app.description" :onClick="app.onClick" />
    </div>
  </div>


  <!-- add real content + design later, reviews, etc., blog feed (infinite scroll) -->

</template>
