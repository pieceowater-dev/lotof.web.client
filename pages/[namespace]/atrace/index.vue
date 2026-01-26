<script lang="ts" setup>
import Card from "@/components/Card.vue";
import AttendanceStatsTable from '@/components/atrace/AttendanceStatsTable.vue';
import CreatePostModal from "@/components/atrace/CreatePostModal.vue";
import EditPostModal from "@/components/atrace/EditPostModal.vue";
import FilterModal from "@/components/atrace/FilterModal.vue";
import { useI18n } from '@/composables/useI18n';
import { CookieKeys, dynamicLS } from '@/utils/storageKeys';
import { useAtraceToken } from '@/composables/useAtraceToken';
import { getErrorMessage } from '@/utils/types/errors';
import { getBrowserTimezone } from '@/utils/timezones';
const { t } = useI18n();

// data
type Post = {
    id: string;
    title: string;
    description?: string | null;
    location?: { comment?: string | null; country?: string | null; city?: string | null; address?: string | null; latitude?: number | null; longitude?: number | null; timezone?: string | null } | null;
    phrase?: string;
};

const posts = ref<Post[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
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

// Persistence helpers (prefix everything related to atrace with 'atrace-')
const selectedStorageKey = computed(() => dynamicLS.atraceSelectedPostId(nsSlug.value));
function loadStoredSelection() {
    if (process.client) {
        try {
            const v = localStorage.getItem(selectedStorageKey.value);
            // Preserve empty string ("All"), only null means no selection
            selectedPostId.value = v === null ? null : v;
        } catch {}
    }
}
watch(selectedPostId, (val) => {
    if (!process.client) return;
    try {
        // Store both normal IDs and empty string ("All"); remove only for null
        if (val !== null) localStorage.setItem(selectedStorageKey.value, val);
        else localStorage.removeItem(selectedStorageKey.value);
    } catch {}
});

const isOpen = ref(false)
const isFilterOpen = ref(false)
const isCreateOpen = ref(false)
const isEditOpen = ref(false)
const editingPost = ref<Post | null>(null)

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

const router = useRouter();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);

const { ensure: ensureAtraceToken } = useAtraceToken();

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
        const lengthMap: Record<PaginationLength, 'TEN' | 'TWENTY_FIVE' | 'FIFTY' | 'HUNDRED'> = {
            [PaginationLength.TEN]: 'TEN',
            [PaginationLength.FIFTEEN]: 'TEN',
            [PaginationLength.TWENTY]: 'TWENTY_FIVE',
            [PaginationLength.TWENTY_FIVE]: 'TWENTY_FIVE',
            [PaginationLength.THIRTY]: 'FIFTY',
            [PaginationLength.THIRTY_FIVE]: 'FIFTY',
            [PaginationLength.FORTY]: 'FIFTY',
            [PaginationLength.FORTY_FIVE]: 'FIFTY',
            [PaginationLength.FIFTY]: 'FIFTY',
            [PaginationLength.FIFTY_FIVE]: 'HUNDRED',
            [PaginationLength.SIXTY]: 'HUNDRED',
            [PaginationLength.SIXTY_FIVE]: 'HUNDRED',
            [PaginationLength.SEVENTY]: 'HUNDRED',
            [PaginationLength.SEVENTY_FIVE]: 'HUNDRED',
            [PaginationLength.EIGHTY]: 'HUNDRED',
            [PaginationLength.EIGHTY_FIVE]: 'HUNDRED',
            [PaginationLength.NINETY]: 'HUNDRED',
            [PaginationLength.NINETY_FIVE]: 'HUNDRED',
            [PaginationLength.ONE_HUNDRED]: 'HUNDRED',
        };
        const res = await atracePostsList(atraceToken, nsSlug.value, { page: page.value, length: lengthMap[pageLength.value] });
        posts.value = [...res.posts].sort((a, b) => (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' }));
        totalCount.value = res.count || 0;
        // Only set default if selectedPostId is explicitly null, preserve empty string ("All")
        if (selectedPostId.value === null || (selectedPostId.value !== '' && !posts.value.some(p => p.id === selectedPostId.value))) {
            selectedPostId.value = posts.value[0]?.id ?? null;
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
        const lengthMap: Record<PaginationLength, 'TEN' | 'TWENTY_FIVE' | 'FIFTY' | 'HUNDRED'> = {
            [PaginationLength.TEN]: 'TEN',
            [PaginationLength.FIFTEEN]: 'TEN',
            [PaginationLength.TWENTY]: 'TWENTY_FIVE',
            [PaginationLength.TWENTY_FIVE]: 'TWENTY_FIVE',
            [PaginationLength.THIRTY]: 'FIFTY',
            [PaginationLength.THIRTY_FIVE]: 'FIFTY',
            [PaginationLength.FORTY]: 'FIFTY',
            [PaginationLength.FORTY_FIVE]: 'FIFTY',
            [PaginationLength.FIFTY]: 'FIFTY',
            [PaginationLength.FIFTY_FIVE]: 'HUNDRED',
            [PaginationLength.SIXTY]: 'HUNDRED',
            [PaginationLength.SIXTY_FIVE]: 'HUNDRED',
            [PaginationLength.SEVENTY]: 'HUNDRED',
            [PaginationLength.SEVENTY_FIVE]: 'HUNDRED',
            [PaginationLength.EIGHTY]: 'HUNDRED',
            [PaginationLength.EIGHTY_FIVE]: 'HUNDRED',
            [PaginationLength.NINETY]: 'HUNDRED',
            [PaginationLength.NINETY_FIVE]: 'HUNDRED',
            [PaginationLength.ONE_HUNDRED]: 'HUNDRED',
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
        // noop; errors are logged in client
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
    // Load previously selected post for this namespace (if any)
    loadStoredSelection();
    await loadPosts();
    setupCardsObserver();
});

watch(() => nsSlug.value, async (n, o) => {
    if (n && n !== o) {
        // Load selection tied to the new namespace before fetching posts
        loadStoredSelection();
        await loadPosts();
        // Recreate observer on namespace change (DOM refs may stay but data changed)
        setupCardsObserver();
    }
});

onBeforeUnmount(() => {
    if (cardsObserver) {
        try { cardsObserver.disconnect(); } catch {}
        cardsObserver = null;
    }
});
</script>

<template>
    

    <FilterModal v-model="isFilterOpen" />

    <div class="h-full flex flex-col overflow-hidden">
        <div class="flex justify-between items-center mb-4 mt-4 px-4 flex-shrink-0">
            <div class="text-left">
                <h1 class="text-2xl font-semibold">{{ t('app.atraceTitle') }}</h1>
                <span class="text-sm text-gray-600 dark:text-gray-400">{{ t('app.atraceSubtitle') }}</span>
            </div>
            <div>
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

        <!-- Desktop: horizontal card scroll -->
        <div class="hidden md:block overflow-x-auto whitespace-nowrap py-4 px-4 flex-shrink-0" ref="cardsScrollRef">
            <div class="inline-flex space-x-4 items-stretch">
                <div v-if="loading" class="text-gray-500">{{ t('app.loading') }}</div>
                <div v-else-if="error" class="text-red-500">{{ error }}</div>
                <template v-else>
                    <!-- "All" card - shows common stats, only if there are posts -->
                    <Card v-if="posts.length > 0" :post="{ id: '', title: t('app.allLocations') || 'All locations', description: t('app.allLocationsDesc') || 'Employee attendance across all locations' }" :selected="selectedPostId === ''" :can-delete="false"
                          @select="() => (selectedPostId = '')" />
                    
                    <div v-for="post in posts" :key="post.id">
                        <Card :post="post" :selected="post.id === selectedPostId" :can-delete="false"
                              @select="() => (selectedPostId = post.id)"
                              @edit="() => openEdit(post)" />
                    </div>
                    <button @click="isCreateOpen = true"
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

        <!-- Mobile: dropdown selector -->
        <div class="md:hidden px-4 py-4 flex-shrink-0">
            <div v-if="loading" class="text-gray-500">{{ t('app.loading') }}</div>
            <div v-else-if="error" class="text-red-500">{{ error }}</div>
            <template v-else>
                <div class="flex gap-2 items-center">
                    <label class="text-sm font-medium whitespace-nowrap">{{ t('app.location') || 'Локация' }}:</label>
                    <USelectMenu
                        v-model="selectedPostIdForMenu"
                        :options="[
                            ...(posts.length > 0 ? [{ value: '', label: t('app.allLocations') || 'All locations' }] : []),
                            ...posts.filter(p => p.title && p.title.trim()).map(p => {
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
                        icon="lucide:plus" 
                        size="sm" 
                        color="primary" 
                        variant="soft"
                        @click="isCreateOpen = true"
                    />
                </div>
            </template>
        </div>

        <div class="hidden md:flex justify-between items-center mb-5 mt-5 px-4 flex-shrink-0">
            <div class="text-left">
                <h2 class="text-lg font-medium">{{ t('app.attendance') }} — {{ selectedPostId === '' ? (t('app.allLocations') || 'All locations') : selectedPostTitle }}</h2>
                <span v-if="selectedPostId !== ''">{{ selectedPostLocationLine }}</span>
            </div>

            <!-- Search and filter buttons removed -->
        </div>

        <div v-if="selectedPostId !== null" class="flex-1 min-h-0 px-4 pb-safe-or-4 overflow-hidden">
                <AttendanceStatsTable :post-id="selectedPostId" />
        </div>
        <div v-else class="flex-1 h-full px-4 pb-safe-or-4 flex flex-col items-center justify-center">
            <div class="max-w-md w-full bg-white dark:bg-gray-900 rounded-3xl shadow-2xl p-8 flex flex-col items-center border border-blue-200 dark:border-gray-800">
                <div class="mb-4 flex flex-col items-center">
                    <UIcon name="i-heroicons-map-pin" class="w-16 h-16 text-blue-400 dark:text-blue-300 mb-2" />
                    <h2 class="text-2xl font-extrabold text-center mb-1 text-blue-900 dark:text-white">
                        {{ t('app.noPostsTitle') || 'No locations yet' }}
                    </h2>
                    <p class="text-base text-gray-700 dark:text-gray-200 text-center mb-4">
                        {{ t('app.noPostsDesc') || 'Add your first location to start tracking attendance.' }}
                    </p>
                </div>
                <UButton color="primary" size="lg" class="w-full py-3 text-lg font-semibold" @click="isCreateOpen = true">
                    {{ t('app.atraceAddLocation') || 'Add Location' }}
                </UButton>
            </div>
        </div>
    </div>

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
</template>

<style scoped>
.pb-safe-or-4 {
  padding-bottom: max(env(safe-area-inset-bottom), 1rem);
}
</style>