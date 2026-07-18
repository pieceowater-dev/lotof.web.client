<script lang="ts" setup>
import CreatePostModal from '@/components/atrace/CreatePostModal.vue';
import EditPostModal from '@/components/atrace/EditPostModal.vue';
import FilterModal from '@/components/atrace/FilterModal.vue';
import TourGuide from '@/components/TourGuide.vue';
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
const { fetchUser } = useAuth();
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

    if (process.client) {
        staleRefresh.start();

        // Start onboarding tour if conditions are met (attendance mode only)
        if (!isRouteTab.value) {
            const { isCompleted, startTour } = useOnboarding();
            const shouldShowTour = posts.value.length === 0 && !isCompleted(atraceTour.id);
            if (shouldShowTour) {
                // Wait a bit for DOM to settle
                setTimeout(() => {
                    startTour(atraceTour);
                }, 1000);
            }
        }
    }
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
  <TourGuide />

  <FilterModal v-model="isFilterOpen" />

  <div class="flex flex-col">
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
      <div data-tour="settings-btn">
        <UButton
          icon="lucide:settings"
          size="xs"
          color="primary"
          variant="soft"
          :to="`/${nsSlug}/atrace/settings`"
        >
          {{ t('common.settings.title') }}
        </UButton>
      </div>
    </div>

    <AtraceTabsBar
      v-model:active-tab="activeTab"
      :routes="routes"
      :routes-loading="routesLoading"
      :routes-error="routesError"
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
    :plans-path="`/${nsSlug}/atrace/plans`"
  />
</template>
