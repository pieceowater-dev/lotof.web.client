<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';

const { token } = useAuth();
const { rows: friends, load, loading } = useFriendships();

const search = ref('');
const userFound = ref<boolean | null>(null);
const toast = useToast();
const selectedTab = ref(0);

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

watch(selectedTab, (newTab) => {
  const statusMap = ['ACCEPTED', 'PENDING', 'REJECTED'] as const;
  load(statusMap[newTab]);
});

onMounted(() => {
  if (token.value) load('ACCEPTED');
});

const columns = [{
  key: 'username',
  label: 'Имя пользователя'
}, {
  key: 'email',
  label: 'Электронная почта'
}, {
  key: 'actions',
  label: 'Действия'
}];

interface FriendRow { id?: string; friend: { id: string; username: string; email: string } }
const items = (row: FriendRow) => [
  [{
    label: 'В отклоненные',
    icon: 'i-lucide-user-round-minus',
    click: () => console.log('В отклоненные', row.id)
  }]
];

const tabs = [{
  label: 'Контакты',
  icon: 'i-lucide-book-user'
}, {
  label: 'Запросы',
  icon: 'i-lucide-user-round-plus'
}, {
  label: 'Отклоненные',
  icon: 'i-lucide-user-round-x'
}];

const selected = ref([]);
</script>

<template>
  <div class="p-4">
    <UCard class="dark:bg-gray-800 shadow-md hover:shadow-sm">
      <h1 class="text-2xl font-bold">Мои люди</h1>
      <p class="text-gray-600 dark:text-gray-400">Добавьте в контакты своих друзей и коллег!</p>
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
      <UTabs v-model="selectedTab" :items="tabs" />
      <UCard class="dark:bg-gray-800 shadow-md hover:shadow-sm mt-4">
        <div class="overflow-auto">
          <UTable
            :rows="friends"
            :columns="columns"
            :loading="loading"
            :loading-state="{ icon: 'i-lucide-loader', label: '' }"
            :empty-state="{ icon: 'i-lucide-bird', label: 'Тут пока ничего нет!' }"
            :progress="{ color: 'primary', animation: 'carousel' }"
            class="w-full"
            hover
          >
            <template #username-data="{ row }">
              <span>{{ row.friend.username }}</span>
            </template>

            <template #email-data="{ row }">
              <span>{{ row.friend.email }}</span>
            </template>

            <template #actions-data="{ row }">
              <UDropdown :items="items(row)">
                <UButton color="gray" variant="ghost" icon="i-heroicons-ellipsis-horizontal-20-solid" />
              </UDropdown>
            </template>
          </UTable>
        </div>
      </UCard>
    </div>
  </div>
</template>