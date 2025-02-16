<script setup>
function myCallback() {
  alert('Google auth will be here later');
}

const apps = [
  { icon: 'i-lucide-rocket', title: 'Менеджер задач', description: 'Управляйте своими проектами и задачами легко и эффективно.', onClick: myCallback },
  { icon: 'i-lucide-calendar', title: 'Календарь', description: 'Планируйте встречи, следите за дедлайнами и организовывайте свое время.', onClick: myCallback },
  { icon: 'i-lucide-user', title: 'Чат', description: 'Общайтесь с коллегами и следите за обсуждениями в реальном времени.', onClick: myCallback },
  { icon: 'i-lucide-file-text', title: 'Документы', description: 'Создавайте, редактируйте и храните важные файлы в одном месте.', onClick: myCallback },
  { icon: 'i-lucide-bar-chart', title: 'Аналитика', description: 'Отслеживайте ключевые показатели и улучшайте продуктивность.', onClick: myCallback },
  { icon: 'i-lucide-settings', title: 'Процессы', description: 'Персонализируйте приложение и настройте его под свои потребности.', onClick: myCallback },
];
</script>

<template>
  <div class="flex flex-col items-center justify-center min-h-[80vh] text-center">
    <div>
      <!-- todo: logo will be here later -->
    </div>
    <span class="text-3xl font-bold">Все, что надо.</span>
    <span class="text-xl text-gray-600 dark:text-gray-400">Сервисы для успешной работы в команде</span>

    <UButton icon="i-lucide-rocket" color="primary" variant="solid" :ui="{
      leadingIcon: 'text-(--ui-primary)'
    }" class="mt-8" @click="myCallback">
      Войти
    </UButton>


  </div>

  <div class="flex flex-wrap justify-center gap-10 max-w-7xl mx-auto">
    <div v-for="(app, index) in apps" :key="index">
      <AppCard :icon="app.icon" :title="app.title" :description="app.description" :onClick="app.onClick" />
    </div>
  </div>


  <div class="max-w-6xl mx-auto my-20">
    <div class="flex flex-col items-center justify-center my-10">
      <span class="text-3xl font-bold">Какой-то текст?</span>
      <span class="text-xl text-gray-600 dark:text-gray-400">Вашему вниманию отвратительный аккордион!</span>
    </div>

    <Accordion />
  </div>

</template>
