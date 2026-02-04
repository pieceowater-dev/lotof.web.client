<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { logError } from '@/utils/logger';
import { FriendshipStatus } from '@gql-hub';
import { CookieKeys, LSKeys } from '@/utils/storageKeys';
import AppTable from '@/components/ui/AppTable.vue'

const { token, user } = useAuth();
const { rows: friends, applyLoaded: applyLoadedFriends, load, loading } = useFriendships();

const search = ref('');
const userFound = ref<boolean | null>(null);
const foundUser = ref<{ id: string; email: string; username: string } | null>(null);
const toast = useToast();
const selectedTab = ref(0); // default to Contacts (Accepted)

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

const searchUser = async () => {
  foundUser.value = null;
  if (!isValidEmail.value || !token.value) {
    userFound.value = null;
    return;
  }
  try {
    const { hubFindUserByEmail } = await import('@/api/hub/users/search');
    const u = await hubFindUserByEmail(token.value, search.value.trim());
    // Prevent sending request to self
    if (u && (u.id === (user.value?.id) || u.email.toLowerCase() === (user.value?.email || '').toLowerCase())) {
      foundUser.value = null;
      userFound.value = null;
  toast.add({ title: t('app.notification'), description: t('app.cannotAddSelf'), color: 'orange' });
    } else {
      foundUser.value = u;
      userFound.value = !!u;
    }
  } catch (e) {
    userFound.value = null;
  }
};

const sendAction = async () => {
  if (!isValidEmail.value || !token.value) return;
  // If user not found -> send invite to selected namespace
  if (!foundUser.value) {
    try {
      const { selected: selectedNS } = useNamespace();
      const nsSlug = selectedNS.value;
      if (!nsSlug) {
        toast.add({ title: t('app.notification'), description: t('app.userNotFound'), color: 'orange' });
        return;
      }
      const { hubCreateInvite } = await import('@/api/hub/invite/create');
      const email = search.value.trim();
      // Minimal actions payload with version and empty operations
      const actions = JSON.stringify({ version: 1, 'pieceowater.atrace': [] });
      await hubCreateInvite(token.value, { namespaceSlug: nsSlug, email, actions });
      toast.add({ title: t('app.notification'), description: t('app.sendInvite') + ' ' + email, color: 'primary' });
      search.value = '';
      userFound.value = null;
      foundUser.value = null;
    } catch (e: any) {
      const msg: string = e?.response?.errors?.[0]?.message || e?.message || 'Error';
      toast.add({ title: t('app.notification'), description: msg, color: 'red' });
    }
    return;
  }
  try {
    const { hubCreateFriendship } = await import('@/api/hub/friendships/mutations');
    const created = await hubCreateFriendship(token.value, foundUser.value.id);
    toast.add({ title: t('app.notification'), description: t('app.sendRequest') + ' ' + foundUser.value.email, color: 'primary' });
    search.value = '';
    userFound.value = null;
    foundUser.value = null;
    // reload pending tab
    selectedTab.value = 1; // Pending
  } catch (e: any) {
    const msg: string = e?.response?.errors?.[0]?.message || e?.message || 'Error';
    // Show clearer message, do not logout on backend business error
    if (/user id mismatch/i.test(msg)) {
      toast.add({ title: t('app.notification'), description: t('app.identityMismatch'), color: 'red' });
    } else {
      toast.add({ title: t('app.notification'), description: msg, color: 'red' });
    }
  }
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

// Bootstrap загрузка всех данных одним запросом
onMounted(async () => {
  if (!token.value) return;
  
  // Сначала загрузить bootstrap данные
  try {
    const { applyLoaded: applyLoadedNS, idBySlug } = useNamespace();
    const { hubPeopleBootstrap } = await import('@/api/hub/peopleBootstrap');
    
    // Определяем namespace ID для загрузки members (используем сохраненный или null)
    const stored = process.client ? localStorage.getItem('selected_namespace') : null;
    let nsId: string | undefined = undefined;
    
    // Сначала загружаем данные без указания namespace, чтобы получить список namespaces
    const data = await hubPeopleBootstrap(token.value, nsId);
    
    // Применить загруженные данные к composables
    applyLoadedNS(data.namespaces.rows, token.value);
    applyLoadedFriends(data.myFriends.rows, FriendshipStatus.Accepted);
    
    // Теперь определяем namespace для members
    const { selected: selectedNS, all: allNamespaces } = useNamespace();
    const nsSlug = stored || allNamespaces.value[0];
    if (nsSlug) {
      nsId = idBySlug(nsSlug);
      if (nsId) {
        // Перезагружаем members для выбранного namespace
        nsMembers.value = data.members;
      }
    }
    
    // Установить опции для dropdown друзей
    const existingUserIds = new Set(data.members.map(m => m.userId));
    friendOptions.value = data.friendsForDropdown.rows
      .filter(r => !existingUserIds.has(r.friend.id))
      .map(r => ({ label: `${r.friend.username} (${r.friend.email})`, value: r.friend.id }));
    const loaded = friendOptions.value.length;
    friendHasMore.value = loaded < data.friendsForDropdown.info.count;
    if (friendHasMore.value) friendPage.value = 2;
  } catch (e) {
    logError('[people bootstrap] load error', e);
    // Fallback к обычной загрузке
    if (token.value) load(FriendshipStatus.Accepted);
    await loadNamespaces();
  }
  
  // Применить сохраненный namespace
  if (user.value?.id) {
    applyStoredNamespace();
  }
  // Если ничего не выбрано, выбрать первый
  if (!selectedNS.value && allNamespaces.value.length > 0) {
    selectedNS.value = allNamespaces.value[0];
  }
});

const columns = computed(() => ([
  { key: 'username', label: t('app.username') },
  { key: 'email', label: t('app.email') },
  { key: 'actions', label: t('app.actions') }
]));

interface FriendRow { id: string; status: FriendshipStatus; friend: { id: string; username: string; email: string } }
const items = (row: FriendRow) => ([
  [
    ...(row.status === FriendshipStatus.Pending ? [{
      label: t('app.accept'), icon: 'lucide:check',
      click: async () => {
        if (!token.value) return;
        const { hubAcceptFriendship } = await import('@/api/hub/friendships/mutations');
        await hubAcceptFriendship(token.value, row.id);
        toast.add({ title: t('app.notification'), description: t('app.accepted'), color: 'primary' });
        load(FriendshipStatus.Accepted);
      }
    }] : []),
    { label: t('app.toRejected'), icon: 'lucide:user-minus', click: async () => {
      if (!token.value) return;
      const { hubRemoveFriendship } = await import('@/api/hub/friendships/mutations');
      await hubRemoveFriendship(token.value, row.id);
      toast.add({ title: t('app.notification'), description: t('app.toRejected'), color: 'orange' });
      load(FriendshipStatus.Rejected);
    }}
  ]
]);

const tabs = computed(() => ([
  { label: t('app.contacts'), icon: 'lucide:book-user' },
  { label: t('app.requests'), icon: 'lucide:user-plus' },
  { label: t('app.rejected'), icon: 'lucide:user-x' }
]));

const selected = ref([]);

// Pagination for friends table
const friendsPage = ref(1);
const friendsPageCount = ref(10);
const paginatedFriends = computed(() => {
  const start = (friendsPage.value - 1) * friendsPageCount.value;
  const end = start + friendsPageCount.value;
  return friends.value.slice(start, end);
});

// Namespace switcher + Members table
const { selected: selectedNS, all: allNamespaces, titleBySlug, load: loadNamespaces } = useNamespace();
function applyStoredNamespace() {
  if (!process.client) return;
  try {
    const uid = (useAuth().user.value?.id) || 'anon';
    const mapRaw = localStorage.getItem(LSKeys.SELECTED_NAMESPACE_BY_USER);
    const legacy = localStorage.getItem(LSKeys.SELECTED_NAMESPACE);
    let stored: string | null = null;
    if (mapRaw) {
      const map = JSON.parse(mapRaw || '{}') as Record<string, string>;
      stored = map[uid] || null;
    }
    if (!stored) stored = legacy;
    if (stored && allNamespaces.value.includes(stored)) {
      selectedNS.value = stored;
    }
  } catch {}
}
const nsMembers = ref<Array<{ id: string; userId: string; username: string; email: string }>>([]);
const membersLoading = ref(false);
const loadMembers = async () => {
  const tok = useCookie<string | null>(CookieKeys.TOKEN).value;
  if (!tok || !selectedNS.value) { nsMembers.value = []; return; }
  membersLoading.value = true;
  try {
    const { hubMembersList } = await import('@/api/hub/members/list');
    // We need namespaceId (UUID); resolve from slug via composable idBySlug
    const { idBySlug } = useNamespace();
    const nsId = idBySlug(selectedNS.value);
    if (!nsId) { nsMembers.value = []; membersLoading.value = false; return; }
    nsMembers.value = await hubMembersList(tok, nsId, 1, 'TEN');
  } catch (e) {
    nsMembers.value = [];
  } finally {
    membersLoading.value = false;
  }
};

watch(() => selectedNS.value, () => { loadMembers(); });
// When namespaces arrive (e.g., after full page reload), ensure selection is valid and load members
watch(() => allNamespaces.value, (list) => {
  const { idBySlug } = useNamespace();
  // Only apply if user is loaded (not anon)
  if (user.value?.id) applyStoredNamespace();
  if (!selectedNS.value && list.length > 0) {
    selectedNS.value = list[0];
    return; // watch on selectedNS will load members
  }
  if (selectedNS.value && idBySlug(selectedNS.value)) {
    loadMembers();
  }
});
// When user loads (post-SSR), reapply stored namespace in case we initially used 'anon'
watch(() => user.value?.id, (userId) => {
  if (userId && allNamespaces.value.length > 0) {
    applyStoredNamespace();
  }
});

// Reload friend dropdown when members change to filter out newly added ones
watch(() => nsMembers.value, () => { loadMoreFriends(true); });

// Pagination for namespace members table
const membersPage = ref(1);
const membersPageCount = ref(10);
const paginatedMembers = computed(() => {
  const start = (membersPage.value - 1) * membersPageCount.value;
  const end = start + membersPageCount.value;
  return nsMembers.value.slice(start, end);
});

// Searchable + infinite-scroll accepted friends dropdown
const friendSearch = ref('');
const friendOptions = ref<Array<{ label: string; value: string }>>([]);
const friendPage = ref(1);
const friendHasMore = ref(true);
const friendLoading = ref(false);
const friendToAdd = ref<string>('');

async function loadMoreFriends(reset = false) {
  const tok = useCookie<string | null>(CookieKeys.TOKEN).value;
  if (!tok) return;
  if (reset) {
    friendPage.value = 1;
    friendOptions.value = [];
    friendHasMore.value = true;
  }
  if (!friendHasMore.value || friendLoading.value) return;
  friendLoading.value = true;
  try {
    const { hubSearchAcceptedFriends } = await import('@/api/hub/friendships/searchAccepted');
    const page = friendPage.value;
    const { rows, count } = await hubSearchAcceptedFriends(tok, friendSearch.value, page, 25);
    // Exclude users already in the namespace
    const existingUserIds = new Set(nsMembers.value.map(m => m.userId));
    const mapped = rows
      .filter(r => !existingUserIds.has(r.friend.id))
      .map(r => ({ label: `${r.friend.username} (${r.friend.email})`, value: r.friend.id }));
    friendOptions.value = reset ? mapped : friendOptions.value.concat(mapped);
    const loaded = friendOptions.value.length;
    friendHasMore.value = loaded < count;
    if (friendHasMore.value) friendPage.value += 1;
  } catch (e) {
    logError('[friends dropdown] load error', e);
    friendHasMore.value = false;
  } finally {
    friendLoading.value = false;
  }
}

watch(friendSearch, () => loadMoreFriends(true));
// onMounted будет заменен на bootstrap загрузку ниже
async function addMemberFromFriend(friendUserId: string) {
  const tok = useCookie<string | null>(CookieKeys.TOKEN).value;
  const { idBySlug } = useNamespace();
  const nsId = idBySlug(selectedNS.value);
  if (!tok || !nsId) return;
  try {
    const { hubAddMember } = await import('@/api/hub/members/mutations');
    await hubAddMember(tok, nsId, friendUserId);
    toast.add({ title: t('app.notification'), description: t('app.added'), color: 'primary' });
    await loadMembers();
  } catch (e: any) {
    toast.add({ title: t('app.notification'), description: e?.message || 'Error', color: 'red' });
  }
}

async function removeMember(userId: string) {
  const tok = useCookie<string | null>(CookieKeys.TOKEN).value;
  const { idBySlug } = useNamespace();
  const nsId = idBySlug(selectedNS.value);
  if (!tok || !nsId) return;
  try {
    const { hubRemoveMember } = await import('@/api/hub/members/mutations');
    await hubRemoveMember(tok, nsId, userId);
    toast.add({ title: t('app.notification'), description: 'Removed', color: 'orange' });
    await loadMembers();
  } catch (e: any) {
    toast.add({ title: t('app.notification'), description: e?.message || 'Error', color: 'red' });
  }
}
</script>

<template>
  <div class="p-4 md:p-6 lg:p-8 min-h-screen">
    <!-- Header with Search -->
    <div class="mb-6">
      <h1 class="text-2xl md:text-3xl font-bold mb-4">{{ t('app.myPeopleHeading') }}</h1>
      <UCard class="shadow-sm">
        <div class="flex flex-row gap-3 items-center">
          <UInput 
            class="flex-1 md:max-w-lg" 
            v-model="search" 
            :placeholder="t('app.searchEmailPlaceholder')" 
            icon="lucide:search" 
            size="md" 
            @update:modelValue="searchUser" 
          />
          <UButton 
            v-if="buttonText" 
            @click="sendAction" 
            size="md" 
            class="flex-shrink-0"
          >
            {{ buttonText }}
          </UButton>
        </div>
        <div v-if="!isValidEmail && search" class="mt-2">
          <p class="text-sm text-red-500">{{ t('app.invalidEmail') }}</p>
        </div>
        <div v-if="userFound !== null" class="mt-2">
          <p class="text-sm text-gray-600 dark:text-gray-400">
            {{ userFound ? t('app.userFound') : t('app.userNotFound') }}
          </p>
        </div>
      </UCard>
    </div>
    
    <!-- Main Content -->
    <div class="flex flex-col gap-6">
      <!-- Friends / Requests section -->
      <UCard class="shadow-sm">
        <template #header>
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold">{{ t('app.contacts') }}</h2>
          </div>
        </template>
        
        <div>
          <UTabs v-model="selectedTab" :items="tabs" class="mb-4" />
          <div>
            <AppTable
              v-model:page="friendsPage"
              v-model:pageCount="friendsPageCount"
              :total="friends.length"
              :rows="paginatedFriends"
              :columns="columns"
              :loading="loading"
              :pagination="true"
            >
              <template #username-data="{ row }">
                <span class="font-medium">{{ row.friend.username }}</span>
              </template>

              <template #email-data="{ row }">
                <span class="text-gray-600 dark:text-gray-400">{{ row.friend.email }}</span>
              </template>

              <template #actions-data="{ row }">
                <UDropdown :items="items(row)">
                  <UButton color="gray" variant="ghost" icon="lucide:ellipsis" />
                </UDropdown>
              </template>
            </AppTable>
          </div>
        </div>
      </UCard>

      <!-- Namespace members section -->
      <UCard class="shadow-sm">
        <template #header>
          <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <h2 class="text-lg font-semibold">{{ t('app.namespaceMembers') }}</h2>
            <USelect
              :options="allNamespaces.map(slug => ({ label: titleBySlug(slug) || slug, value: slug }))"
              v-model="selectedNS"
              size="md"
              class="w-full md:w-auto md:min-w-[250px]"
            />
          </div>
        </template>

        <div>
          <div class="mb-4">
            <USelectMenu
              searchable
              v-model="friendToAdd"
              :options="friendOptions"
              :searchable-placeholder="t('app.search')"
              :search-value="friendSearch"
              @update:search-value="(val: string) => friendSearch = val as any"
              @scroll-bottom="() => loadMoreFriends(false)"
              :loading="friendLoading"
              :placeholder="t('app.selectFriend')"
              size="md"
              class="w-full md:max-w-lg"
              @change="(val: any) => { const id = typeof val === 'string' ? val : (val && (val as any).value); if (id) { addMemberFromFriend(id); friendToAdd = ''; } }"
            >
              <template #leading>
                <UIcon name="lucide:user-plus" class="w-5 h-5" />
              </template>
            </USelectMenu>
          </div>

          <div>
            <AppTable
              v-model:page="membersPage"
              v-model:pageCount="membersPageCount"
              :total="nsMembers.length"
              :rows="paginatedMembers"
              :columns="[
                { key: 'username', label: t('app.username') },
                { key: 'email', label: t('app.email') },
                { key: 'actions', label: '' }
              ]"
              :loading="membersLoading"
              :pagination="true"
            >
              <template #username-data="{ row }">
                <span class="font-medium truncate">{{ row.username }}</span>
              </template>
              <template #email-data="{ row }">
                <span class="text-gray-600 dark:text-gray-400 truncate">{{ row.email }}</span>
              </template>
              <template #actions-data="{ row }">
                <UButton color="red" variant="ghost" icon="lucide:trash-2" @click="removeMember(row.userId)" />
              </template>
            </AppTable>
          </div>
        </div>
      </UCard>
    </div>
  </div>
</template>