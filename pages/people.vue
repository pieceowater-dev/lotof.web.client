<script setup lang="ts">
import { atModalUi, atCardUi } from '@/utils/atraceUi';
definePageMeta({ layout: 'full' });

import { ref, computed, onMounted, watch } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { logError } from '@/utils/logger';
import { FriendshipStatus, FilterPaginationLengthEnum } from '@gql-hub';
import { CookieKeys, LSKeys } from '@/utils/storageKeys';
import { getErrorMessage } from '@/utils/types/errors';
import { getInitials } from '@/utils/avatar';
import { memberDisplayName } from '@/utils/memberDisplayName';
import { useOnboarding } from '@/composables/useOnboarding';
import { peopleTour } from '@/config/tours';
import UserAvatar from '@/components/ui/UserAvatar.vue';
import EmptyState from '@/components/ui/EmptyState.vue';

const { homePath } = usePreferredSpace();
const { token, user } = useAuth();
const { isCompleted, startTour, reset } = useOnboarding();
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
useHead({ title: t('app.myPeopleHeading') || 'Мои люди' });
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
      useAnalytics().track('hub_member_invited');
      toast.add({ title: t('app.sendInvite'), description: email, color: 'blue' });
      search.value = '';
      userFound.value = null;
      foundUser.value = null;
    } catch (e: any) {
      const msg = getErrorMessage(e, t) || (t('common.genericError') || 'Something went wrong. Please try again.');
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
    const msg = getErrorMessage(e, t) || (t('common.genericError') || 'Something went wrong. Please try again.');
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

  // The watch on selectedNS only fires on a genuine value change -- if it
  // was already restored from localStorage before this bootstrap ran, that
  // watch never fires, so the owner check has to be kicked off here too.
  if (selectedNS.value) loadSelectedNsOwner();

  if (process.client && !isCompleted(peopleTour.id) && !friends.value.length && !nsMembers.value.length) {
    setTimeout(() => startTour(peopleTour), 1000);
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
const namespaceOptions = computed(() => allNamespaces.value.map(slug => ({ label: titleBySlug(slug) || slug, value: slug })));
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
const nsMembers = ref<Array<{ id: string; userId: string; username: string; email: string; nickname?: string | null }>>([]);
const membersLoading = ref(false);
// Nicknames can only be set by the namespace owner -- setMemberNickname
// already enforces this server-side (see hub.msvc.namespaces
// SetMemberNickname/IsNamespaceOwner), but the edit button should be hidden
// from everyone else too rather than being a dead end that fails on submit.
const selectedNsOwnerId = ref<string | null>(null);
const canEditNicknames = computed(() => !!selectedNsOwnerId.value && selectedNsOwnerId.value === user.value?.id);

async function loadSelectedNsOwner() {
  selectedNsOwnerId.value = null;
  const tok = useCookie<string | null>(CookieKeys.TOKEN).value;
  if (!tok || !selectedNS.value) return;
  try {
    const { hubNamespaceBySlug } = await import('@/api/hub/namespaces/get');
    const ns = await hubNamespaceBySlug(tok, selectedNS.value);
    selectedNsOwnerId.value = ns?.owner || null;
  } catch (e) {
    logError('[people] loadSelectedNsOwner failed', e);
  }
}
const teamFilter = ref('');
const filteredMembers = computed(() => {
  const q = teamFilter.value.trim().toLowerCase();
  if (!q) return nsMembers.value;
  return nsMembers.value.filter(m => m.username?.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q) || m.nickname?.toLowerCase().includes(q));
});

// ---- Nickname editing ----
const nicknameModalOpen = ref(false);
const nicknameEditing = ref<{ userId: string; username: string } | null>(null);
const nicknameInput = ref('');
const nicknameSaving = ref(false);

function openNicknameEdit(member: { userId: string; username: string; nickname?: string | null }) {
  nicknameEditing.value = { userId: member.userId, username: member.username };
  nicknameInput.value = member.nickname || '';
  nicknameModalOpen.value = true;
}

async function submitNickname() {
  const tok = useCookie<string | null>(CookieKeys.TOKEN).value;
  const nsId = selectedNS.value ? useNamespace().idBySlug(selectedNS.value) : null;
  if (!tok || !nsId || !nicknameEditing.value) return;

  nicknameSaving.value = true;
  try {
    const { hubSetMemberNickname } = await import('@/api/hub/members/list');
    const updated = await hubSetMemberNickname(tok, nsId, nicknameEditing.value.userId, nicknameInput.value.trim());
    const idx = nsMembers.value.findIndex(m => m.userId === nicknameEditing.value!.userId);
    if (idx !== -1) nsMembers.value[idx] = { ...nsMembers.value[idx], nickname: updated.nickname };
    toast.add({ title: t('app.nicknameSaved') || 'Никнейм сохранён', color: 'emerald' });
    nicknameModalOpen.value = false;
  } catch (e) {
    toast.add({ title: getErrorMessage(e, t) || (t('common.genericError') || 'Что-то пошло не так'), color: 'red' });
  } finally {
    nicknameSaving.value = false;
  }
}
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

watch(() => selectedNS.value, () => { loadMembers(); loadSelectedNsOwner(); });
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
    loadSelectedNsOwner();
    loadReferrals();
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
// USelectMenu's v-model can come back as either the raw option value or the
// whole {label, value} option object depending on how it resolves the
// current search text -- normalize both shapes to a plain id.
const friendToAddId = computed(() => {
  const val = friendToAdd.value as any;
  if (!val) return '';
  return typeof val === 'string' ? val : (val.value || '');
});

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
async function confirmAddMemberFromFriend() {
  const id = friendToAddId.value;
  if (!id) return;
  await addMemberFromFriend(id);
  friendToAdd.value = '';
}

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
    const msg = getErrorMessage(e, t) || (t('common.genericError') || 'Something went wrong. Please try again.');
    toast.add({ title: t('app.notification'), description: msg, color: 'red' });
  }
}

// Referral program: the link is just the current namespace's slug -- no
// backend round-trip needed to "generate" it (see server/routes/r/[code].get.ts
// and useAuth.ts's login(), which carry it through signup).
const referralLink = computed(() => {
  if (!process.client || !selectedNS.value) return '';
  return `${window.location.origin}/r/${selectedNS.value}`;
});

async function copyReferralLink() {
  if (!referralLink.value) return;
  try {
    await navigator.clipboard.writeText(referralLink.value);
    toast.add({ title: t('app.referralLinkCopied'), color: 'primary' });
  } catch (e) {
    logError('[people/referral] copyReferralLink failed', e);
  }
}

type ReferralBonusState = 'pending' | 'banked' | 'applied';
interface ReferralRow { id: string; title: string; slug: string; createdAt?: string | null; bonusState: ReferralBonusState }
const referralRows = ref<ReferralRow[]>([]);
const referralsLoading = ref(false);

async function loadReferrals() {
  const tok = useCookie<string | null>(CookieKeys.TOKEN).value;
  const { idBySlug } = useNamespace();
  const nsId = idBySlug(selectedNS.value);
  if (!tok || !nsId || !selectedNS.value) { referralRows.value = []; return; }
  referralsLoading.value = true;
  try {
    const [{ hubMyReferrals }, { capitalMyReferralBonuses }] = await Promise.all([
      import('@/api/hub/referrals/list'),
      import('@/api/capital/referrals/bonuses'),
    ]);
    const [referred, bonuses] = await Promise.all([
      hubMyReferrals(tok, nsId),
      capitalMyReferralBonuses(tok, selectedNS.value).catch(() => []),
    ]);
    // A referred friend can only ever earn one grant (applied or banked --
    // see referral_grants' unique constraint on the backend), so this is at
    // most one entry per referredNamespaceId.
    const bonusByNamespaceId = new Map(bonuses.map(b => [b.referredNamespaceId, b]));
    referralRows.value = referred.map(r => {
      const bonus = bonusByNamespaceId.get(r.id);
      const bonusState: ReferralBonusState = !bonus ? 'pending' : bonus.status === 'applied' ? 'applied' : 'banked';
      return { ...r, bonusState };
    });
  } catch (e) {
    logError('[people/referral] loadReferrals error', e);
    referralRows.value = [];
  } finally {
    referralsLoading.value = false;
  }
}

watch(() => selectedNS.value, () => { loadReferrals(); });

function referralBadgeColor(state: ReferralBonusState) {
  if (state === 'applied') return 'emerald';
  if (state === 'banked') return 'amber';
  return 'gray';
}
function referralBadgeLabel(state: ReferralBonusState) {
  if (state === 'applied') return t('app.referralStatusPaid');
  if (state === 'banked') return t('app.referralStatusBanked');
  return t('app.referralStatusPending');
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
    useAnalytics().track('hub_member_removed', { removedUserId: member.userId });
    toast.add({ title: t('app.memberRemoved') || 'Removed from team', description: member.username, color: 'gray' });
    await loadMembers();
  } catch (e: any) {
    const msg = getErrorMessage(e, t) || (t('common.genericError') || 'Something went wrong. Please try again.');
    toast.add({ title: t('app.notification'), description: msg, color: 'red' });
  }
}
</script>

<template>
  <div class="mx-auto min-h-screen max-w-6xl px-4 pb-16 pt-6 sm:px-6 sm:pt-10 lg:px-8">
    <NuxtLink :to="homePath()" class="pp-back group">
      <UIcon name="lucide:arrow-left" class="h-4 w-4 transition-transform duration-500 group-hover:-translate-x-0.5" />
      {{ t('app.home') }}
    </NuxtLink>

    <!-- Header -->
    <header class="mb-6 mt-5 flex items-start justify-between gap-4">
      <div data-tour="people-title" class="min-w-0">
        <h1 class="text-2xl font-bold tracking-tight text-gray-900 dark:text-white md:text-3xl">{{ t('app.myPeopleHeading') }}</h1>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ t('app.myPeopleSubtitle') }}</p>
      </div>
      <button type="button" class="pp-ghost flex-shrink-0" @click="() => { reset(peopleTour.id); startTour(peopleTour); }">
        <UIcon name="lucide:play-circle" class="h-4 w-4" />
        <span class="hidden sm:inline">{{ t('app.tourStart') }}</span>
      </button>
    </header>

    <!-- Unified add-person bar -->
    <div v-reveal data-tour="people-add-bar" class="bezel mb-5">
      <div class="bezel-core p-4 sm:p-5">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label class="pp-field flex-1">
            <UIcon :name="searching ? 'lucide:loader-circle' : 'lucide:search'" class="h-5 w-5 flex-shrink-0 text-gray-400" :class="searching ? 'animate-spin' : ''" />
            <input v-model="search" type="email" class="pp-input" :placeholder="t('app.searchEmailPlaceholder')" autocomplete="off" />
          </label>
          <Transition name="pp-pop">
            <button v-if="buttonText" type="button" class="cta-pill cta-pill--primary flex-shrink-0 justify-center text-sm" style="padding: 0.65rem 1.25rem" @click="sendAction">
              <UIcon :name="userFound ? 'lucide:user-plus' : 'lucide:mail-plus'" class="h-4 w-4" />
              {{ buttonText }}
            </button>
          </Transition>
        </div>
        <p v-if="!isValidEmail && search" class="mt-3 px-1 text-sm text-red-500">{{ t('app.invalidEmail') }}</p>
        <p v-else-if="userFound !== null" class="mt-3 flex items-center gap-1.5 px-1 text-sm text-gray-500 dark:text-gray-400">
          <UIcon :name="userFound ? 'lucide:check-circle' : 'lucide:mail-question'" class="h-4 w-4 flex-shrink-0" :class="userFound ? 'text-emerald-500' : 'text-amber-500'" />
          {{ userFound ? t('app.userFound') : t('app.userNotFound') }}
        </p>
      </div>
    </div>

    <!-- Team (primary) + Contacts -->
    <div class="grid grid-cols-1 items-start gap-5 lg:grid-cols-[1.15fr_1fr]">
      <!-- Team -->
      <section v-reveal="60" data-tour="people-team" class="bezel">
        <div class="bezel-core p-5 sm:p-6">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div class="flex items-center gap-3">
              <span class="icon-tile !h-10 !w-10 !rounded-xl"><UIcon name="lucide:building-2" class="h-5 w-5" /></span>
              <h2 class="text-lg font-bold tracking-tight text-gray-900 dark:text-white">{{ t('app.team') }}</h2>
              <span v-if="nsMembers.length" class="pp-count">{{ nsMembers.length }}</span>
            </div>
            <USelectMenu
              v-model="selectedNS"
              value-attribute="value"
              option-attribute="label"
              :options="namespaceOptions"
              size="sm"
              class="w-full sm:w-auto sm:min-w-[220px]"
            />
          </div>

          <div class="mt-5 flex flex-col gap-4">
            <div class="flex items-center gap-2">
              <USelectMenu
                v-model="friendToAdd"
                searchable
                :options="friendOptions"
                :searchable-placeholder="t('app.search')"
                :search-value="friendSearch"
                :loading="friendLoading"
                :placeholder="t('app.selectFriend')"
                size="md"
                class="min-w-0 flex-1"
                @update:search-value="(val: string) => friendSearch = val as any"
                @scroll-bottom="() => loadMoreFriends(false)"
              >
                <template #leading>
                  <UIcon name="lucide:user-plus" class="h-5 w-5 text-blue-500" />
                </template>
              </USelectMenu>
              <button type="button" class="cta-pill cta-pill--primary flex-shrink-0 text-sm disabled:cursor-not-allowed disabled:opacity-40" style="padding: 0.6rem 1.2rem" :disabled="!friendToAddId" @click="confirmAddMemberFromFriend">
                {{ t('common.add') }}
              </button>
            </div>

            <label v-if="nsMembers.length > 6" class="pp-field">
              <UIcon name="lucide:filter" class="h-4 w-4 flex-shrink-0 text-gray-400" />
              <input v-model="teamFilter" type="text" class="pp-input !text-sm" :placeholder="t('app.filterPlaceholder')" />
            </label>

            <div v-if="membersLoading" class="flex flex-col gap-3 py-1">
              <div v-for="i in 3" :key="i" class="flex animate-pulse items-center gap-3">
                <div class="h-10 w-10 rounded-full bg-gray-200 dark:bg-white/10" />
                <div class="flex flex-1 flex-col gap-1.5">
                  <div class="h-3 w-1/3 rounded bg-gray-200 dark:bg-white/10" />
                  <div class="h-2.5 w-1/2 rounded bg-gray-100 dark:bg-white/5" />
                </div>
              </div>
            </div>

            <EmptyState v-else-if="!filteredMembers.length" icon="lucide:users" :title="t('app.noTeamYet')" :description="t('app.noTeamYetHint')" />

            <ul v-else class="-mx-2 flex max-h-[460px] flex-col gap-0.5 overflow-y-auto px-2">
              <li v-for="m in filteredMembers" :key="m.id" class="pp-row group !rounded-[1.2rem]">
                <UserAvatar :name="memberDisplayName(m)" :seed="m.email" />
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-1.5">
                    <span class="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{{ memberDisplayName(m) }}</span>
                    <UBadge v-if="m.userId === user?.id" size="xs" color="blue" variant="subtle">{{ t('app.you') }}</UBadge>
                  </div>
                  <!-- When a nickname is set, the account's own name is still
                       shown (small, muted) so a manager can tell who someone
                       really is -- a nickname replaces what the team sees, not
                       what the owner can verify. -->
                  <p v-if="m.nickname?.trim() && m.nickname.trim() !== m.username" class="truncate text-xs text-gray-400 dark:text-gray-500">{{ m.username }}</p>
                  <p class="truncate text-xs text-gray-500 dark:text-gray-400">{{ m.email }}</p>
                </div>
                <button v-if="canEditNicknames" type="button" class="pp-icon-btn pp-reveal" :title="t('app.setNickname') || 'Задать никнейм'" @click="openNicknameEdit(m)">
                  <UIcon name="lucide:pencil" class="h-4 w-4" />
                </button>
                <button v-if="m.userId !== user?.id" type="button" class="pp-icon-btn pp-icon-btn--danger pp-reveal" :title="t('app.remove')" @click="removeMember(m)">
                  <UIcon name="lucide:trash-2" class="h-4 w-4" />
                </button>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <!-- Contacts -->
      <section v-reveal="120" data-tour="people-friends" class="bezel">
        <div class="bezel-core p-5 sm:p-6">
          <div class="flex items-center gap-3">
            <span class="icon-tile !h-10 !w-10 !rounded-xl" style="background-image: linear-gradient(135deg, #34d399, #0d9488); box-shadow: 0 8px 20px -8px rgba(13, 148, 136, 0.55)"><UIcon name="lucide:heart-handshake" class="h-5 w-5" /></span>
            <h2 class="text-lg font-bold tracking-tight text-gray-900 dark:text-white">{{ t('app.contacts') }}</h2>
          </div>

          <div class="mt-5 flex flex-col gap-4">
            <div class="pp-seg" role="tablist">
              <button
                v-for="(tab, i) in tabs"
                :key="i"
                type="button"
                role="tab"
                :aria-selected="selectedTab === i"
                class="pp-seg__btn"
                :class="selectedTab === i ? 'pp-seg__btn--active' : ''"
                @click="selectedTab = i"
              >
                <UIcon :name="tab.icon" class="hidden h-4 w-4 sm:block" />
                <span class="truncate">{{ tab.label }}</span>
              </button>
            </div>

            <label v-if="friends.length > 6" class="pp-field">
              <UIcon name="lucide:filter" class="h-4 w-4 flex-shrink-0 text-gray-400" />
              <input v-model="friendsFilter" type="text" class="pp-input !text-sm" :placeholder="t('app.filterPlaceholder')" />
            </label>

            <div v-if="loading" class="flex flex-col gap-3 py-1">
              <div v-for="i in 3" :key="i" class="flex animate-pulse items-center gap-3">
                <div class="h-10 w-10 rounded-full bg-gray-200 dark:bg-white/10" />
                <div class="flex flex-1 flex-col gap-1.5">
                  <div class="h-3 w-1/3 rounded bg-gray-200 dark:bg-white/10" />
                  <div class="h-2.5 w-1/2 rounded bg-gray-100 dark:bg-white/5" />
                </div>
              </div>
            </div>

            <EmptyState
              v-else-if="!filteredFriends.length"
              :icon="tabs[selectedTab]?.icon || 'lucide:users'"
              :title="selectedTab === 0 ? t('app.noContactsYet') : selectedTab === 1 ? t('app.noRequestsYet') : t('app.noRejectedYet')"
              :description="selectedTab === 0 ? t('app.noContactsYetHint') : undefined"
            />

            <ul v-else class="-mx-2 flex max-h-[460px] flex-col gap-0.5 overflow-y-auto px-2">
              <li v-for="row in filteredFriends" :key="row.id" class="pp-row group !rounded-[1.2rem]">
                <UserAvatar :name="row.friend.username" :seed="row.friend.email" />
                <div class="min-w-0 flex-1">
                  <span class="block truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{{ row.friend.username }}</span>
                  <p class="truncate text-xs text-gray-500 dark:text-gray-400">
                    <template v-if="row.status === 'PENDING' && row.initiatedByMe">{{ t('app.waitingForAccept') }}</template>
                    <template v-else>{{ row.friend.email }}</template>
                  </p>
                </div>

                <!-- Incoming pending: accept / reject -->
                <div v-if="row.status === 'PENDING' && !row.initiatedByMe" class="flex flex-shrink-0 items-center gap-1.5">
                  <button type="button" class="pp-accept" @click="acceptRequest(row)">
                    <UIcon name="lucide:check" class="h-4 w-4" />{{ t('app.accept') }}
                  </button>
                  <button type="button" class="pp-icon-btn" :title="t('app.toRejected')" @click="rejectRequest(row)">
                    <UIcon name="lucide:x" class="h-4 w-4" />
                  </button>
                </div>

                <!-- Outgoing pending: cancel -->
                <button v-else-if="row.status === 'PENDING' && row.initiatedByMe" type="button" class="pp-ghost !px-3 !py-1.5 text-xs" @click="cancelOwnRequest(row)">
                  <UIcon name="lucide:x-circle" class="h-3.5 w-3.5" />{{ t('app.cancelRequest') }}
                </button>

                <!-- Accepted / rejected: remove -->
                <button v-else type="button" class="pp-icon-btn pp-icon-btn--danger pp-reveal" :title="t('app.remove')" @click="removeFriend(row)">
                  <UIcon name="lucide:trash-2" class="h-4 w-4" />
                </button>
              </li>
            </ul>
          </div>
        </div>
      </section>
    </div>

    <!-- Referral program -->
    <section v-reveal data-tour="people-referral" class="bezel mt-5">
      <div class="bezel-core p-5 sm:p-6">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-center">
          <div class="flex min-w-0 flex-1 items-center gap-3">
            <span class="icon-tile !h-10 !w-10 !rounded-xl" style="background-image: linear-gradient(135deg, #fbbf24, #f97316); box-shadow: 0 8px 20px -8px rgba(249, 115, 22, 0.55)"><UIcon name="lucide:gift" class="h-5 w-5" /></span>
            <div class="min-w-0">
              <h2 class="text-lg font-bold tracking-tight text-gray-900 dark:text-white">{{ t('app.referralTitle') }}</h2>
              <p class="text-xs leading-5 text-gray-500 dark:text-gray-400">{{ t('app.referralSubtitle') }}</p>
            </div>
          </div>
          <div class="flex flex-col gap-2 sm:flex-row sm:items-center lg:w-[28rem]">
            <label class="pp-field min-w-0 flex-1">
              <UIcon name="lucide:link" class="h-4 w-4 flex-shrink-0 text-gray-400" />
              <input :value="referralLink" readonly class="pp-input !text-sm" @focus="($event.target as HTMLInputElement).select()" />
            </label>
            <button type="button" class="cta-pill cta-pill--primary flex-shrink-0 justify-center text-sm" style="padding: 0.6rem 1.1rem" @click="copyReferralLink">
              <UIcon name="lucide:copy" class="h-4 w-4" />{{ t('app.referralCopyLink') }}
            </button>
          </div>
        </div>

        <div v-if="referralsLoading" class="mt-5 flex flex-col gap-2">
          <div v-for="i in 2" :key="i" class="flex animate-pulse items-center gap-3">
            <div class="h-8 w-8 rounded-full bg-gray-200 dark:bg-white/10" />
            <div class="h-3 w-1/3 flex-1 rounded bg-gray-200 dark:bg-white/10" />
          </div>
        </div>
        <p v-else-if="!referralRows.length" class="mt-4 text-xs text-gray-500 dark:text-gray-400">{{ t('app.referralListEmpty') }}</p>
        <ul v-else class="mt-5 grid max-h-[240px] grid-cols-1 gap-1 overflow-y-auto md:grid-cols-2">
          <li v-for="row in referralRows" :key="row.id" class="pp-row !rounded-[1.2rem]">
            <span class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold uppercase text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">{{ getInitials(row.title) }}</span>
            <span class="min-w-0 flex-1 truncate text-sm font-medium text-gray-900 dark:text-gray-100">{{ row.title }}</span>
            <UBadge :color="referralBadgeColor(row.bonusState)" variant="subtle" size="xs">{{ referralBadgeLabel(row.bonusState) }}</UBadge>
          </li>
        </ul>
      </div>
    </section>

    <UModal class="at-modal" :ui="atModalUi" v-model="nicknameModalOpen">
      <UCard :ui="atCardUi">
        <template #header>
          <h3 class="text-base font-semibold">{{ t('app.setNickname') || 'Задать никнейм' }}</h3>
        </template>
        <div class="space-y-2">
          <p class="text-sm text-gray-500 dark:text-gray-400">{{ nicknameEditing?.username }}</p>
          <UInput
            v-model="nicknameInput"
            :placeholder="t('app.nicknamePlaceholder') || 'Например, Асель К.'"
            maxlength="64"
            @keyup.enter="submitNickname"
          />
          <p class="text-xs text-gray-400 dark:text-gray-500">
            {{ t('app.nicknameHint') || 'Виден только внутри этой компании. Оставьте пустым, чтобы вернуть исходное имя аккаунта.' }}
          </p>
        </div>
        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="gray" variant="ghost" :disabled="nicknameSaving" @click="nicknameModalOpen = false">{{ t('app.cancel') || 'Отмена' }}</UButton>
            <UButton color="primary" :loading="nicknameSaving" @click="submitNickname">{{ t('app.save') || 'Сохранить' }}</UButton>
          </div>
        </template>
      </UCard>
    </UModal>
  </div>
</template>

<style scoped>
.pp-back {
  display: inline-flex; align-items: center; gap: 0.45rem;
  border-radius: 9999px; padding: 0.45rem 1rem 0.45rem 0.8rem;
  font-size: 0.875rem; font-weight: 600; color: #334155;
  background: rgba(15, 23, 42, 0.04); box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.08);
  transition: transform 0.25s cubic-bezier(0.32, 0.72, 0, 1), background 0.2s;
}
.pp-back:hover { background: rgba(15, 23, 42, 0.08); }
.pp-back:active { transform: scale(0.96); }
.dark .pp-back { color: #e5e5e5; background: rgba(255, 255, 255, 0.07); box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.1); }
.dark .pp-back:hover { background: rgba(255, 255, 255, 0.12); }

.pp-ghost {
  display: inline-flex; align-items: center; gap: 0.5rem;
  border-radius: 9999px; padding: 0.5rem 1rem;
  font-size: 0.875rem; font-weight: 600; color: #334155;
  background: rgba(15, 23, 42, 0.04); box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.08);
  transition: transform 0.25s cubic-bezier(0.32, 0.72, 0, 1), background 0.2s;
}
.pp-ghost:hover { background: rgba(15, 23, 42, 0.08); }
.pp-ghost:active { transform: scale(0.96); }
.dark .pp-ghost { color: #e5e5e5; background: rgba(255, 255, 255, 0.07); box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.1); }
.dark .pp-ghost:hover { background: rgba(255, 255, 255, 0.12); }

.pp-field {
  display: flex; align-items: center; gap: 0.7rem;
  border-radius: 9999px; padding: 0.7rem 1.1rem;
  background: rgba(15, 23, 42, 0.04); box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.08);
  transition: box-shadow 0.2s cubic-bezier(0.32, 0.72, 0, 1), background 0.2s;
}
.pp-field:focus-within { background: #fff; box-shadow: inset 0 0 0 1.5px #2563eb, 0 0 0 4px rgba(37, 99, 235, 0.12); }
.dark .pp-field { background: rgba(255, 255, 255, 0.06); box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.12); }
.dark .pp-field:focus-within { background: rgba(255, 255, 255, 0.08); box-shadow: inset 0 0 0 1.5px #60a5fa, 0 0 0 4px rgba(96, 165, 250, 0.16); }
.pp-input { min-width: 0; flex: 1; background: transparent; font-size: 1rem; color: #0f172a; }
.pp-input, .pp-input:focus, .pp-input:focus-visible { outline: none !important; box-shadow: none !important; border: 0 !important; }
.pp-input::placeholder { color: #94a3b8; }
.dark .pp-input { color: #fff; }

.pp-label { display: flex; align-items: center; gap: 0.5rem; margin: 0 0.25rem 0.6rem; font-size: 0.75rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #64748b; }
.dark .pp-label { color: #a3a3a3; }
.pp-card { overflow: hidden; border-radius: 1.5rem; background: #fff; box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.08), 0 1px 2px rgba(15, 23, 42, 0.04); }
.dark .pp-card { background: #1f1f1f; box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08); }
.pp-line { display: flex; align-items: center; gap: 0.6rem; padding: 0.7rem 1rem; }
.pp-line + .pp-line, .pp-line + ul, .pp-line + div { border-top: 1px solid rgba(15, 23, 42, 0.07); }
.dark .pp-line + .pp-line, .dark .pp-line + ul, .dark .pp-line + div { border-top-color: rgba(255, 255, 255, 0.08); }
.pp-line__label { flex-shrink: 0; font-size: 0.875rem; font-weight: 500; color: #475569; }
.dark .pp-line__label { color: #d4d4d4; }
@media (max-width: 639px) { .pp-line:has(.pp-line__label) { flex-direction: column; align-items: stretch; gap: 0.4rem; } }
.pp-count { border-radius: 9999px; padding: 0.05rem 0.55rem; font-size: 0.7rem; font-weight: 600; letter-spacing: 0; color: #64748b; background: rgba(15, 23, 42, 0.05); }
.dark .pp-count { color: #a3a3a3; background: rgba(255, 255, 255, 0.08); }

.pp-row {
  display: flex; align-items: center; gap: 0.8rem;
  padding: 0.65rem 1rem;
  transition: background 0.2s cubic-bezier(0.32, 0.72, 0, 1);
}
.pp-row:hover { background: rgba(15, 23, 42, 0.04); }
.dark .pp-row:hover { background: rgba(255, 255, 255, 0.06); }

.pp-icon-btn {
  display: inline-flex; height: 2rem; width: 2rem; flex-shrink: 0; align-items: center; justify-content: center;
  border-radius: 9999px; color: #64748b;
  transition: background 0.15s, color 0.15s, opacity 0.15s, transform 0.2s cubic-bezier(0.32, 0.72, 0, 1);
}
.pp-icon-btn:hover { background: rgba(15, 23, 42, 0.08); color: #0f172a; }
.pp-icon-btn:active { transform: scale(0.92); }
.pp-icon-btn--danger:hover { background: rgba(239, 68, 68, 0.12); color: #dc2626; }
.dark .pp-icon-btn { color: #a3a3a3; }
.dark .pp-icon-btn:hover { background: rgba(255, 255, 255, 0.1); color: #fff; }
.dark .pp-icon-btn--danger:hover { background: rgba(239, 68, 68, 0.18); color: #f87171; }
/* hover-only on desktop, always visible on touch */
@media (hover: hover) and (min-width: 640px) {
  .pp-reveal { opacity: 0; }
  .pp-row:hover .pp-reveal, .pp-reveal:focus-visible { opacity: 1; }
}

.pp-accept {
  display: inline-flex; align-items: center; gap: 0.35rem; border-radius: 9999px; padding: 0.4rem 0.8rem;
  font-size: 0.75rem; font-weight: 600; color: #047857; background: rgba(16, 185, 129, 0.14);
  transition: transform 0.2s cubic-bezier(0.32, 0.72, 0, 1), background 0.15s;
}
.pp-accept:hover { background: rgba(16, 185, 129, 0.24); }
.pp-accept:active { transform: scale(0.95); }
.dark .pp-accept { color: #6ee7b7; background: rgba(16, 185, 129, 0.16); }

.pp-seg { display: flex; gap: 0.25rem; border-radius: 9999px; padding: 0.25rem; background: rgba(15, 23, 42, 0.05); }
.dark .pp-seg { background: rgba(255, 255, 255, 0.06); }
.pp-seg__btn {
  display: flex; min-width: 0; flex: 1; align-items: center; justify-content: center; gap: 0.4rem;
  border-radius: 9999px; padding: 0.45rem 0.6rem; font-size: 0.8125rem; font-weight: 600; color: #64748b;
  transition: background 0.2s cubic-bezier(0.32, 0.72, 0, 1), color 0.15s, box-shadow 0.2s;
}
.pp-seg__btn:hover { color: #0f172a; }
.pp-seg__btn--active { color: #0f172a; background: #fff; box-shadow: 0 6px 16px -8px rgba(15, 23, 42, 0.35); }
.dark .pp-seg__btn { color: #a3a3a3; }
.dark .pp-seg__btn:hover { color: #fff; }
.dark .pp-seg__btn--active { color: #fff; background: rgba(255, 255, 255, 0.12); box-shadow: none; }

.pp-pop-enter-active, .pp-pop-leave-active { transition: opacity 0.15s cubic-bezier(0.32, 0.72, 0, 1), transform 0.2s cubic-bezier(0.32, 0.72, 0, 1); }
.pp-pop-enter-from, .pp-pop-leave-to { opacity: 0; transform: translateX(6px) scale(0.96); }
</style>
