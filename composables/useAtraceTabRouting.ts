import type { ComputedRef } from 'vue';

// Owns the A-Trace attendance page's active-tab / selected-post state and
// keeps it in sync with the /:namespace/atrace/:type?/:id? URL. Pure
// URL<->state sync lives here; data loading triggered by tab changes stays
// in the page since it spans multiple composables (posts + routes).
const STORED_SELECTION_KEY_PREFIX = 'atrace-selected-post:';

export function useAtraceTabRouting(nsSlug: ComputedRef<string>) {
  const router = useRouter();
  const route = useRoute();

  const activeTab = ref<string>('attendance');
  const selectedPostId = ref<string | null>(null);
  const isRouteAll = ref(false);
  const lastAttendancePostId = ref<string | null>(null);
  const isSyncingFromRoute = ref(false);

  const activeRouteId = computed(() => (activeTab.value.startsWith('route:') ? activeTab.value.slice(6) : null));
  const isRouteTab = computed(() => activeRouteId.value !== null);

  function getStoredSelectionKey(ns: string) {
    return `${STORED_SELECTION_KEY_PREFIX}${ns}`;
  }

  function buildAtracePath(type: string, id: string | null = null): string {
    const safeType = type || 'attendance';
    if (safeType === 'attendance') {
      const safeId = id && id !== '' ? id : 'all';
      return `/${nsSlug.value}/atrace/attendance/${safeId}`;
    }
    // For routes, id is the route ID
    return `/${nsSlug.value}/atrace/route/${id}`;
  }

  function applyRouteParamsFromUrl() {
    const typeParam = (route.params.type as string | undefined) || 'attendance';
    const idParam = (route.params.id as string | undefined) || 'all';

    isSyncingFromRoute.value = true;

    if (typeParam === 'attendance') {
      activeTab.value = 'attendance';
      isRouteAll.value = false;
      if (idParam === 'all' || !idParam) {
        selectedPostId.value = '';
      } else {
        selectedPostId.value = idParam;
      }
    } else if (typeParam === 'route') {
      // For routes: set tab to route, don't select posts
      activeTab.value = `route:${idParam}`;
      selectedPostId.value = null;
      isRouteAll.value = true;
    } else {
      // Default to attendance
      activeTab.value = 'attendance';
      isRouteAll.value = false;
      selectedPostId.value = '';
    }

    nextTick(() => {
      isSyncingFromRoute.value = false;
    });
  }

  watch([selectedPostId, activeTab], ([val, tab]) => {
    if (!process.client || isSyncingFromRoute.value) return;

    const isAttendance = tab === 'attendance';
    const routeId = tab.startsWith('route:') ? tab.slice(6) : null;

    let nextPath: string;
    if (isAttendance) {
      // For attendance: use actual postId or 'all' for empty string
      const id = val === null ? '' : (val === '' ? '' : val);
      nextPath = buildAtracePath('attendance', id);
      try {
        const key = getStoredSelectionKey(nsSlug.value);
        if (val === null || val === '') {
          localStorage.removeItem(key);
        } else {
          localStorage.setItem(key, val);
        }
      } catch {}
    } else if (routeId) {
      // For routes: use route ID
      nextPath = buildAtracePath('route', routeId);
    } else {
      nextPath = buildAtracePath('attendance', '');
    }

    if (route.path !== nextPath) {
      router.push(nextPath);
    }
  });

  watch(() => [route.params.type, route.params.id], () => {
    applyRouteParamsFromUrl();
  });

  return {
    activeTab,
    selectedPostId,
    isRouteAll,
    lastAttendancePostId,
    activeRouteId,
    isRouteTab,
    applyRouteParamsFromUrl,
    buildAtracePath,
  };
}
