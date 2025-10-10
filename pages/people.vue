<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { FriendshipStatus } from '@gql-hub';

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

const { t } = useI18n();
const buttonText = computed(() => {
  if (!isValidEmail.value) return '';
  if (userFound.value === true) return t('app.sendRequest');
  if (userFound.value === false) return t('app.sendInvite');
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
    ? t('app.sendRequest') + ' ' + search.value
    : t('app.sendInvite') + ' ' + search.value;
  toast.add({ title: t('app.notification'), description: message, color: 'primary' });
  search.value = '';
  userFound.value = null;
};

watch(selectedTab, (newTab) => {
  const statusMap: readonly FriendshipStatus[] = [
    FriendshipStatus.Accepted,
    FriendshipStatus.Pending,
    FriendshipStatus.Rejected
  ];
  const next = statusMap[newTab];
  if (next) load(next);
});

onMounted(() => {
  if (token.value) load(FriendshipStatus.Accepted);
});

const columns = computed(() => ([
  { key: 'username', label: t('app.username') },
  { key: 'email', label: t('app.email') },
  { key: 'actions', label: t('app.actions') }
]));

interface FriendRow { id?: string; friend: { id: string; username: string; email: string } }
const items = (row: FriendRow) => ([
  [{
    label: t('app.toRejected'),
  icon: 'lucide:user-minus',
    click: () => console.log('reject', row.id)
  }]
]);

const tabs = computed(() => ([
  { label: t('app.contacts'), icon: 'lucide:book-user' },
  { label: t('app.requests'), icon: 'lucide:user-plus' },
  { label: t('app.rejected'), icon: 'lucide:user-x' }
]));

const selected = ref([]);
</script>

<template>
  <div class="p-4">
    <UCard class="dark:bg-gray-800 shadow-md hover:shadow-sm">
  <h1 class="text-2xl font-bold">{{ t('app.myPeopleHeading') }}</h1>
  <p class="text-gray-600 dark:text-gray-400">{{ t('app.myPeopleSub') }}</p>
      <div class="mt-4 flex gap-2">
  <UInput class="w-80" v-model="search" :placeholder="t('app.searchEmailPlaceholder')" icon="lucide:search" @update:modelValue="searchUser" />
        <UButton v-if="buttonText" @click="sendAction">{{ buttonText }}</UButton>
      </div>
  <p v-if="!isValidEmail && search" class="mt-2 text-sm text-red-500">{{ t('app.invalidEmail') }}</p>
      <p v-if="userFound !== null" class="mt-2 text-sm text-gray-500 dark:text-gray-400">
  {{ userFound ? t('app.userFound') : t('app.userNotFound') }}
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
            :loading-state="{ icon: 'lucide:loader', label: '' }"
            :empty-state="{ icon: 'lucide:bird', label: t('app.emptyTable') }"
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
                <UButton color="gray" variant="ghost" icon="lucide:ellipsis" />
              </UDropdown>
            </template>
          </UTable>
        </div>
      </UCard>
    </div>
  </div>
</template>