import type { ComputedRef } from 'vue';
import { CookieKeys } from '@/utils/storageKeys';
import { useAtraceToken } from '@/composables/useAtraceToken';
import { useAuth } from '@/composables/useAuth';
import { useI18n } from '@/composables/useI18n';
import { getErrorMessage } from '@/utils/types/errors';
import { isAtracePermissionError } from '@/utils/atracePermissions';
import type { Route, RouteMilestone } from '@/api/atrace/route/list';
import type { RoutePass, RouteMilestoneDetail } from '@/api/atrace/route/validatePass';
import type { Post, RouteProgressRow } from '@/types/atrace';

function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDateDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function sortRoutesByTitle(list: Route[]): Route[] {
  return [...list].sort((a, b) => (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' }));
}

// Route CRUD + stats/orchestration for A-Trace. This composable is shared
// between the attendance page (routes tab: stats, pass validation, employee
// progress) and the settings page (routes management table) — both need
// loadRoutes/createRoute/deleteRoute/buildPostLabel, which are the same
// logic in both places. `activeRouteId` is only needed by the attendance
// page's route-stats consumers and can be omitted by callers that only need
// basic CRUD (e.g. settings).
export function useAtraceRoutes(nsSlug: ComputedRef<string>, activeRouteId?: ComputedRef<string | null>) {
  const { t } = useI18n();
  const { ensure: ensureAtraceToken } = useAtraceToken();
  const { user } = useAuth();

  const routeIdRef = activeRouteId ?? computed(() => null);

  const routes = ref<Route[]>([]);
  const routesLoading = ref(false);
  const routesError = ref<string | null>(null);

  function getRouteAccessDeniedMessage(): string {
    return t('app.route.accessDenied') || 'Маршруты недоступны для вашей роли.';
  }

  function sortMilestones(milestones: RouteMilestone[]): RouteMilestone[] {
    return [...milestones].sort((a, b) => a.priority - b.priority);
  }

  function buildPostLabel(post: Post): string {
    const parts: string[] = [];
    if (post.title?.trim()) parts.push(post.title.trim());
    if (post.location?.city?.trim()) parts.push(post.location.city as string);
    if (post.location?.address?.trim()) parts.push(post.location.address as string);
    return parts.join(' — ');
  }

  async function loadRoutes() {
    routesLoading.value = true;
    routesError.value = null;
    try {
      const hubToken = useCookie<string | null>(CookieKeys.TOKEN, { path: '/' }).value;
      const atraceToken = await ensureAtraceToken(nsSlug.value, hubToken);
      if (!atraceToken) return;
      const { atraceGetRoutes } = await import('@/api/atrace/route/list');
      const res = await atraceGetRoutes(atraceToken, nsSlug.value, { page: 1, length: 'ONE_HUNDRED' });
      routes.value = sortRoutesByTitle(res.routes);
    } catch (e) {
      routesError.value = isAtracePermissionError(e, 'tracker.route.view')
        ? getRouteAccessDeniedMessage()
        : (getErrorMessage(e, t) || (t('app.route.loadFailed') || 'Failed to load routes'));
      routes.value = [];
    } finally {
      routesLoading.value = false;
    }
  }

  async function createRoute(title: string, postIds: string[]): Promise<Route> {
    const hubToken = useCookie<string | null>(CookieKeys.TOKEN, { path: '/' }).value;
    const atraceToken = await ensureAtraceToken(nsSlug.value, hubToken);
    if (!atraceToken) throw new Error('No A-Trace token');
    const { atraceCreateRoute } = await import('@/api/atrace/route/create');
    const milestones: RouteMilestone[] = postIds.map((postId, idx) => ({ postId, priority: idx + 1 }));
    return atraceCreateRoute(atraceToken, nsSlug.value, { title, milestones });
  }

  async function deleteRoute(routeId: string): Promise<void> {
    const hubToken = useCookie<string | null>(CookieKeys.TOKEN, { path: '/' }).value;
    const atraceToken = await ensureAtraceToken(nsSlug.value, hubToken);
    if (!atraceToken) return;
    const { atraceDeleteRoute } = await import('@/api/atrace/route/delete');
    await atraceDeleteRoute(atraceToken, nsSlug.value, routeId);
  }

  // ---- Route stats/bundle (attendance page's routes tab) ----

  const activeRoute = computed(() => routes.value.find((r) => r.id === routeIdRef.value) || null);
  const orderedRoutePostIds = computed(() => {
    if (!activeRoute.value) return [] as string[];
    return sortMilestones(activeRoute.value.milestones).map((m) => m.postId);
  });

  const routePass = ref<RoutePass | null>(null);
  const routePassLoading = ref(false);
  const routePassError = ref<string | null>(null);
  const routeValidationDate = ref(getTodayDateString());
  const routeProgressStart = ref(getDateDaysAgo(6));
  const routeProgressEnd = ref(getTodayDateString());
  const routePasses = ref<RoutePass[]>([]);
  const routePassesLoading = ref(false);
  const routePassesError = ref<string | null>(null);
  const routeMembers = ref<Array<{ userId: string; username: string; email: string }>>([]);
  const routeMembersLoading = ref(false);
  const cachedNamespaceId = ref<string | null>(null);

  function formatRouteStatus(status?: string | null): { label: string; color: string } {
    const normalized = String(status || '').toLowerCase();
    if (normalized === 'completed') return { label: t('app.route.status.ok') || 'OK', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-100' };
    if (normalized === 'partial') return { label: t('app.route.status.partial') || 'Partial', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-100' };
    if (normalized === 'violated') return { label: t('app.route.status.violation') || 'Violation', color: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-100' };
    return { label: t('app.route.status.pending') || 'Pending', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100' };
  }

  const routeMilestoneDetails = computed(() => {
    if (!routePass.value?.details) return [] as RouteMilestoneDetail[];
    return [...routePass.value.details].sort((a, b) => a.priority - b.priority);
  });

  function getMilestoneStatusLabel(detail: any): string {
    if (!detail.recordId) return t('app.route.status.pending') || 'Pending';
    if (detail.isCorrectOrder) return t('app.route.status.ok') || 'OK';
    return t('app.route.status.partial') || 'Out of order';
  }

  async function loadRouteMembers() {
    if (routeMembersLoading.value) return;
    routeMembersLoading.value = true;
    try {
      const hubToken = useCookie<string | null>(CookieKeys.TOKEN, { path: '/' }).value;
      if (!hubToken) {
        routeMembers.value = [];
        return;
      }

      // Use combined query that fetches namespace and members in optimized way
      const { hubGetNamespaceAndMembers } = await import('@/api/hub/route/data');
      const result = await hubGetNamespaceAndMembers(hubToken, nsSlug.value, 1, 'FIFTY');

      // Cache namespace ID for future use
      if (result.namespace?.id) {
        cachedNamespaceId.value = result.namespace.id;
      }

      // Update members list
      routeMembers.value = (result.members || []).map((m: any) => ({
        userId: m.userId,
        username: m.username || m.email || m.userId,
        email: m.email || ''
      }));
    } catch {
      routeMembers.value = [];
    } finally {
      routeMembersLoading.value = false;
    }
  }

  async function loadRouteAtraceBundle(includeValidation: boolean) {
    if (!routeIdRef.value) {
      routePasses.value = [];
      routePassesError.value = null;
      routePass.value = null;
      routePassError.value = null;
      return;
    }
    if (!user.value?.id) {
      routePassError.value = t('app.userNotLoaded') || 'User not loaded';
      routePass.value = null;
      return;
    }

    const shouldSetRoutesLoading = routes.value.length === 0;
    if (shouldSetRoutesLoading) {
      routesLoading.value = true;
      routesError.value = null;
    }
    routePassesLoading.value = true;
    routePassesError.value = null;
    if (includeValidation) {
      routePassLoading.value = true;
      routePassError.value = null;
    }

    try {
      const hubToken = useCookie<string | null>(CookieKeys.TOKEN, { path: '/' }).value;
      const atraceToken = await ensureAtraceToken(nsSlug.value, hubToken);
      if (!atraceToken) return;

      const { atraceGetRouteBundle } = await import('@/api/atrace/route/bundle');
      const result = await atraceGetRouteBundle(atraceToken, nsSlug.value, {
        routes: { page: 1, length: 'ONE_HUNDRED' },
        routeId: routeIdRef.value,
        startDate: routeProgressStart.value,
        endDate: routeProgressEnd.value,
        validateUserId: user.value.id,
        validateDate: routeValidationDate.value,
        includeValidation,
      });

      routes.value = sortRoutesByTitle(result.routes);
      routePasses.value = result.passes || [];
      if (includeValidation) {
        routePass.value = result.validation;
      }
    } catch (e) {
      const errorMsg = isAtracePermissionError(e, 'tracker.route.view')
        ? getRouteAccessDeniedMessage()
        : (getErrorMessage(e, t) || 'Failed to load route data');
      if (shouldSetRoutesLoading) {
        routesError.value = errorMsg;
        routes.value = [];
      }
      routePassesError.value = errorMsg;
      routePasses.value = [];
      if (includeValidation) {
        routePassError.value = errorMsg || (t('app.route.validateFailed') || 'Failed to validate route');
        routePass.value = null;
      }
    } finally {
      if (shouldSetRoutesLoading) {
        routesLoading.value = false;
      }
      routePassesLoading.value = false;
      if (includeValidation) {
        routePassLoading.value = false;
      }
    }
  }

  async function loadRoutePasses() {
    await loadRouteAtraceBundle(false);
  }

  // Clears the members list + namespace-id cache, e.g. when the namespace changes.
  function resetRouteMembersCache() {
    routeMembers.value = [];
    cachedNamespaceId.value = null;
  }

  // Load both members and passes in parallel
  async function loadRouteData() {
    await Promise.all([
      loadRouteMembers(),
      loadRouteAtraceBundle(true)
    ]);
  }

  async function validateRoutePass() {
    if (routePassLoading.value) return;
    if (!routeIdRef.value) {
      routePass.value = null;
      routePassError.value = null;
      return;
    }
    if (!user.value?.id) {
      routePassError.value = t('app.userNotLoaded') || 'User not loaded';
      routePass.value = null;
      return;
    }

    await loadRouteAtraceBundle(true);
  }

  async function loadRoutePass() {
    await validateRoutePass();
  }

  const routeProgressRows = computed<RouteProgressRow[]>(() => {
    if (!routeIdRef.value || routePasses.value.length === 0) return [];

    // Group passes by userId
    const grouped = new Map<string, RoutePass[]>();
    for (const pass of routePasses.value) {
      if (!grouped.has(pass.userId)) {
        grouped.set(pass.userId, []);
      }
      grouped.get(pass.userId)!.push(pass);
    }

    const membersById = new Map(routeMembers.value.map((m) => [m.userId, m]));

    // Build rows
    const rows: RouteProgressRow[] = [];
    for (const [userId, passes] of grouped.entries()) {
      const sortedPasses = [...passes].sort((a, b) => b.date.localeCompare(a.date));
      const lastPass = sortedPasses[0];
      const member = membersById.get(userId);

      let completedCount = 0;
      let partialCount = 0;
      let violatedCount = 0;
      let pendingCount = 0;

      for (const pass of passes) {
        const status = pass.status.toLowerCase();
        if (status === 'completed') completedCount++;
        else if (status === 'partial') partialCount++;
        else if (status === 'violated') violatedCount++;
        else pendingCount++;
      }

      rows.push({
        userId,
        username: member?.username || member?.email || userId.substring(0, 8),
        email: member?.email || '',
        lastDate: lastPass?.date || null,
        lastStatus: lastPass?.status || null,
        completedCount,
        partialCount,
        violatedCount,
        pendingCount
      });
    }

    return rows.sort((a, b) => (b.lastDate || '').localeCompare(a.lastDate || ''));
  });

  watch([routeValidationDate, user], () => {
    if (!routeIdRef.value) return;
    loadRoutePass();
  });

  // Watch only date changes to reload passes (members are loaded once when route opens)
  watch([routeProgressStart, routeProgressEnd], () => {
    if (!routeIdRef.value) return;
    loadRoutePasses();
  });

  // ---- Quick "create route" form (attendance page's + Add route button) ----

  const isRouteCreateOpen = ref(false);
  const routeCreateTitle = ref('');
  const routeCreatePostIds = ref<string[]>([]);
  const routeCreatePostId = ref('');
  const routeCreateError = ref<string | null>(null);
  const routeCreateSaving = ref(false);

  function resetRouteCreateForm() {
    routeCreateTitle.value = '';
    routeCreatePostIds.value = [];
    routeCreatePostId.value = '';
    routeCreateError.value = null;
  }

  async function saveNewRoute() {
    routeCreateError.value = null;
    const title = routeCreateTitle.value.trim();
    if (!title) {
      routeCreateError.value = t('app_route_title_required') || 'Введите название маршрута';
      return;
    }
    if (routeCreatePostIds.value.length === 0) {
      routeCreateError.value = t('app_route_posts_required') || 'Добавьте хотя бы один пост';
      return;
    }

    routeCreateSaving.value = true;
    try {
      const created = await createRoute(title, routeCreatePostIds.value);
      routes.value = sortRoutesByTitle([...routes.value, created]);
      isRouteCreateOpen.value = false;
      resetRouteCreateForm();
    } catch (e) {
      routeCreateError.value = getErrorMessage(e, t) || (t('app_route_save_failed') || 'Failed to save route');
    } finally {
      routeCreateSaving.value = false;
    }
  }

  return {
    // base CRUD (shared between attendance + settings pages)
    routes, routesLoading, routesError,
    loadRoutes, createRoute, deleteRoute, buildPostLabel, sortMilestones, sortRoutesByTitle,
    getRouteAccessDeniedMessage,

    // route stats/bundle (attendance page's routes tab)
    activeRoute, orderedRoutePostIds,
    routePass, routePassLoading, routePassError, routeValidationDate, routeMilestoneDetails,
    routeProgressStart, routeProgressEnd, routePasses, routePassesLoading, routePassesError,
    routeMembers, routeMembersLoading,
    routeProgressRows,
    formatRouteStatus, getMilestoneStatusLabel,
    loadRouteMembers, loadRouteAtraceBundle, loadRoutePasses, loadRouteData, resetRouteMembersCache,
    validateRoutePass, loadRoutePass,

    // quick "create route" form
    isRouteCreateOpen, routeCreateTitle, routeCreatePostIds, routeCreatePostId, routeCreateError, routeCreateSaving,
    resetRouteCreateForm, saveNewRoute,
  };
}
