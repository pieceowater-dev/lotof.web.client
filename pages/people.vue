<script setup>
import { ref, computed } from 'vue';

const search = ref('');
const userFound = ref(null);
const toast = useToast();

const isValidEmail = computed(() => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(search.value);
});

const buttonText = computed(() => {
  if (!isValidEmail.value) return '';
  if (userFound.value === true) return 'Отправить запрос';
  if (userFound.value === false) return 'Отправить приглашение';
  return '';
});

const searchUser = () => {
  if (!isValidEmail.value) {
    userFound.value = null;
    return;
  }
  setTimeout(() => {
    userFound.value = Math.random() > 0.5;
  }, 500);
};

const sendAction = () => {
  if (!isValidEmail.value) return;
  
  const message = userFound.value 
    ? `Запрос отправлен пользователю ${search.value}`
    : `Приглашение отправлено пользователю ${search.value}`;
  
  toast.add({ title: 'Уведомление', description: message, color: 'primary' });
  search.value = '';
  userFound.value = null;
};
</script>

<template>
  <div class="p-4">
    <UCard class="dark:bg-gray-800 shadow-md hover:shadow-sm">
      <h1 class="text-2xl font-bold">Мои люди</h1>
      <p class="text-gray-600 dark:text-gray-400">Добавьте сюда своих друзей и коллег!</p>
      <div class="mt-4 flex gap-2">
        <UInput class="w-80" v-model="search" placeholder="Поиск по email..." icon="i-heroicons-magnifying-glass" @update:modelValue="searchUser" />
        <UButton v-if="buttonText" @click="sendAction">{{ buttonText }}</UButton>
      </div>
      <p v-if="!isValidEmail && search" class="mt-2 text-sm text-red-500">Введите корректный email</p>
      <p v-if="userFound !== null" class="mt-2 text-sm text-gray-500 dark:text-gray-400">
        {{ userFound ? 'Пользователь найден, отправьте запрос для подтверждения.' : 'Пользователь не найден, отправьте приглашение.' }}
      </p>
    </UCard>
    
    <div class="mt-6">
      <Table />
    </div>
  </div>
</template>