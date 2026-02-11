<script lang="ts" setup>
import Card from "@/components/Card.vue";
import AttendanceStatsTable from '@/components/atrace/AttendanceStatsTable.vue';
import CreatePostModal from "@/components/atrace/CreatePostModal.vue";
import EditPostModal from "@/components/atrace/EditPostModal.vue";
import FilterModal from "@/components/atrace/FilterModal.vue";
import RouteModal from '@/components/atrace/RouteModal.vue';
import TourGuide from "@/components/TourGuide.vue";
import { useI18n } from '@/composables/useI18n';
import { CookieKeys, dynamicLS } from '@/utils/storageKeys';
import { useAtraceToken } from '@/composables/useAtraceToken';
import { useAuth } from '@/composables/useAuth';
import { getErrorMessage } from '@/utils/types/errors';
import { getBrowserTimezone } from '@/utils/timezones';
import { useOnboarding } from '@/composables/useOnboarding';
import { atraceTour } from '@/config/tours';
import { useNamespace } from '@/composables/useNamespace';
const { t } = useI18n();
const { titleBySlug } = useNamespace();

definePageMeta({
    name: 'atrace',
    path: '/:namespace/atrace/:type/:id?',
    middleware: (to) => {
        // type: 'attendance' or 'route'
        // For attendance: id can be specific location, 'all', or empty
        // For route: id is the route ID
        const type = to.params.type as string | undefined;
        const id = to.params.id as string | undefined;
        
        // If type is not set, default to attendance
        if (!type) {
            let defaultPostId = 'all';
            if (process.client) {
                try {
                    const storageKey = `atrace-selected-post:${to.params.namespace}`;
                    const saved = localStorage.getItem(storageKey);
                    defaultPostId = saved || 'all';
                } catch {
                    defaultPostId = 'all';
                }
            }
            return navigateTo(`/${to.params.namespace}/atrace/attendance/${defaultPostId}`, { replace: true });
        }
        
        // For attendance, ensure id is set
        if (type === 'attendance' && !id) {
            let defaultPostId = 'all';
            if (process.client) {
                try {
                    const storageKey = `atrace-selected-post:${to.params.namespace}`;
                    const saved = localStorage.getItem(storageKey);
                    defaultPostId = saved || 'all';
                } catch {
                    defaultPostId = 'all';
                }
            }
            return navigateTo(`/${to.params.namespace}/atrace/attendance/${defaultPostId}`, { replace: true });
        }
    }
});

// data
type Post = {
    id: string;
    title: string;
    description?: string | null;
    location?: { comment?: string | null; country?: string | null; city?: string | null; address?: string | null; latitude?: number | null; longitude?: number | null; timezone?: string | null } | null;
    phrase?: string;
};

type RouteMilestone = {
    postId: string;
    priority: number;
};

type Route = {
    id: string;
    title: string;
    milestones: RouteMilestone[];
};

type RouteMilestoneDetail = {
    postId: string;
    priority: number;
    recordId?: string | null;
    timestamp?: string | null;
    isCorrectOrder: boolean;
};

type RoutePass = {
    id: string;
    routeId: string;
    userId: string;
    date: string;
    status: string;
    firstRecordId?: string | null;
    lastRecordId?: string | null;
    processedAt?: string | null;
    details: RouteMilestoneDetail[];
};

type RouteProgressRow = {
    userId: string;
    username: string;
    email: string;
    lastDate: string | null;
    lastStatus: string | null;
    completedCount: number;
    partialCount: number;
    violatedCount: number;
    pendingCount: number;
};

const posts = ref<Post[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const showSkeletons = computed(() => loading.value || Boolean(error.value));
const routes = ref<Route[]>([]);
const routesLoading = ref(false);
const routesError = ref<string | null>(null);
const activeTab = ref<string>('attendance');
const activeRouteId = computed(() => (activeTab.value.startsWith('route:') ? activeTab.value.slice(6) : null));
const activeRoute = computed(() => routes.value.find((r) => r.id === activeRouteId.value) || null);
const isRouteTab = computed(() => activeRouteId.value !== null);
const routePass = ref<RoutePass | null>(null);
const routePassLoading = ref(false);
const routePassError = ref<string | null>(null);
const routeValidationDate = ref(getTodayDateString());
const lastAttendancePostId = ref<string | null>(null);
const isRouteAll = ref(false);
const routeProgressStart = ref(getDateDaysAgo(6));
const routeProgressEnd = ref(getTodayDateString());
const routePasses = ref<RoutePass[]>([]);
const routePassesLoading = ref(false);
const routePassesError = ref<string | null>(null);
const routeMembers = ref<Array<{ userId: string; username: string; email: string }>>([]);
const routeMembersLoading = ref(false);
const isRouteCreateOpen = ref(false);
const routeCreateTitle = ref('');
const routeCreatePostIds = ref<string[]>([]);
const routeCreatePostId = ref('');
const routeCreateError = ref<string | null>(null);
const routeCreateSaving = ref(false);
// Cache namespace id to avoid repeated lookups
const cachedNamespaceId = ref<string | null>(null);
// Pagination state for infinite scroll
const page = ref(1);
import { PaginationLength } from '@/utils/constants';

const pageLength = ref<PaginationLength>(PaginationLength.TEN);
const totalCount = ref(0);
const loadingMore = ref(false);
const hasMore = computed(() => posts.value.length < totalCount.value);
// Horizontal scroll container and sentinel for IntersectionObserver
const cardsScrollRef = ref<HTMLElement | null>(null);
const cardsSentinelRef = ref<HTMLElement | null>(null);
let cardsObserver: IntersectionObserver | null = null;
const selectedPostId = ref<string | null>(null);

// Computed for USelectMenu (doesn't accept null)
const selectedPostIdForMenu = computed({
    get: () => selectedPostId.value ?? '',
    set: (val: string) => { selectedPostId.value = val === '' ? '' : val; }
});

// Track if "All" card is selected (empty string = all posts)
const selectedPostIdForDisplay = computed(() => {
    return selectedPostId.value === '' ? '' : selectedPostId.value;
});

// Currently selected post and its display helpers
const selectedPost = computed(() => posts.value.find(p => p.id === selectedPostId.value) || null);
const selectedPostTitle = computed(() => {
    if (selectedPostId.value === '') return t('app.allLocations') || 'All locations';
    if (!selectedPost.value) return '';
    const parts = [];
    if (selectedPost.value.title?.trim()) parts.push(selectedPost.value.title.trim());
    if (selectedPost.value.location?.city?.trim()) parts.push(selectedPost.value.location.city);
    if (selectedPost.value.location?.address?.trim()) parts.push(selectedPost.value.location.address);
    return parts.join(' — ');
});
const selectedPostLocationLine = computed(() => {
    const city = selectedPost.value?.location?.city || '';
    const address = selectedPost.value?.location?.address || '';
    const parts = [] as string[];
    if (city) parts.push(city);
    if (address) parts.push(address);
    return parts.join(', ');
});

const router = useRouter();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);
const { user, fetchUser } = useAuth();
const isSyncingFromRoute = ref(false);
const ROUTE_SEG_ATTENDANCE = 'attendance';
const ROUTE_SEG_ALL = 'all';

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

const isOpen = ref(false)
const isFilterOpen = ref(false)
const isCreateOpen = ref(false)
const isEditOpen = ref(false)
const editingPost = ref<Post | null>(null)
const isLimitModalOpen = ref(false)
const limitErrorMessage = ref<string>('')
const showRouteConceptInfo = ref(false)
const showStatInfoTooltip = ref(false)

// Create form state
const form = reactive<{ title: string; description?: string; location: { address?: string; city?: string; country?: string; comment?: string; latitude?: number | '' ; longitude?: number | ''; timezone?: string }, pin: string }>(
        { title: '', description: '', location: { address: '', city: '', country: '', comment: '', latitude: '', longitude: '', timezone: '' }, pin: '' }
);

// PIN generation/copy handled inside modal component

// Edit form state
const editForm = reactive<{ title: string; description?: string; location: { address?: string; city?: string; country?: string; comment?: string; latitude?: number | '' ; longitude?: number | ''; timezone?: string }, pin: string }>(
    { title: '', description: '', location: { address: '', city: '', country: '', comment: '', latitude: '', longitude: '', timezone: '' }, pin: '' }
);
// Edit PIN helpers handled inside modal component

const { ensure: ensureAtraceToken } = useAtraceToken();
const LAST_ACTIVE_KEY = 'atrace-last-active'
const INACTIVE_REFRESH_MS = 12 * 60 * 60 * 1000
const STORED_SELECTION_KEY_PREFIX = 'atrace-selected-post:'

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

function setLastActiveNow() {
    if (!process.client) return;
    try { localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now())); } catch {}
}

function getLastActiveTs(): number | null {
    if (!process.client) return null;
    try {
        const raw = localStorage.getItem(LAST_ACTIVE_KEY);
        const ts = raw ? Number(raw) : NaN;
        return Number.isFinite(ts) ? ts : null;
    } catch {
        return null;
    }
}

async function refreshIfStale() {
    if (!process.client) return;
    const last = getLastActiveTs();
    const now = Date.now();
    if (last && now - last > INACTIVE_REFRESH_MS) {
        await loadPosts(1);
    }
    setLastActiveNow();
}

async function loadPosts(retryCount = 0) {
    loading.value = true;
    error.value = null;
    try {
        const hubToken = useCookie<string | null>(CookieKeys.TOKEN, { path: '/' }).value;
        // Force token refresh on retry
        if (retryCount > 0) {
            const { clear } = useAtraceToken();
            clear();
        }
        const atraceToken = await ensureAtraceToken(nsSlug.value, hubToken);
        if (!atraceToken) {
            router.push('/');
            return;
        }
        const { atracePostsList } = await import('@/api/atrace/post/list');
        page.value = 1;
        // Map enum to API literal type
        const lengthMap: Record<PaginationLength, 'TEN' | 'TWENTY_FIVE' | 'FIFTY' | 'ONE_HUNDRED'> = {
            [PaginationLength.TEN]: 'TEN',
            [PaginationLength.FIFTEEN]: 'TEN',
            [PaginationLength.TWENTY]: 'TWENTY_FIVE',
            [PaginationLength.TWENTY_FIVE]: 'TWENTY_FIVE',
            [PaginationLength.THIRTY]: 'FIFTY',
            [PaginationLength.THIRTY_FIVE]: 'FIFTY',
            [PaginationLength.FORTY]: 'FIFTY',
            [PaginationLength.FORTY_FIVE]: 'FIFTY',
            [PaginationLength.FIFTY]: 'FIFTY',
            [PaginationLength.FIFTY_FIVE]: 'ONE_HUNDRED',
            [PaginationLength.SIXTY]: 'ONE_HUNDRED',
            [PaginationLength.SIXTY_FIVE]: 'ONE_HUNDRED',
            [PaginationLength.SEVENTY]: 'ONE_HUNDRED',
            [PaginationLength.SEVENTY_FIVE]: 'ONE_HUNDRED',
            [PaginationLength.EIGHTY]: 'ONE_HUNDRED',
            [PaginationLength.EIGHTY_FIVE]: 'ONE_HUNDRED',
            [PaginationLength.NINETY]: 'ONE_HUNDRED',
            [PaginationLength.NINETY_FIVE]: 'ONE_HUNDRED',
            [PaginationLength.ONE_HUNDRED]: 'ONE_HUNDRED',
        };
        const res = await atracePostsList(atraceToken, nsSlug.value, { page: page.value, length: lengthMap[pageLength.value] });
        posts.value = [...res.posts].sort((a, b) => (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' }));
        totalCount.value = res.count || 0;
        if (!isRouteTab.value) {
            // Only set default if selectedPostId is explicitly null, preserve empty string ("All")
            if (selectedPostId.value === null || (selectedPostId.value !== '' && !posts.value.some(p => p.id === selectedPostId.value))) {
                selectedPostId.value = posts.value[0]?.id ?? null;
            }
        }
    } catch (e: unknown) {
        const errorMsg = getErrorMessage(e) || 'Failed to load posts';
        // Check if it's an authentication/token error
        const isAuthError = errorMsg.toLowerCase().includes('unauthorized') || 
                           errorMsg.toLowerCase().includes('invalid') ||
                           errorMsg.toLowerCase().includes('token') ||
                           (e as any)?.response?.status === 401;
        
        // Retry once with fresh token if auth error
        if (isAuthError && retryCount === 0) {
            console.log('[loadPosts] Auth error detected, retrying with fresh token');
            await loadPosts(1);
            return;
        }
        error.value = errorMsg;
    } finally {
        loading.value = false;
    }
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
        routes.value = [...res.routes].sort((a, b) => (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' }));
        if (!activeRouteId.value && routes.value.length > 0 && activeTab.value !== 'attendance') {
            activeTab.value = 'attendance';
        }
    } catch (e) {
        routesError.value = getErrorMessage(e) || (t('app.route.loadFailed') || 'Failed to load routes');
        routes.value = [];
    } finally {
        routesLoading.value = false;
    }
}

const orderedRoutePostIds = computed(() => {
    if (!activeRoute.value) return [] as string[];
    return [...activeRoute.value.milestones]
        .sort((a, b) => a.priority - b.priority)
        .map((m) => m.postId);
});

const routePosts = computed(() => {
    if (!activeRoute.value) return [] as Post[];
    const postMap = new Map(posts.value.map((p) => [p.id, p] as const));
    return orderedRoutePostIds.value
        .map((id) => postMap.get(id))
        .filter(Boolean) as Post[];
});

const visiblePosts = computed(() => posts.value);

function formatRouteStatus(status?: string | null): { label: string; color: string } {
    const normalized = String(status || '').toLowerCase();
    if (normalized === 'completed') return { label: t('app.route.status.ok') || 'OK', color: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-100' };
    if (normalized === 'partial') return { label: t('app.route.status.partial') || 'Partial', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-100' };
    if (normalized === 'violated') return { label: t('app.route.status.violation') || 'Violation', color: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-100' };
    return { label: t('app.route.status.pending') || 'Pending', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100' };
}

const formatProgressStatus = formatRouteStatus;

const routeMilestoneDetails = computed(() => {
    if (!routePass.value?.details) return [] as RouteMilestoneDetail[];
    return [...routePass.value.details].sort((a, b) => a.priority - b.priority);
});

function buildPostLabel(post: Post): string {
    const parts: string[] = [];
    if (post.title?.trim()) parts.push(post.title.trim());
    if (post.location?.city?.trim()) parts.push(post.location.city);
    if (post.location?.address?.trim()) parts.push(post.location.address);
    return parts.join(' — ');
}

function getRoutePostLabel(postId: string): string {
    const post = posts.value.find((p) => p.id === postId);
    if (!post) return postId;
    return buildPostLabel(post);
}

const routeCreatePostOptions = computed(() => {
    const used = new Set(routeCreatePostIds.value);
    return posts.value
        .filter((post) => !used.has(post.id))
        .map((post) => ({ label: buildPostLabel(post), value: post.id }));
});

function resetRouteCreateForm() {
    routeCreateTitle.value = '';
    routeCreatePostIds.value = [];
    routeCreatePostId.value = '';
    routeCreateError.value = null;
}

async function openCreateRouteModal() {
    resetRouteCreateForm();
    isRouteCreateOpen.value = true;
    if (posts.value.length === 0) {
        await loadPosts();
    }
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

    const hubToken = useCookie<string | null>(CookieKeys.TOKEN, { path: '/' }).value;
    const atraceToken = await ensureAtraceToken(nsSlug.value, hubToken);
    if (!atraceToken) return;

    routeCreateSaving.value = true;
    try {
        const { atraceCreateRoute } = await import('@/api/atrace/route/create');
        const milestones = routeCreatePostIds.value.map((postId, idx) => ({ postId, priority: idx + 1 }));
        const created = await atraceCreateRoute(atraceToken, nsSlug.value, { title, milestones });
        routes.value = [...routes.value, created].sort((a, b) => (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' }));
        isRouteCreateOpen.value = false;
        resetRouteCreateForm();
    } catch (e) {
        routeCreateError.value = getErrorMessage(e) || (t('app_route_save_failed') || 'Failed to save route');
    } finally {
        routeCreateSaving.value = false;
    }
}

function getMilestoneStatusLabel(detail: any): string {
    if (!detail.recordId) return t('app.route.status.pending') || 'Pending';
    if (detail.isCorrectOrder) return t('app.route.status.ok') || 'OK';
    return t('app.route.status.partial') || 'Out of order';
}

async function validateRoutePass() {
    if (routePassLoading.value) return;
    if (!activeRouteId.value) {
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
    if (!activeRouteId.value) {
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
            routeId: activeRouteId.value,
            startDate: routeProgressStart.value,
            endDate: routeProgressEnd.value,
            validateUserId: user.value.id,
            validateDate: routeValidationDate.value,
            includeValidation,
        });

        routes.value = [...result.routes].sort((a, b) => (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' }));
        routePasses.value = result.passes || [];
        if (includeValidation) {
            routePass.value = result.validation;
        }
    } catch (e) {
        const errorMsg = getErrorMessage(e) || 'Failed to load route data';
        if (shouldSetRoutesLoading) {
            routesError.value = errorMsg;
            routes.value = [];
        }
        routePassesError.value = errorMsg;
        routePasses.value = [];
        if (includeValidation) {
            routePassError.value = getErrorMessage(e) || (t('app.route.validateFailed') || 'Failed to validate route');
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

// Load both members and passes in parallel
async function loadRouteData() {
    await Promise.all([
        loadRouteMembers(),
        loadRouteAtraceBundle(true)
    ]);
}

const routeProgressRows = computed<RouteProgressRow[]>(() => {
    if (!activeRouteId.value || routePasses.value.length === 0) return [];
    
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

async function loadMorePosts() {
    if (loading.value || loadingMore.value) return;
    if (!hasMore.value) return;
    loadingMore.value = true;
    try {
        const hubToken = useCookie<string | null>(CookieKeys.TOKEN, { path: '/' }).value;
        const atraceToken = await ensureAtraceToken(nsSlug.value, hubToken);
        if (!atraceToken) return;
        const { atracePostsList } = await import('@/api/atrace/post/list');
        const nextPage = page.value + 1;
        const lengthMap: Record<PaginationLength, 'TEN' | 'TWENTY_FIVE' | 'FIFTY' | 'ONE_HUNDRED'> = {
            [PaginationLength.TEN]: 'TEN',
            [PaginationLength.FIFTEEN]: 'TEN',
            [PaginationLength.TWENTY]: 'TWENTY_FIVE',
            [PaginationLength.TWENTY_FIVE]: 'TWENTY_FIVE',
            [PaginationLength.THIRTY]: 'FIFTY',
            [PaginationLength.THIRTY_FIVE]: 'FIFTY',
            [PaginationLength.FORTY]: 'FIFTY',
            [PaginationLength.FORTY_FIVE]: 'FIFTY',
            [PaginationLength.FIFTY]: 'FIFTY',
            [PaginationLength.FIFTY_FIVE]: 'ONE_HUNDRED',
            [PaginationLength.SIXTY]: 'ONE_HUNDRED',
            [PaginationLength.SIXTY_FIVE]: 'ONE_HUNDRED',
            [PaginationLength.SEVENTY]: 'ONE_HUNDRED',
            [PaginationLength.SEVENTY_FIVE]: 'ONE_HUNDRED',
            [PaginationLength.EIGHTY]: 'ONE_HUNDRED',
            [PaginationLength.EIGHTY_FIVE]: 'ONE_HUNDRED',
            [PaginationLength.NINETY]: 'ONE_HUNDRED',
            [PaginationLength.NINETY_FIVE]: 'ONE_HUNDRED',
            [PaginationLength.ONE_HUNDRED]: 'ONE_HUNDRED',
        };
        const res = await atracePostsList(atraceToken, nsSlug.value, { page: nextPage, length: lengthMap[pageLength.value] });
        // Append next page (server already sorted by title ASC)
        posts.value = [...posts.value, ...res.posts];
        page.value = nextPage;
        totalCount.value = res.count || totalCount.value;
    } catch (e) {
        // swallow, visible state stays as-is
    } finally {
        loadingMore.value = false;
    }
}

function setupCardsObserver() {
    if (!process.client) return;
    // Cleanup previous observer
    if (cardsObserver) {
        try { cardsObserver.disconnect(); } catch {}
        cardsObserver = null;
    }
    const root = cardsScrollRef.value || undefined;
    const target = cardsSentinelRef.value || undefined;
    if (!root || !target) return;
    cardsObserver = new IntersectionObserver((entries) => {
        for (const entry of entries) {
            if (entry.isIntersecting) {
                // Trigger next page load when sentinel is visible
                loadMorePosts();
            }
        }
    }, {
        root,
        threshold: 0.1,
        // Preload a bit earlier on the right edge
        rootMargin: '0px 256px 0px 0px'
    });
    cardsObserver.observe(target);
}

async function handleCreate() {
    const hubToken = useCookie<string | null>(CookieKeys.TOKEN, { path: '/' }).value;
    const atraceToken = await ensureAtraceToken(nsSlug.value, hubToken);
    if (!atraceToken) return router.push('/');
    try {
        const { atraceCreatePost } = await import('@/api/atrace/post/create');
        const payload: any = { title: form.title };
        if (form.description) payload.description = form.description;
        // send only filled location fields
        const loc: any = {};
        for (const k of ['address','city','country','comment'] as const) {
            const v = (form.location as any)[k];
            if (v !== undefined && v !== null && v !== '') loc[k] = v;
        }
        // Handle coordinates separately to ensure they're numbers
        if (form.location.latitude !== '' && form.location.latitude !== undefined && form.location.latitude !== null) {
            loc.latitude = Number(form.location.latitude);
        }
        if (form.location.longitude !== '' && form.location.longitude !== undefined && form.location.longitude !== null) {
            loc.longitude = Number(form.location.longitude);
        }
        // Add timezone: use form value if provided, otherwise default to browser timezone
        if (form.location.timezone) {
            loc.timezone = form.location.timezone;
        } else {
            loc.timezone = getBrowserTimezone();
        }
        if (Object.keys(loc).length) payload.location = loc;
        // Add pin as phrase
        if (form.pin && form.pin.length === 6) payload.phrase = form.pin;
        const created = await atraceCreatePost(atraceToken, nsSlug.value, payload);
    posts.value = [...posts.value, created].sort((a, b) => (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' }));
    totalCount.value = totalCount.value + 1;
    selectedPostId.value = created.id;
    isCreateOpen.value = false;
    // reset form
    form.title = '';
    form.description = '';
    form.location = { address: '', city: '', country: '', comment: '', latitude: '', longitude: '', timezone: '' };
    form.pin = '';
    } catch (e) {
        const msg = getErrorMessage(e)
        const lower = msg.toLowerCase()
        if (lower.includes('post limit reached') || lower.includes('resourceexhausted')) {
            const match = msg.match(/You have\s+(\d+)\s+posts,\s+maximum allowed is\s+(\d+)/i)
            const current = match?.[1]
            const max = match?.[2]
            if (current && max) {
                const template = t('app.limitReachedReadable') || 'Post limit reached ({current}/{max}). Upgrade your plan to create more posts.'
                limitErrorMessage.value = template.replace('{current}', current).replace('{max}', max)
            } else {
                limitErrorMessage.value = t('app.limitReachedReadable') || 'Post limit reached. Upgrade your plan to create more posts.'
            }
            isLimitModalOpen.value = true
            return
        }
    }
}


async function handleDelete(p: Post, opts?: { skipConfirm?: boolean }) {
    const hubToken = useCookie<string | null>(CookieKeys.TOKEN, { path: '/' }).value;
    const atraceToken = await ensureAtraceToken(nsSlug.value, hubToken);
    if (!atraceToken) return router.push('/');
    try {
        const { atraceDeletePost } = await import('@/api/atrace/post/delete');
        const id = await atraceDeletePost(atraceToken, nsSlug.value, p.id);
        posts.value = posts.value.filter(x => x.id !== id);
        totalCount.value = Math.max(0, totalCount.value - 1);
        if (selectedPostId.value === id) {
            selectedPostId.value = posts.value[0]?.id ?? null;
        }
        // If we're deleting from Edit modal, close it
        if (editingPost.value?.id === id) {
            isEditOpen.value = false;
            editingPost.value = null;
        }
    } catch (e) {
        // noop
    }
}

function openEdit(p: Post) {
    editingPost.value = p;
    editForm.title = p.title || '';
    editForm.description = p.description || '';
    editForm.location = {
        address: p.location?.address || '',
        city: p.location?.city || '',
        country: p.location?.country || '',
        comment: p.location?.comment || '',
        latitude: (p.location?.latitude ?? ''),
        longitude: (p.location?.longitude ?? ''),
        timezone: p.location?.timezone || '',
    };
    editForm.pin = p.phrase || '';
    console.log('Opening edit for post:', p.id, 'with timezone:', p.location?.timezone);
    console.log('editForm.location.timezone set to:', editForm.location.timezone);
    isEditOpen.value = true;
}

async function handleEditSave() {
    if (!editingPost.value) return;
    const hubToken = useCookie<string | null>(CookieKeys.TOKEN, { path: '/' }).value;
    const atraceToken = await ensureAtraceToken(nsSlug.value, hubToken);
    if (!atraceToken) return router.push('/');

    const targetId = editingPost.value.id;
    // Build update payload
    // Normalize scalar fields: empty string -> null
    const norm = (v: any) => (v === '' ? null : v);
    const payload: any = {
        id: targetId,
        title: editForm.title,
        description: norm(editForm.description),
    };
    // Add phrase if PIN is filled
    if (editForm.pin && editForm.pin.length === 6) {
        payload.phrase = editForm.pin;
    }
    // Normalize location fields: empty string -> null, 0 -> null
    const origLat = editingPost.value.location?.latitude;
    const origLon = editingPost.value.location?.longitude;
    let lat: number | null = null;
    let lon: number | null = null;
    if (editForm.location.latitude !== '' && editForm.location.latitude != null) {
        const n = Number(editForm.location.latitude);
        lat = Number.isFinite(n) && n !== 0 ? n : null;
    } else if (typeof origLat === 'number' && Number.isFinite(origLat) && origLat !== 0) {
        lat = origLat;
    }
    if (editForm.location.longitude !== '' && editForm.location.longitude != null) {
        const n = Number(editForm.location.longitude);
        lon = Number.isFinite(n) && n !== 0 ? n : null;
    } else if (typeof origLon === 'number' && Number.isFinite(origLon) && origLon !== 0) {
        lon = origLon;
    }
    const loc: Record<string, any> = {};
    // Always include string fields (include null to explicitly clear on backend)
    const c = norm(editForm.location.comment);
    const cn = norm(editForm.location.country);
    const ct = norm(editForm.location.city);
    const ad = norm(editForm.location.address);
    loc.comment = c;
    loc.country = cn;
    loc.city = ct;
    loc.address = ad;
    // Include lat/lon only when we have both valid numbers; omit otherwise to avoid 422
    if (lat !== null && lat !== 0 && lon !== null && lon !== 0) {
        loc.latitude = lat as number;
        loc.longitude = lon as number;
    }
    // Always include timezone (even if empty to allow clearing)
    loc.timezone = editForm.location.timezone || '';
    // Send location as-is (strings may be null to clear). Only attach lat/lon if both valid.
    payload.location = loc;

    try {
        const { atraceUpdatePost } = await import('@/api/atrace/post/update');
        const updated = await atraceUpdatePost(atraceToken, nsSlug.value, payload);
        posts.value = posts.value.map(p => p.id === targetId ? { ...p, ...updated } : p);
        isEditOpen.value = false;
        editingPost.value = null;
    } catch (e: any) {
        const status = e?.response?.status;
        // If backend requires location and 422 occurred, retry with original location merged
        if (status === 422) {
            try {
                const { atraceUpdatePost } = await import('@/api/atrace/post/update');
                const orig = editingPost.value?.location || {} as any;
                const retryLoc: Record<string, any> = {};
                if (orig.comment != null) retryLoc.comment = orig.comment;
                if (orig.country != null) retryLoc.country = orig.country;
                if (orig.city != null) retryLoc.city = orig.city;
                if (orig.address != null) retryLoc.address = orig.address;
                const hasOrigCoords = typeof orig.latitude === 'number' && typeof orig.longitude === 'number' && Number.isFinite(orig.latitude) && Number.isFinite(orig.longitude);
                if (hasOrigCoords) {
                    retryLoc.latitude = orig.latitude;
                    retryLoc.longitude = orig.longitude;
                }
                const payload2 = { ...payload, location: retryLoc };
                const updated = await atraceUpdatePost(atraceToken, nsSlug.value, payload2 as any);
                posts.value = posts.value.map(p => p.id === targetId ? { ...p, ...updated } : p);
                isEditOpen.value = false;
                editingPost.value = null;
                return;
            } catch (e2: any) {
                const msg2 = e2?.response?.errors?.[0]?.message || e2?.message || 'Failed to update post';
                error.value = msg2;
                return;
            }
        }
        const msg = e?.response?.errors?.[0]?.message || e?.message || 'Failed to update post';
        error.value = msg;
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

    // Always load posts (needed for post names in route timeline)
    await loadPosts();
    if (!isRouteTab.value) {
        setupCardsObserver();
    }
    // Always load routes unless route bundle will fetch them
    if (!isRouteTab.value || !activeRouteId.value) {
        await loadRoutes();
    }
    
    if (process.client) {
        setLastActiveNow();
        document.addEventListener('visibilitychange', refreshIfStale);
        window.addEventListener('focus', refreshIfStale);
        
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

watch([routeValidationDate, user], () => {
    if (!isRouteTab.value) return;
    loadRoutePass();
});

// Watch only date changes to reload passes (members are loaded once when route opens)
watch([routeProgressStart, routeProgressEnd], () => {
    if (!isRouteTab.value) return;
    loadRoutePasses();
});

watch(() => nsSlug.value, async (n, o) => {
    if (n && n !== o) {
        applyRouteParamsFromUrl();
        routeMembers.value = [];
        routePasses.value = [];
        cachedNamespaceId.value = null; // Clear cache on namespace change
        // Always load posts (needed for post names in route timeline)
        await loadPosts();
        if (!isRouteTab.value) {
            setupCardsObserver();
        }
        // Always load routes unless route bundle will fetch them
        if (!isRouteTab.value || !activeRouteId.value) {
            await loadRoutes();
        }
    }
});

watch(() => [route.params.type, route.params.id], () => {
    applyRouteParamsFromUrl();
});

onBeforeUnmount(() => {
    if (cardsObserver) {
        try { cardsObserver.disconnect(); } catch {}
        cardsObserver = null;
    }
    if (process.client) {
        document.removeEventListener('visibilitychange', refreshIfStale);
        window.removeEventListener('focus', refreshIfStale);
    }
});
</script>

<template>
    <TourGuide />

    <FilterModal v-model="isFilterOpen" />

    <div class="flex flex-col">
        <div class="flex justify-between items-center mb-4 mt-4 px-4 flex-shrink-0">
            <div class="text-left" data-tour="atrace-title">
                <h1 class="text-2xl font-semibold">{{ t('app.atraceTitle') }}</h1>
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
                    {{ t('common.settings') }}
                </UButton>
            </div>
        </div>

        <div class="px-4 flex-shrink-0">
            <div class="flex items-center gap-2 overflow-x-auto pb-2">
                <button
                    class="px-3 py-1.5 rounded-full text-sm font-medium border transition"
                    :class="activeTab === 'attendance'
                        ? 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-100 dark:border-blue-900/60'
                        : 'bg-gray-50 dark:bg-gray-900/60 border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300'"
                    @click="activeTab = 'attendance'"
                >
                    {{ t('app.attendance') || 'Посещаемость' }}
                </button>
                <button
                    v-for="r in routes"
                    :key="r.id"
                    class="px-3 py-1.5 rounded-full text-sm font-medium border transition whitespace-nowrap"
                    :class="activeTab === `route:${r.id}`
                        ? 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-100 dark:border-blue-900/60'
                        : 'bg-gray-50 dark:bg-gray-900/60 border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300'"
                    @click="activeTab = `route:${r.id}`"
                >
                    {{ r.title || (t('app.route.label') || 'Маршрут') }}
                </button>
                <UButton
                    icon="lucide:plus"
                    size="xs"
                    color="primary"
                    variant="soft"
                    class="flex-shrink-0"
                    @click="openCreateRouteModal"
                >
                    {{ t('app.route.add') || 'Добавить маршрут' }}
                </UButton>
                <span v-if="routesLoading" class="text-xs text-gray-500">{{ t('app.loading') }}</span>
                <span v-else-if="routesError" class="text-xs text-red-500">{{ routesError }}</span>
            </div>
        </div>

        <div v-if="isRouteTab" class="px-4 mt-2 flex-shrink-0">
            <!-- Route Statistics Card -->
            <div class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm p-4 sm:p-6 mb-4">
                <div class="flex flex-col gap-4">
                    <!-- Header -->
                    <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                        <div class="flex items-start gap-3">
                            <div class="flex-shrink-0 w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                <UIcon name="i-heroicons-map" class="w-6 h-6 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div class="flex-1">
                                <div class="flex items-center gap-2 mb-1">
                                    <div class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        {{ t('app.route.label') || 'Маршрут' }}
                                    </div>
                                    <button 
                                        @click="showRouteConceptInfo = !showRouteConceptInfo"
                                        class="flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-800/50 transition-colors"
                                        :title="t('app.route.concept.title') || 'Как работают маршруты'"
                                    >
                                        <UIcon name="i-heroicons-information-circle" class="w-4 h-4" />
                                    </button>
                                </div>
                                <h2 class="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white">{{ activeRoute?.title || '—' }}</h2>
                                <div class="text-sm text-gray-600 dark:text-gray-400 mt-1 flex items-center gap-2">
                                    <UIcon name="i-heroicons-view-columns" class="w-4 h-4" />
                                    <span>{{ orderedRoutePostIds.length }} {{ t('app.route.posts') || 'постов' }}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Info Block: Route Concept Explanation (Collapsible) -->
                    <Transition
                        enter-active-class="transition-all duration-300 ease-out"
                        enter-from-class="opacity-0 max-h-0"
                        enter-to-class="opacity-100 max-h-[500px]"
                        leave-active-class="transition-all duration-300 ease-in"
                        leave-from-class="opacity-100 max-h-[500px]"
                        leave-to-class="opacity-0 max-h-0"
                    >
                        <div v-if="showRouteConceptInfo" class="overflow-hidden">
                            <div class="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4">
                                <div class="flex items-start gap-3">
                                    <div class="flex-shrink-0">
                                        <UIcon name="i-heroicons-information-circle" class="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <div class="flex-1">
                                        <h4 class="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
                                            {{ t('app.route.concept.title') || 'Как работают маршруты' }}
                                        </h4>
                                        <div class="text-sm text-blue-800 dark:text-blue-200 space-y-2">
                                            <p>{{ t('app.route.concept.description') || 'Маршрут — это список постов в заданном порядке. Сотрудник отмечается на постах, а система связывает эти отметки с маршрутом.' }}</p>
                                            <p>{{ t('app.route.concept.dataCollection') || 'Статистика берется из отметок на постах (records): по каждой дате строится отдельное прохождение маршрута.' }}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Transition>
                    
                    <!-- Statistics Info Toggle -->
                    <div v-if="!routePassesLoading && !routePassesError && routePasses.length > 0" class="flex items-center gap-2 mb-2">
                        <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('app.route.statistics') || 'Статистика' }}</span>
                        <button 
                            @click="showStatInfoTooltip = !showStatInfoTooltip"
                            class="flex items-center justify-center w-5 h-5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                            :title="t('app.route.stat.info') || 'Как считаются цифры'"
                        >
                            <UIcon name="i-heroicons-information-circle" class="w-4 h-4" />
                        </button>
                    </div>

                    <!-- Statistics Info Panel -->
                    <Transition
                        enter-active-class="transition-all duration-300 ease-out"
                        enter-from-class="opacity-0 max-h-0"
                        enter-to-class="opacity-100 max-h-[200px]"
                        leave-active-class="transition-all duration-300 ease-in"
                        leave-from-class="opacity-100 max-h-[200px]"
                        leave-to-class="opacity-0 max-h-0"
                    >
                        <div v-if="showStatInfoTooltip" class="overflow-hidden mb-3">
                            <div class="rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3">
                                <div class="text-xs text-gray-700 dark:text-gray-300 space-y-1.5">
                                    <div class="flex items-start gap-2">
                                        <div class="w-5 h-5 rounded bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                                            <UIcon name="i-heroicons-arrow-path" class="w-3 h-3 text-blue-600 dark:text-blue-400" />
                                        </div>
                                        <div>
                                            <span class="font-medium">{{ t('app.route.stat.total') || 'Всего' }}</span> — {{ t('app.route.stat.totalHint') || 'Количество прохождений маршрута за выбранный период (каждая дата = одно прохождение)' }}
                                        </div>
                                    </div>
                                    <div class="flex items-start gap-2">
                                        <div class="w-5 h-5 rounded bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                                            <UIcon name="i-heroicons-check-circle" class="w-3 h-3 text-green-600 dark:text-green-400" />
                                        </div>
                                        <div>
                                            <span class="font-medium">{{ t('app.route.status.ok') || 'Успешно' }}</span> — {{ t('app.route.stat.completedHint') || 'Полные прохождения: есть отметки по всем постам и порядок соблюдён' }}
                                        </div>
                                    </div>
                                    <div class="flex items-start gap-2">
                                        <div class="w-5 h-5 rounded bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
                                            <UIcon name="i-heroicons-exclamation-triangle" class="w-3 h-3 text-orange-600 dark:text-orange-400" />
                                        </div>
                                        <div>
                                            <span class="font-medium">{{ t('app.route.status.partial') || 'Частично' }}</span> — {{ t('app.route.stat.partialHint') || 'Есть отметки только по части постов маршрута' }}
                                        </div>
                                    </div>
                                    <div class="flex items-start gap-2">
                                        <div class="w-5 h-5 rounded bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                                            <UIcon name="i-heroicons-x-circle" class="w-3 h-3 text-red-600 dark:text-red-400" />
                                        </div>
                                        <div>
                                            <span class="font-medium">{{ t('app.route.status.violation') || 'Нарушения' }}</span> — {{ t('app.route.stat.violatedHint') || 'Отметки есть, но порядок маршрута нарушен' }}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Transition>

                    <!-- Statistics Grid -->
                    <div v-if="!routePassesLoading && !routePassesError && routePasses.length > 0" class="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-2">
                        <!-- Total passes -->
                        <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                            <div class="flex items-center gap-3">
                                <div class="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                                    <UIcon name="i-heroicons-arrow-path" class="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div>
                                    <div class="text-2xl font-bold text-gray-900 dark:text-white">{{ routePasses.length }}</div>
                                    <div class="text-xs font-medium text-gray-500 dark:text-gray-400">{{ t('app.route.stat.total') || 'Всего' }}</div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Completed -->
                        <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                            <div class="flex items-center gap-3">
                                <div class="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                                    <UIcon name="i-heroicons-check-circle" class="w-5 h-5 text-green-600 dark:text-green-400" />
                                </div>
                                <div>
                                    <div class="text-2xl font-bold text-gray-900 dark:text-white">
                                        {{ routePasses.filter(p => p.status.toLowerCase() === 'completed').length }}
                                    </div>
                                    <div class="text-xs font-medium text-gray-500 dark:text-gray-400">{{ t('app.route.status.ok') || 'Успешно' }}</div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Partial -->
                        <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                            <div class="flex items-center gap-3">
                                <div class="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
                                    <UIcon name="i-heroicons-exclamation-triangle" class="w-5 h-5 text-orange-600 dark:text-orange-400" />
                                </div>
                                <div>
                                    <div class="text-2xl font-bold text-gray-900 dark:text-white">
                                        {{ routePasses.filter(p => p.status.toLowerCase() === 'partial').length }}
                                    </div>
                                    <div class="text-xs font-medium text-gray-500 dark:text-gray-400">{{ t('app.route.status.partial') || 'Частично' }}</div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Violations -->
                        <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                            <div class="flex items-center gap-3">
                                <div class="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                                    <UIcon name="i-heroicons-x-circle" class="w-5 h-5 text-red-600 dark:text-red-400" />
                                </div>
                                <div>
                                    <div class="text-2xl font-bold text-gray-900 dark:text-white">
                                        {{ routePasses.filter(p => p.status.toLowerCase() === 'violated').length }}
                                    </div>
                                    <div class="text-xs font-medium text-gray-500 dark:text-gray-400">{{ t('app.route.status.violation') || 'Нарушения' }}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Route Progress Section -->
            <div class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm p-4 sm:p-6">
                <div class="mb-4">
                    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                        <div>
                            <h3 class="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                <UIcon name="i-heroicons-users" class="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                {{ t('app.route.employees') || 'Сотрудники' }}
                            </h3>
                            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                {{ t('app.route.employeesHint') || 'Статистика прохождения маршрута по сотрудникам' }}
                            </p>
                        </div>
                        
                        <!-- Period selector moved here -->
                        <div class="flex flex-wrap items-center gap-2 flex-shrink-0">
                            <label class="text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">{{ t('app.period') || 'Период' }}:</label>
                            <div class="flex items-center gap-2 flex-nowrap">
                                <UInput v-model="routeProgressStart" type="date" size="sm" class="w-32 sm:w-36" />
                                <span class="text-xs text-gray-400">—</span>
                                <UInput v-model="routeProgressEnd" type="date" size="sm" class="w-32 sm:w-36" />
                            </div>
                        </div>
                    </div>
                </div>

                <div v-if="routePassesLoading" class="flex items-center justify-center py-6">
                    <div class="flex flex-col items-center gap-2">
                        <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                        <p class="text-xs text-gray-500">{{ t('app.loading') || 'Loading...' }}</p>
                    </div>
                </div>
                <div v-else-if="routePassesError" class="flex items-center gap-2 text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
                    <UIcon name="i-heroicons-exclamation-circle" class="w-4 h-4 flex-shrink-0" />
                    <span class="text-sm">{{ routePassesError }}</span>
                </div>
                <div v-else-if="routeProgressRows.length === 0" class="text-center py-8">
                    <UIcon name="i-heroicons-users" class="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p class="text-sm text-gray-500">{{ t('app.route.progress.empty') || 'Нет данных по сотрудникам' }}</p>
                </div>
                <div v-else class="space-y-3">
                        <div 
                            v-for="row in routeProgressRows" 
                            :key="row.userId"
                            class="group relative rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 shadow-sm hover:shadow-md transition-all duration-200"
                        >
                            <div class="p-4">
                                <!-- User header -->
                                <div class="flex items-center gap-3 mb-4">
                                    <div class="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 text-base font-semibold flex-shrink-0">
                                        {{ row.username.substring(0, 2).toUpperCase() }}
                                    </div>
                                    <div class="flex-1 min-w-0">
                                        <h4 class="text-base font-semibold text-gray-900 dark:text-white truncate">{{ row.username }}</h4>
                                        <p class="text-xs text-gray-500 dark:text-gray-400 truncate">{{ row.email || row.userId }}</p>
                                    </div>
                                    <div 
                                        class="px-2.5 py-1 rounded-md text-xs font-medium border flex-shrink-0"
                                        :class="formatProgressStatus(row.lastStatus).color"
                                    >
                                        {{ formatProgressStatus(row.lastStatus).label }}
                                    </div>
                                </div>

                                <!-- Meta info -->
                                <div class="flex items-center gap-4 mb-3 text-xs text-gray-600 dark:text-gray-400">
                                    <div class="flex items-center gap-1.5">
                                        <UIcon name="i-heroicons-arrow-path" class="w-3.5 h-3.5" />
                                        <span class="font-medium">{{ row.completedCount + row.partialCount + row.violatedCount + row.pendingCount }}</span>
                                        <span>{{ t('app.route.passes') || 'прохождений' }}</span>
                                    </div>
                                    <span class="text-gray-300 dark:text-gray-600">•</span>
                                    <div class="flex items-center gap-1.5">
                                        <UIcon name="i-heroicons-calendar" class="w-3.5 h-3.5" />
                                        <span>{{ row.lastDate || (t('app.noData') || 'Нет данных') }}</span>
                                    </div>
                                </div>
                                
                                <!-- Progress stats -->
                                <div class="grid grid-cols-4 gap-2">
                                    <!-- Completed -->
                                    <div class="text-center bg-white dark:bg-gray-900 rounded-lg p-2 border border-gray-200 dark:border-gray-700">
                                        <div class="w-8 h-8 mx-auto rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-1.5">
                                            <UIcon name="i-heroicons-check-circle" class="w-4 h-4 text-green-600 dark:text-green-400" />
                                        </div>
                                        <div class="text-lg font-bold text-gray-900 dark:text-white">{{ row.completedCount }}</div>
                                        <div class="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{{ t('app.route.status.ok') || 'Успешно' }}</div>
                                    </div>
                                    
                                    <!-- Partial -->
                                    <div class="text-center bg-white dark:bg-gray-900 rounded-lg p-2 border border-gray-200 dark:border-gray-700">
                                        <div class="w-8 h-8 mx-auto rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center mb-1.5">
                                            <UIcon name="i-heroicons-exclamation-triangle" class="w-4 h-4 text-orange-600 dark:text-orange-400" />
                                        </div>
                                        <div class="text-lg font-bold text-gray-900 dark:text-white">{{ row.partialCount }}</div>
                                        <div class="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{{ t('app.route.status.partial') || 'Частично' }}</div>
                                    </div>
                                    
                                    <!-- Violated -->
                                    <div class="text-center bg-white dark:bg-gray-900 rounded-lg p-2 border border-gray-200 dark:border-gray-700">
                                        <div class="w-8 h-8 mx-auto rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-1.5">
                                            <UIcon name="i-heroicons-x-circle" class="w-4 h-4 text-red-600 dark:text-red-400" />
                                        </div>
                                        <div class="text-lg font-bold text-gray-900 dark:text-white">{{ row.violatedCount }}</div>
                                        <div class="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{{ t('app.route.status.violation') || 'Нарушения' }}</div>
                                    </div>
                                    
                                    <!-- Pending -->
                                    <div class="text-center bg-white dark:bg-gray-900 rounded-lg p-2 border border-gray-200 dark:border-gray-700">
                                        <div class="w-8 h-8 mx-auto rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center mb-1.5">
                                            <UIcon name="i-heroicons-clock" class="w-4 h-4 text-gray-600 dark:text-gray-400" />
                                        </div>
                                        <div class="text-lg font-bold text-gray-900 dark:text-white">{{ row.pendingCount }}</div>
                                        <div class="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{{ t('app.route.status.pending') || 'Не пройдено' }}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
            </div>
        </div>


        <!-- Desktop: horizontal card scroll (only show for attendance) -->
        <div v-if="!isRouteTab" class="hidden md:block overflow-x-auto whitespace-nowrap py-4 px-4 flex-shrink-0" ref="cardsScrollRef" data-tour="posts-list">
            <div class="inline-flex space-x-4 items-stretch">
                <template v-if="showSkeletons">
                    <div
                        v-for="i in 5"
                        :key="`skeleton-${i}`"
                        class="w-60 max-w-[90vw] sm:max-w-xs min-h-[100px] rounded-xl border border-gray-200 dark:border-gray-800 p-4 bg-white/60 dark:bg-gray-900/60 flex flex-col self-stretch"
                    >
                        <div class="flex items-center gap-2 mb-2">
                            <USkeleton class="h-5 w-3/4" />
                            <USkeleton class="h-5 w-16" />
                        </div>
                        <USkeleton class="h-4 w-5/6" />
                        <div class="flex-1"></div>
                        <div class="mt-1 h-5">
                            <USkeleton class="h-3 w-1/2" />
                        </div>
                    </div>
                </template>
                <template v-else>
                    <!-- "All" card - shows common stats, only if there are posts -->
                    <Card v-if="!isRouteTab && posts.length > 0" :post="{ id: '', title: t('app.allLocations') || 'All locations', description: t('app.allLocationsDesc') || 'Employee attendance across all locations' }" :selected="selectedPostId === ''" :can-delete="false"
                          @select="() => (selectedPostId = '')" />
                    
                    <div v-for="post in visiblePosts" :key="post.id">
                        <Card :post="post" :selected="post.id === selectedPostId" :can-delete="false"
                              @select="() => (selectedPostId = post.id)"
                              @edit="() => openEdit(post)" />
                    </div>
                    <button v-if="!isRouteTab" @click="isCreateOpen = true"
                        data-tour="create-post-btn"
                        class="bg-gradient-to-r from-blue-400 to-blue-600 dark:from-blue-900 dark:to-blue-700 text-white shadow-lg p-4 rounded-xl w-60 min-h-[100px] flex items-center justify-center cursor-pointer hover:shadow-xl hover:from-blue-500 hover:to-blue-700 dark:hover:from-blue-800 dark:hover:to-blue-600 transition-all duration-200 flex-shrink-0">
                        {{ t('app.atraceAddLocation') }}
                    </button>
                    <!-- Loading more indicator -->
                    <div v-if="loadingMore" class="flex items-center justify-center w-20 text-gray-500">…</div>
                    <!-- Sentinel element to trigger infinite scroll -->
                    <div ref="cardsSentinelRef" class="w-1 h-1"></div>
                </template>
            </div>
        </div>

        <!-- Mobile: dropdown selector (only show for attendance) -->
        <div v-if="!isRouteTab" class="md:hidden px-4 py-4 flex-shrink-0" data-tour="posts-list-mobile">
            <template v-if="showSkeletons">
                <div class="flex gap-2 items-center">
                    <USkeleton class="h-4 w-20" />
                    <USkeleton class="h-9 flex-1" />
                    <USkeleton class="h-9 w-10" />
                </div>
            </template>
            <template v-else>
                <div class="flex gap-2 items-center">
                    <label class="text-sm font-medium whitespace-nowrap">{{ t('app.location') || 'Локация' }}:</label>
                    <USelectMenu
                        v-model="selectedPostIdForMenu"
                        :options="[
                            ...(!isRouteTab && posts.length > 0 ? [{ value: '', label: t('app.allLocations') || 'All locations' }] : []),
                            ...visiblePosts.filter(p => p.title && p.title.trim()).map(p => {
                              const parts = [p.title.trim()];
                              if (p.location?.city?.trim()) parts.push(p.location.city);
                              if (p.location?.address?.trim()) parts.push(p.location.address);
                              return { value: p.id, label: parts.join(' — ') };
                            })
                        ]"
                        value-attribute="value"
                        class="flex-1"
                        :ui="{ menu: { popper: { base: 'z-[9999]' } } }"
                    />
                    <UButton 
                        data-tour="create-post-btn-mobile"
                        icon="lucide:plus" 
                        size="sm" 
                        color="primary" 
                        variant="soft"
                        v-if="!isRouteTab"
                        @click="isCreateOpen = true"
                    />
                </div>
            </template>
        </div>

        <div v-if="!isRouteTab" class="hidden md:flex justify-between items-center mb-5 mt-5 px-4 flex-shrink-0">
            <div class="text-left">
                <h2 class="text-lg font-medium">
                    {{ t('app.attendance') }} —
                    {{ selectedPostId === '' ? (t('app.allLocations') || 'All locations') : selectedPostTitle }}
                </h2>
                <span v-if="selectedPostId !== ''">{{ selectedPostLocationLine }}</span>
            </div>

            <!-- Search and filter buttons removed -->
        </div>

        <div v-if="selectedPostId !== null && !isRouteTab" class="flex-1 px-4 pb-safe-or-4">
            <AttendanceStatsTable :post-id="selectedPostId" :ready="!loading && !error" />
        </div>
        <div v-else-if="!isRouteTab" class="flex-1 h-full px-4 pb-safe-or-4 flex flex-col items-center justify-center">
            <div class="max-w-sm w-full bg-white dark:bg-gray-900 rounded-2xl shadow-lg p-6 flex flex-col items-center border border-gray-200 dark:border-gray-800">
                <div class="mb-3 flex flex-col items-center">
                    <UIcon name="i-heroicons-map-pin" class="w-12 h-12 text-blue-400 dark:text-blue-300 mb-2" />
                    <h2 class="text-xl font-bold text-center mb-1 text-gray-900 dark:text-white">
                        {{ t('app.noPostsTitle') || 'No locations yet' }}
                    </h2>
                    <p class="text-sm text-gray-600 dark:text-gray-400 text-center mb-3">
                        {{ t('app.noPostsDesc') || 'Add your first location to start tracking attendance.' }}
                    </p>
                </div>
                <UButton
                    data-tour="create-post-btn-empty"
                    color="primary"
                    size="md"
                    class="w-full"
                    @click="isCreateOpen = true"
                >
                    {{ t('app.atraceAddLocation') || 'Add Location' }}
                </UButton>
            </div>
        </div>
    </div>

    <!-- Create Route Modal -->
    <RouteModal
        v-model="isRouteCreateOpen"
        :title="t('app.route.titleCreate') || 'Create Route'"
        :show-edit-warning="false"
        :edit-warning="''"
        :name-label="t('app.route.form.title') || 'Название'"
        :name-placeholder="t('app.route.form.titlePlaceholder') || 'Маршрут'"
        :posts-label="t('app.route.form.posts') || 'Посты маршрута'"
        :posts-hint="t('app.route.form.postsHint') || 'Добавьте посты в нужном порядке'"
        :select-placeholder="t('app.select.location') || 'Выберите пост'"
        :empty-text="t('app.route.form.noPostsSelected') || 'Посты не выбраны'"
        :cancel-label="t('common.cancel') || 'Cancel'"
        :save-label="t('common.save') || 'Save'"
        v-model:route-title="routeCreateTitle"
        v-model:selected-post-id="routeCreatePostId"
        v-model:selected-post-ids="routeCreatePostIds"
        :post-options="routeCreatePostOptions"
        :get-post-label="getRoutePostLabel"
        :error="routeCreateError"
        :saving="routeCreateSaving"
        @save="saveNewRoute"
    />

    <!-- Create Post Modal -->
    <CreatePostModal v-model="isCreateOpen" :form="form" @submit="handleCreate" />

    <!-- Edit Post Modal -->
    <EditPostModal
      v-model="isEditOpen"
      :form="editForm"
      :editingPost="editingPost"
      @save="handleEditSave"
      @delete="() => { if (editingPost) handleDelete(editingPost, { skipConfirm: false }) }"
    />

    <UModal v-model="isLimitModalOpen" :ui="{ width: 'sm:max-w-md' }">
        <UCard>
            <template #header>
                <div class="flex items-center justify-between">
                    <h3 class="text-base font-semibold text-gray-900 dark:text-white">
                        {{ t('app.notification') || 'Notification' }}
                    </h3>
                    <UButton color="primary" variant="ghost" icon="lucide:x" class="-my-1" @click="isLimitModalOpen = false" />
                </div>
            </template>
            <div class="text-sm text-gray-700 dark:text-gray-200">
                {{ limitErrorMessage || (t('atrace.members.limitReached') || 'Limit reached. Please upgrade your plan.') }}
            </div>
            <template #footer>
                <div class="flex justify-end gap-2">
                    <UButton color="primary" variant="soft" @click="isLimitModalOpen = false">{{ t('common.cancel') }}</UButton>
                    <UButton color="amber" icon="lucide:star" :to="`/${nsSlug}/atrace/plans`">
                        {{ t('app.upgradePlan') || 'Upgrade Plan' }}
                    </UButton>
                </div>
            </template>
        </UCard>
    </UModal>
</template>

<style scoped>
.pb-safe-or-4 {
  padding-bottom: max(env(safe-area-inset-bottom), 1rem);
}

/* Custom scrollbar for timeline */
.scrollbar-thin {
  scrollbar-width: thin;
  scrollbar-color: rgb(209, 213, 219) transparent;
}

.dark .scrollbar-thin {
  scrollbar-color: rgb(55, 65, 81) transparent;
}

.scrollbar-thin::-webkit-scrollbar {
  height: 6px;
}

.scrollbar-thin::-webkit-scrollbar-track {
  background: transparent;
}

.scrollbar-thin::-webkit-scrollbar-thumb {
  background-color: rgb(209, 213, 219);
  border-radius: 3px;
}

.dark .scrollbar-thin::-webkit-scrollbar-thumb {
  background-color: rgb(55, 65, 81);
}

.scrollbar-thin::-webkit-scrollbar-thumb:hover {
  background-color: rgb(156, 163, 175);
}

.dark .scrollbar-thin::-webkit-scrollbar-thumb:hover {
  background-color: rgb(75, 85, 99);
}
</style>