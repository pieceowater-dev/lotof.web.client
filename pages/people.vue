<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { logError } from '@/utils/logger';
import { FriendshipStatus, FilterPaginationLengthEnum } from '@gql-hub';
import { CookieKeys, LSKeys } from '@/utils/storageKeys';
import { getErrorMessage } from '@/utils/types/errors';
import { getInitials, getAvatarPalette } from '@/utils/avatar';

const { token, user } = useAuth();
const { rows: friends, applyLoaded: applyLoadedFriends, load, loading, currentStatus } = useFriendships();
const { confirm } = useConfirm();

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
const searching = ref(false);

let searchDebounce: ReturnType<typeof setTimeout> | null = null;
watch(search, () => {
  if (searchDebounce) clearTimeout(searchDebounce);
  if (!isValidEmail.value) {
    foundUser.value = null;
    userFound.value = null;
    return;
  }
  searchDebounce = setTimeout(searchUser, 350);
});

const searchUser = async () => {
  foundUser.value = null;
  if (!isValidEmail.value || !token.value) {
    userFound.value = null;
    return;
  }
  searching.value = true;
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
  } finally {
    searching.value = false;
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
      // Plain namespace invite: no app-specific bundle, so no downstream app
      // gateway is dispatched to on acceptance (see hub.msvc.namespaces'
      // HandleInviteActions, which only processes bundles present here).
      const actions = JSON.stringify({ version: 1 });
      await hubCreateInvite(token.value, { namespaceSlug: nsSlug, email, actions });
      toast.add({ title: t('app.sendInvite'), description: email, color: 'blue' });
      search.value = '';
      userFound.value = null;
      foundUser.value = null;
    } catch (e: any) {
      const msg = getErrorMessage(e) || (t('common.genericError') || 'Something went wrong. Please try again.');
      toast.add({ title: t('app.notification'), description: msg, color: 'red' });
    }
    return;
  }
  try {
    const { hubCreateFriendship } = await import('@/api/hub/friendships/mutations');
    await hubCreateFriendship(token.value, foundUser.value.id);
    toast.add({ title: t('app.sendRequest'), description: foundUser.value.email, color: 'blue' });
    search.value = '';
    userFound.value = null;
    foundUser.value = null;
    // reload pending tab
    selectedTab.value = 1; // Pending
  } catch (e: any) {
    const msg = getErrorMessage(e) || (t('common.genericError') || 'Something went wrong. Please try again.');
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

interface FriendRow { id: string; status: FriendshipStatus; initiatedByMe?: boolean; friend: { id: string; username: string; email: string } }

const friendsFilter = ref('');
const filteredFriends = computed(() => {
  const q = friendsFilter.value.trim().toLowerCase();
  const rows = friends.value as FriendRow[];
  if (!q) return rows;
  return rows.filter(r => r.friend.username?.toLowerCase().includes(q) || r.friend.email?.toLowerCase().includes(q));
});

async function acceptRequest(row: FriendRow) {
  if (!token.value) return;
  const { hubAcceptFriendship } = await import('@/api/hub/friendships/mutations');
  await hubAcceptFriendship(token.value, row.id);
  toast.add({ title: t('app.accepted'), description: row.friend.username, color: 'emerald' });
  selectedTab.value = 0;
}

async function rejectRequest(row: FriendRow) {
  if (!token.value) return;
  const ok = await confirm({
    message: t('app.confirmRejectFriendMessage') || 'This request will be moved to rejected.',
    confirmLabel: t('app.toRejected') || 'Reject',
    color: 'amber',
    icon: 'lucide:user-x',
  });
  if (!ok) return;
  const { hubRejectFriendship } = await import('@/api/hub/friendships/mutations');
  await hubRejectFriendship(token.value, row.id);
  toast.add({ title: t('app.toRejected'), description: row.friend.username, color: 'orange' });
  selectedTab.value = 2;
}

async function cancelOwnRequest(row: FriendRow) {
  if (!token.value) return;
  const ok = await confirm({
    message: t('app.confirmCancelRequestMessage') || "They won't be notified — the request will simply disappear.",
    confirmLabel: t('app.cancelRequest') || 'Cancel request',
    color: 'red',
    icon: 'lucide:x-circle',
  });
  if (!ok) return;
  const { hubRemoveFriendship } = await import('@/api/hub/friendships/mutations');
  await hubRemoveFriendship(token.value, row.id);
  toast.add({ title: t('app.requestCancelled') || 'Request cancelled', description: row.friend.username, color: 'gray' });
  load(currentStatus.value);
}

async function removeFriend(row: FriendRow) {
  if (!token.value) return;
  const ok = await confirm({
    message: t('app.confirmRemoveFriendMessage') || "You'll no longer be connected. You can send a new request later.",
    confirmLabel: t('app.remove') || 'Remove',
    color: 'red',
    icon: 'lucide:user-minus',
  });
  if (!ok) return;
  const { hubRemoveFriendship } = await import('@/api/hub/friendships/mutations');
  await hubRemoveFriendship(token.value, row.id);
  toast.add({ title: t('app.remove'), description: row.friend.username, color: 'gray' });
  load(currentStatus.value);
}

const tabs = computed(() => ([
  { label: t('app.contacts'), icon: 'lucide:book-user' },
  { label: t('app.requests'), icon: 'lucide:user-plus' },
  { label: t('app.rejected'), icon: 'lucide:user-x' }
]));

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
const teamFilter = ref('');
const filteredMembers = computed(() => {
  const q = teamFilter.value.trim().toLowerCase();
  if (!q) return nsMembers.value;
  return nsMembers.value.filter(m => m.username?.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q));
});
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
    nsMembers.value = await hubMembersList(tok, nsId, 1, FilterPaginationLengthEnum.OneHundred);
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

let friendSearchDebounce: ReturnType<typeof setTimeout> | null = null;
watch(friendSearch, () => {
  if (friendSearchDebounce) clearTimeout(friendSearchDebounce);
  friendSearchDebounce = setTimeout(() => loadMoreFriends(true), 400);
});
// onMounted будет заменен на bootstrap загрузку ниже
async function addMemberFromFriend(friendUserId: string) {
  const tok = useCookie<string | null>(CookieKeys.TOKEN).value;
  const { idBySlug } = useNamespace();
  const nsId = idBySlug(selectedNS.value);
  if (!tok || !nsId) return;
  try {
    const { hubAddMember } = await import('@/api/hub/members/mutations');
    await hubAddMember(tok, nsId, friendUserId);
    toast.add({ title: t('app.added'), color: 'emerald' });
    await loadMembers();
  } catch (e: any) {
    const msg = getErrorMessage(e) || (t('common.genericError') || 'Something went wrong. Please try again.');
    toast.add({ title: t('app.notification'), description: msg, color: 'red' });
  }
}

async function removeMember(member: { userId: string; username: string; email: string }) {
  const tok = useCookie<string | null>(CookieKeys.TOKEN).value;
  const { idBySlug } = useNamespace();
  const nsId = idBySlug(selectedNS.value);
  if (!tok || !nsId) return;
  const ok = await confirm({
    message: t('app.confirmRemoveMemberMessage') || "They'll lose access to this workspace immediately.",
    confirmLabel: t('app.remove') || 'Remove',
    color: 'red',
    icon: 'lucide:user-minus',
  });
  if (!ok) return;
  try {
    const { hubRemoveMember } = await import('@/api/hub/members/mutations');
    await hubRemoveMember(tok, nsId, member.userId);
    toast.add({ title: t('app.memberRemoved') || 'Removed from team', description: member.username, color: 'gray' });
    await loadMembers();
  } catch (e: any) {
    const msg = getErrorMessage(e) || (t('common.genericError') || 'Something went wrong. Please try again.');
    toast.add({ title: t('app.notification'), description: msg, color: 'red' });
  }
}
</script>

<template>
  <div class="p-4 md:p-6 lg:p-8 min-h-screen max-w-7xl mx-auto">
    <!-- Header -->
    <div class="mb-6">
      <h1 class="text-2xl md:text-3xl font-bold bg-gradient-to-r from-blue-600 to-emerald-600 text-transparent bg-clip-text">
        {{ t('app.myPeopleHeading') }}
      </h1>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {{ t('app.myPeopleSubtitle') }}
      </p>
    </div>

    <!-- Unified add-person bar -->
    <UCard class="mb-6 shadow-sm border border-blue-100/70 dark:border-blue-900/30">
      <div class="flex flex-col sm:flex-row gap-3 sm:items-center">
        <UInput
          v-model="search"
          class="flex-1"
          :placeholder="t('app.searchEmailPlaceholder')"
          icon="lucide:search"
          size="lg"
          :loading="searching"
        />
        <Transition
          enter-active-class="transition ease-out duration-150"
          enter-from-class="opacity-0 translate-x-1"
          enter-to-class="opacity-100 translate-x-0"
        >
          <UButton
            v-if="buttonText"
            size="lg"
            :color="userFound ? 'primary' : 'gray'"
            :variant="userFound ? 'solid' : 'soft'"
            :icon="userFound ? 'lucide:user-plus' : 'lucide:mail-plus'"
            class="flex-shrink-0"
            @click="sendAction"
          >
            {{ buttonText }}
          </UButton>
        </Transition>
      </div>
      <p v-if="!isValidEmail && search" class="mt-2 text-sm text-red-500">
        {{ t('app.invalidEmail') }}
      </p>
      <p v-else-if="userFound !== null" class="mt-2 text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
        <UIcon :name="userFound ? 'lucide:check-circle' : 'lucide:mail-question'" class="w-4 h-4 flex-shrink-0" :class="userFound ? 'text-emerald-500' : 'text-amber-500'" />
        {{ userFound ? t('app.userFound') : t('app.userNotFound') }}
      </p>
    </UCard>

    <!-- Two-column: Team (primary) + Friends -->
    <div class="grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] gap-6 items-start">
      <!-- Team card -->
      <UCard class="shadow-sm border border-blue-100/70 dark:border-blue-900/30">
        <template #header>
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div class="flex items-center gap-2">
              <span class="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/30">
                <UIcon name="lucide:building-2" class="w-4.5 h-4.5 text-blue-600 dark:text-blue-400" />
              </span>
              <h2 class="text-lg font-semibold">{{ t('app.team') }}</h2>
            </div>
            <USelect
              v-model="selectedNS"
              :options="allNamespaces.map(slug => ({ label: titleBySlug(slug) || slug, value: slug }))"
              size="sm"
              class="w-full sm:w-auto sm:min-w-[220px]"
            />
          </div>
        </template>

        <div class="flex flex-col gap-3">
          <USelectMenu
            v-model="friendToAdd"
            searchable
            :options="friendOptions"
            :searchable-placeholder="t('app.search')"
            :search-value="friendSearch"
            :loading="friendLoading"
            :placeholder="t('app.selectFriend')"
            size="md"
            @update:search-value="(val: string) => friendSearch = val as any"
            @scroll-bottom="() => loadMoreFriends(false)"
            @change="(val: any) => { const id = typeof val === 'string' ? val : (val && (val as any).value); if (id) { addMemberFromFriend(id); friendToAdd = ''; } }"
          >
            <template #leading>
              <UIcon name="lucide:user-plus" class="w-5 h-5 text-blue-500" />
            </template>
          </USelectMenu>

          <UInput
            v-if="nsMembers.length > 6"
            v-model="teamFilter"
            size="sm"
            icon="lucide:filter"
            :placeholder="t('app.filterPlaceholder')"
          />

          <div v-if="membersLoading" class="flex flex-col gap-2 py-1">
            <div v-for="i in 3" :key="i" class="flex items-center gap-3 animate-pulse">
              <div class="h-9 w-9 rounded-full bg-gray-200 dark:bg-gray-700" />
              <div class="flex-1 flex flex-col gap-1.5">
                <div class="h-3 w-1/3 rounded bg-gray-200 dark:bg-gray-700" />
                <div class="h-2.5 w-1/2 rounded bg-gray-200 dark:bg-gray-800" />
              </div>
            </div>
          </div>

          <div v-else-if="!filteredMembers.length" class="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <span class="flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
              <UIcon name="lucide:users" class="w-5 h-5 text-gray-400" />
            </span>
            <p class="text-sm font-medium text-gray-700 dark:text-gray-200">{{ t('app.noTeamYet') }}</p>
            <p class="text-xs text-gray-500 dark:text-gray-400 max-w-[220px]">{{ t('app.noTeamYetHint') }}</p>
          </div>

          <div v-else class="flex flex-col max-h-[420px] overflow-y-auto -mx-1">
            <div
              v-for="m in filteredMembers"
              :key="m.id"
              class="group flex items-center gap-3 px-1 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
            >
              <span
                class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold uppercase"
                :class="[getAvatarPalette(m.email).bg, getAvatarPalette(m.email).text]"
              >
                {{ getInitials(m.username) }}
              </span>
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-1.5">
                  <span class="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">{{ m.username }}</span>
                  <UBadge v-if="m.userId === user?.id" size="xs" color="blue" variant="subtle">{{ t('app.you') }}</UBadge>
                </div>
                <p class="text-xs text-gray-500 dark:text-gray-400 truncate">{{ m.email }}</p>
              </div>
              <UButton
                v-if="m.userId !== user?.id"
                color="gray"
                variant="ghost"
                size="xs"
                icon="lucide:trash-2"
                class="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                @click="removeMember(m)"
              />
            </div>
          </div>
        </div>
      </UCard>

      <!-- Friends card -->
      <UCard class="shadow-sm border border-blue-100/70 dark:border-blue-900/30">
        <template #header>
          <div class="flex items-center gap-2">
            <span class="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-900/30">
              <UIcon name="lucide:heart-handshake" class="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400" />
            </span>
            <h2 class="text-lg font-semibold">{{ t('app.contacts') }}</h2>
          </div>
        </template>

        <div class="flex flex-col gap-3">
          <UTabs v-model="selectedTab" :items="tabs" />

          <UInput
            v-if="friends.length > 6"
            v-model="friendsFilter"
            size="sm"
            icon="lucide:filter"
            :placeholder="t('app.filterPlaceholder')"
          />

          <div v-if="loading" class="flex flex-col gap-2 py-1">
            <div v-for="i in 3" :key="i" class="flex items-center gap-3 animate-pulse">
              <div class="h-9 w-9 rounded-full bg-gray-200 dark:bg-gray-700" />
              <div class="flex-1 flex flex-col gap-1.5">
                <div class="h-3 w-1/3 rounded bg-gray-200 dark:bg-gray-700" />
                <div class="h-2.5 w-1/2 rounded bg-gray-200 dark:bg-gray-800" />
              </div>
            </div>
          </div>

          <div v-else-if="!filteredFriends.length" class="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <span class="flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
              <UIcon :name="tabs[selectedTab]?.icon || 'lucide:users'" class="w-5 h-5 text-gray-400" />
            </span>
            <p class="text-sm font-medium text-gray-700 dark:text-gray-200">
              {{ selectedTab === 0 ? t('app.noContactsYet') : selectedTab === 1 ? t('app.noRequestsYet') : t('app.noRejectedYet') }}
            </p>
            <p v-if="selectedTab === 0" class="text-xs text-gray-500 dark:text-gray-400 max-w-[220px]">{{ t('app.noContactsYetHint') }}</p>
          </div>

          <div v-else class="flex flex-col max-h-[420px] overflow-y-auto -mx-1">
            <div
              v-for="row in filteredFriends"
              :key="row.id"
              class="group flex items-center gap-3 px-1 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
            >
              <span
                class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold uppercase"
                :class="[getAvatarPalette(row.friend.email).bg, getAvatarPalette(row.friend.email).text]"
              >
                {{ getInitials(row.friend.username) }}
              </span>
              <div class="min-w-0 flex-1">
                <span class="font-medium text-sm text-gray-900 dark:text-gray-100 truncate block">{{ row.friend.username }}</span>
                <p class="text-xs text-gray-500 dark:text-gray-400 truncate">
                  <template v-if="row.status === 'PENDING' && row.initiatedByMe">{{ t('app.waitingForAccept') }}</template>
                  <template v-else>{{ row.friend.email }}</template>
                </p>
              </div>

              <!-- Incoming pending: accept / reject -->
              <div v-if="row.status === 'PENDING' && !row.initiatedByMe" class="flex items-center gap-1 flex-shrink-0">
                <UButton color="emerald" variant="soft" size="xs" icon="lucide:check" @click="acceptRequest(row)">
                  {{ t('app.accept') }}
                </UButton>
                <UButton color="gray" variant="ghost" size="xs" icon="lucide:x" @click="rejectRequest(row)" />
              </div>

              <!-- Outgoing pending: cancel -->
              <UButton
                v-else-if="row.status === 'PENDING' && row.initiatedByMe"
                color="gray"
                variant="ghost"
                size="xs"
                icon="lucide:x-circle"
                class="flex-shrink-0"
                @click="cancelOwnRequest(row)"
              >
                {{ t('app.cancelRequest') }}
              </UButton>

              <!-- Accepted / rejected: remove -->
              <UButton
                v-else
                color="gray"
                variant="ghost"
                size="xs"
                icon="lucide:trash-2"
                class="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                @click="removeFriend(row)"
              />
            </div>
          </div>
        </div>
      </UCard>
    </div>
  </div>
</template>
