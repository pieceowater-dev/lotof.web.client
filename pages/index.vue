<script setup lang="ts">
function myCallback() {
  handleLogin();
}

const handleLogin = () => {
  console.log('Вход');
  // alert('Google auth will be here later');
  tempLoggedIn.value = !tempLoggedIn.value;
};

const handleEditClick = () => {
  console.log('Редактировать');
  alert('Edit will be here later');
};

const apps = [
  { icon: 'i-lucide-rocket', title: 'Менеджер задач', description: 'Управляйте своими проектами и задачами легко и эффективно.', onClick: myCallback },
  { icon: 'i-lucide-calendar', title: 'Календарь', description: 'Планируйте встречи, следите за дедлайнами и организовывайте свое время.', onClick: myCallback },
  { icon: 'i-lucide-user', title: 'Чат', description: 'Общайтесь с коллегами и следите за обсуждениями в реальном времени.', onClick: myCallback },
  { icon: 'i-lucide-file-text', title: 'Документы', description: 'Создавайте, редактируйте и храните важные файлы в одном месте.', onClick: myCallback },
  { icon: 'i-lucide-bar-chart', title: 'Аналитика', description: 'Отслеживайте ключевые показатели и улучшайте продуктивность.', onClick: myCallback },
  { icon: 'i-lucide-settings', title: 'Процессы', description: 'Персонализируйте приложение и настройте его под свои потребности.', onClick: myCallback },
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
