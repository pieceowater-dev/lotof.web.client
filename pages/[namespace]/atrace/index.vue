<script lang="ts" setup>
import CreatePostModal from '@/components/atrace/CreatePostModal.vue';
import CoverageApprovalBanner from '@/components/atrace/CoverageApprovalBanner.vue';
import LeaveApprovalBanner from '@/components/atrace/LeaveApprovalBanner.vue';
import EditPostModal from '@/components/atrace/EditPostModal.vue';
import FilterModal from '@/components/atrace/FilterModal.vue';
import AtraceTabsBar from '@/components/atrace/AtraceTabsBar.vue';
import RouteStatsCard from '@/components/atrace/RouteStatsCard.vue';
import RouteEmployeeProgress from '@/components/atrace/RouteEmployeeProgress.vue';
import PostsCardScroller from '@/components/atrace/PostsCardScroller.vue';
import PostsMobileSelector from '@/components/atrace/PostsMobileSelector.vue';
import AttendancePanel from '@/components/atrace/AttendancePanel.vue';
import QuickAddRouteModal from '@/components/atrace/QuickAddRouteModal.vue';
import PostLimitModal from '@/components/atrace/PostLimitModal.vue';
import { useI18n } from '@/composables/useI18n';
import { CookieKeys } from '@/utils/storageKeys';
import { useAtraceToken } from '@/composables/useAtraceToken';
import { useAuth } from '@/composables/useAuth';
import { useOnboarding } from '@/composables/useOnboarding';
import { atraceTour } from '@/config/tours';
import { useNamespace } from '@/composables/useNamespace';
import { useAtracePosts } from '@/composables/useAtracePosts';
import { useAtraceTabRouting } from '@/composables/useAtraceTabRouting';
import { useAtraceRoutes } from '@/composables/useAtraceRoutes';
import { useStaleRefresh } from '@/composables/useStaleRefresh';
import { useAtracePermissions } from '@/composables/useAtracePermissions';
import { useAtracePendingCoverageCount } from '@/composables/useAtracePendingCoverage';
import { useAtraceCoverageApprovalBanners } from '@/composables/useAtraceCoverageApprovalBanners';
import { useAtracePendingLeaveCount } from '@/composables/useAtracePendingLeave';
import { useAtracePendingOnboardingCount } from '@/composables/useAtracePendingOnboardingCount';
import { useAtraceLeaveApprovalBanners } from '@/composables/useAtraceLeaveApprovalBanners';

const { t } = useI18n();
const { titleBySlug } = useNamespace();

definePageMeta({
    name: 'atrace',
    path: '/:namespace/atrace/:type?/:id?',
    middleware: (to) => {
        const type = to.params.type as string | undefined;
        const id = to.params.id as string | undefined;

        // If no type or type+id, redirect to attendance/all
        if (!type || (type === 'attendance' && !id)) {
            return navigateTo(`/${to.params.namespace}/atrace/attendance/all`, { replace: true });
        }
    }
});

const router = useRouter();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);
const { user, fetchUser } = useAuth();
const { ensure: ensureAtraceToken } = useAtraceToken();

// Tab/URL routing (activeTab <-> /:type/:id sync)
const {
    activeTab, selectedPostId, isRouteAll, lastAttendancePostId,
    activeRouteId, isRouteTab,
    applyRouteParamsFromUrl,
} = useAtraceTabRouting(nsSlug);

// Posts: list/pagination/infinite-scroll/CRUD
const {
    posts, loading, error, showSkeletons,
    selectedPostTitle, selectedPostLocationLine,
    loadingMore,
    isCreateOpen, isEditOpen, editingPost, isLimitModalOpen, limitErrorMessage,
    form, editForm,
    loadPosts, loadMorePosts, handleCreate, handleDelete, openEdit, handleEditSave,
} = useAtracePosts(nsSlug, selectedPostId, isRouteTab);

// Routes: CRUD + stats/bundle/progress for the active route tab
const {
    routes, routesLoading, routesError,
    loadRoutes, buildPostLabel,
    activeRoute, orderedRoutePostIds,
    routeProgressStart, routeProgressEnd, routePasses, routePassesLoading, routePassesError,
    routeProgressRows,
    formatRouteStatus,
    loadRouteData, resetRouteMembersCache,
    isRouteCreateOpen, routeCreateTitle, routeCreatePostIds, routeCreatePostId, routeCreateError, routeCreateSaving,
    resetRouteCreateForm, saveNewRoute,
} = useAtraceRoutes(nsSlug, activeRouteId);

const appTitle = computed(() => t('app.atraceTitle') || t('app.attendance') || 'A-Trace');
const nsTitle = computed(() => titleBySlug(nsSlug.value) || nsSlug.value || '');
const pageTitle = computed(() => {
    const base = nsTitle.value ? `${appTitle.value} — ${nsTitle.value}` : appTitle.value;
    if (!selectedPostId.value || selectedPostId.value === '') return base;
    if (!selectedPostTitle.value) return base;
    return nsTitle.value
        ? `${appTitle.value} — ${nsTitle.value} — ${selectedPostTitle.value}`
        : `${appTitle.value} — ${selectedPostTitle.value}`;
});

useHead(() => ({
    title: pageTitle.value,
}));

const isFilterOpen = ref(false);

// Gates action buttons a plain Teammate has no rights for (e.g. creating a
// new location) instead of showing them and erroring only after the click.
const { can: canDo, loadPermissions } = useAtracePermissions(nsSlug);
const canCreatePost = computed(() => canDo('tracker.post.create'));
const canEditPost = computed(() => canDo('tracker.post.edit'));
const canCreateRoute = computed(() => canDo('tracker.route.create'));
// The whole Settings page is member/role/schedule-pattern management --
// nothing in it a plain Teammate (no role.* permissions at all) can act on,
// so the entry point itself is hidden rather than just the actions inside it.
const canSeeSettings = computed(() => canDo('tracker.role.view'));

// Red badge on "Управление" -- a pending shift-coverage or leave request
// otherwise sits unnoticed until someone happens to open the relevant tab.
const { pendingCount: pendingCoverageCount, loadPendingCoverageCount } = useAtracePendingCoverageCount(nsSlug);
const { pendingCount: pendingLeaveCount, loadPendingLeaveCount } = useAtracePendingLeaveCount(nsSlug);
const { pendingCount: pendingOnboardingCount, loadPendingOnboardingCount } = useAtracePendingOnboardingCount(nsSlug);
const pendingApprovalCount = computed(() => pendingCoverageCount.value + pendingLeaveCount.value + pendingOnboardingCount.value);

// Full-width "your shift is covered" / "your leave is approved" banners for
// the employee who requested it, once a manager approves -- persists across
// visits until dismissed.
const { banners: coverageApprovalBanners, load: loadCoverageApprovalBanners, dismiss: dismissCoverageApprovalBanner } = useAtraceCoverageApprovalBanners(nsSlug);
const { banners: leaveApprovalBanners, load: loadLeaveApprovalBanners, dismiss: dismissLeaveApprovalBanner } = useAtraceLeaveApprovalBanners(nsSlug);

async function openCreateRouteModal() {
    resetRouteCreateForm();
    isRouteCreateOpen.value = true;
    if (posts.value.length === 0) {
        await loadPosts();
    }
}

const staleRefresh = useStaleRefresh({
    storageKey: 'atrace-last-active',
    maxIdleMs: 12 * 60 * 60 * 1000,
    onStale: () => loadPosts(1),
});

// Posts are always needed (route timelines display post names too); routes
// are skipped when the route bundle fetch will load them anyway.
async function loadInitialData() {
    await loadPosts();
    if (!isRouteTab.value || !activeRouteId.value) {
        await loadRoutes();
    }
}

onMounted(async () => {
    const hubToken = useCookie<string | null>(CookieKeys.TOKEN, { path: '/' }).value;
    const tok = await ensureAtraceToken(nsSlug.value, hubToken);
    if (!tok) {
        setTimeout(() => router.push('/'), 0);
        return;
    }
    await fetchUser();

    applyRouteParamsFromUrl();
    await loadInitialData();
    loadPermissions();
    loadPendingCoverageCount();
    loadPendingLeaveCount();
    loadPendingOnboardingCount();
    if (user.value?.id) {
        loadCoverageApprovalBanners(user.value.id);
        loadLeaveApprovalBanners(user.value.id);
    }

    if (process.client) {
        staleRefresh.start();

        // First entry with nothing set up yet (attendance mode only): open
        // the create-location modal directly instead of just pointing at it
        // via the tour's 'welcome'/'create-post' steps -- Atrace has nothing
        // useful to show until at least one location exists, so this should
        // happen as part of first entry, not wait on the user noticing the
        // empty state and clicking themselves (mirrors menu's
        // onboarding-wizard-on-first-visit pattern). Only for whoever can
        // actually create one; a staff member with no create rights still
        // gets the plain empty state + the full, untouched tour below.
        // loadPermissions() is awaited again here (it caches its in-flight
        // promise, so this doesn't refetch) specifically because the
        // fire-and-forget call above can't be relied on to have populated
        // canCreatePost by this point.
        if (!isRouteTab.value) {
            (async () => {
                await loadPermissions();
                if (posts.value.length === 0) {
                    const { isCompleted } = useOnboarding();
                    if (!isCompleted(atraceTour.id)) {
                        if (canCreatePost.value) {
                            pendingTourResumeAfterCreate.value = true;
                            setTimeout(() => {
                                isCreateOpen.value = true;
                            }, 500);
                        } else {
                            const { startTour } = useOnboarding();
                            // Wait a bit for DOM to settle
                            setTimeout(() => {
                                startTour(atraceTour);
                            }, 1000);
                        }
                    }
                }
            })();
        }
    }
});

// Once the auto-opened create modal above actually produces the first
// post, resume the tour from 'posts-list' (index 2) -- skipping 'welcome'
// and 'create-post' (index 0-1), whose target buttons the modal already
// covered/replaced -- so the rest of the walkthrough (posts list,
// attendance table, salary calculator, settings, help) still happens
// instead of being silently dropped.
const pendingTourResumeAfterCreate = ref(false);
watch(posts, (list) => {
    if (!pendingTourResumeAfterCreate.value || list.length === 0) return;
    pendingTourResumeAfterCreate.value = false;
    const { startTour } = useOnboarding();
    setTimeout(() => {
        startTour(atraceTour, 2);
    }, 800);
});

watch(activeRouteId, (next, prev) => {
    routePasses.value = [];
    routePassesError.value = null;
    if (next) {
        lastAttendancePostId.value = selectedPostId.value;
        // For routes: don't select individual posts, just set to null
        selectedPostId.value = null;
        isRouteAll.value = true;
        // Load route data (members + passes in parallel)
        loadRouteData();
    } else if (prev) {
        isRouteAll.value = false;
        // Load posts if switching back to attendance mode
        if (posts.value.length === 0) {
            loadPosts();
        }
        const candidate = lastAttendancePostId.value;
        if (candidate === '' || (candidate && posts.value.some((p) => p.id === candidate))) {
            selectedPostId.value = candidate as string;
        } else {
            selectedPostId.value = posts.value[0]?.id ?? null;
        }
    }
});

watch(() => nsSlug.value, async (n, o) => {
    if (n && n !== o) {
        applyRouteParamsFromUrl();
        resetRouteMembersCache();
        routePasses.value = [];
        await loadInitialData();
    }
});

onBeforeUnmount(() => {
    staleRefresh.stop();
});
</script>

<template>
  <FilterModal v-model="isFilterOpen" />

  <div class="flex flex-col">
    <CoverageApprovalBanner
      :banners="coverageApprovalBanners"
      @dismiss="dismissCoverageApprovalBanner"
    />
    <LeaveApprovalBanner
      :banners="leaveApprovalBanners"
      @dismiss="dismissLeaveApprovalBanner"
    />
    <div class="flex justify-between items-center mb-4 mt-4 px-4 flex-shrink-0">
      <div
        class="text-left"
        data-tour="atrace-title"
      >
        <h1 class="text-2xl font-semibold">
          {{ t('app.atraceTitle') }}
        </h1>
        <span class="text-sm text-gray-600 dark:text-gray-400">{{ t('app.atraceSubtitle') }}</span>
      </div>
      <div class="flex items-center gap-2">
        <UButton
          icon="lucide:user-round"
          size="xs"
          color="gray"
          variant="soft"
          :to="`/${nsSlug}/atrace/me`"
        >
          {{ t('app.myStats') || 'Моя статистика' }}
        </UButton>
        <div
          v-if="canSeeSettings"
          data-tour="settings-btn"
        >
          <UButton
            icon="lucide:settings"
            size="xs"
            color="primary"
            variant="soft"
            class="relative"
            :to="`/${nsSlug}/atrace/settings`"
          >
            {{ t('app.atraceManagement') || 'Управление' }}
            <span
              v-if="pendingApprovalCount > 0"
              class="absolute -right-1 -top-1 flex h-3 w-3"
            >
              <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span class="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
            </span>
          </UButton>
        </div>
      </div>
    </div>

    <AtraceTabsBar
      v-model:active-tab="activeTab"
      :routes="routes"
      :routes-loading="routesLoading"
      :routes-error="routesError"
      :can-create-route="canCreateRoute"
      @add-route="openCreateRouteModal"
    />

    <div
      v-if="isRouteTab"
      class="px-4 mt-2 flex-shrink-0"
    >
      <RouteStatsCard
        :route="activeRoute"
        :ordered-post-count="orderedRoutePostIds.length"
        :route-passes="routePasses"
        :route-passes-loading="routePassesLoading"
        :route-passes-error="routePassesError"
      />

      <RouteEmployeeProgress
        v-model:progress-start="routeProgressStart"
        v-model:progress-end="routeProgressEnd"
        :loading="routePassesLoading"
        :error="routePassesError"
        :rows="routeProgressRows"
        :format-status="formatRouteStatus"
      />
    </div>

    <!-- Desktop: horizontal card scroll (only show for attendance) -->
    <PostsCardScroller
      v-if="!isRouteTab"
      :posts="posts"
      :show-skeletons="showSkeletons"
      :loading-more="loadingMore"
      :selected-post-id="selectedPostId"
      :can-create="canCreatePost"
      :can-edit="canEditPost"
      @select="(id) => (selectedPostId = id)"
      @edit="openEdit"
      @create="isCreateOpen = true"
      @load-more="loadMorePosts"
    />

    <!-- Mobile: dropdown selector (only show for attendance) -->
    <PostsMobileSelector
      v-if="!isRouteTab"
      :posts="posts"
      :selected-post-id="selectedPostId"
      :show-skeletons="showSkeletons"
      :can-create="canCreatePost"
      @update:selected-post-id="(id) => (selectedPostId = id)"
      @create="isCreateOpen = true"
    />

    <AttendancePanel
      v-if="!isRouteTab"
      :selected-post-id="selectedPostId"
      :selected-post-title="selectedPostTitle"
      :selected-post-location-line="selectedPostLocationLine"
      :loading="loading"
      :error="error"
      :can-create="canCreatePost"
      @create="isCreateOpen = true"
    />
  </div>

  <!-- Create Route Modal -->
  <QuickAddRouteModal
    v-model="isRouteCreateOpen"
    v-model:route-title="routeCreateTitle"
    v-model:selected-post-id="routeCreatePostId"
    v-model:selected-post-ids="routeCreatePostIds"
    :posts="posts"
    :build-post-label="buildPostLabel"
    :error="routeCreateError"
    :saving="routeCreateSaving"
    @save="saveNewRoute"
  />

  <!-- Create Post Modal -->
  <CreatePostModal
    v-model="isCreateOpen"
    v-model:form="form"
    @submit="handleCreate"
  />

  <!-- Edit Post Modal -->
  <EditPostModal
    v-model="isEditOpen"
    v-model:form="editForm"
    :editing-post="editingPost"
    @save="handleEditSave"
    @delete="() => { if (editingPost) handleDelete(editingPost, { skipConfirm: false }) }"
  />

  <PostLimitModal
    v-model="isLimitModalOpen"
    :message="limitErrorMessage"
    :plans-path="`/${nsSlug}/atrace/plans?manage=1`"
  />
</template>
