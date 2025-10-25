<script lang="ts" setup>
import Card from "@/components/Card.vue";
import { useI18n } from '@/composables/useI18n';
import { CookieKeys, dynamicLS } from '@/utils/storageKeys';
const { t } = useI18n();

// data
type Post = {
    id: string;
    title: string;
    description?: string | null;
    location?: { comment?: string | null; country?: string | null; city?: string | null; address?: string | null; latitude?: number | null; longitude?: number | null } | null;
    phrase?: string;
};

const posts = ref<Post[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
// Pagination state for infinite scroll
const page = ref(1);
const pageLength = ref<'TEN' | 'TWENTY_FIVE' | 'FIFTY' | 'HUNDRED'>('TEN');
const totalCount = ref(0);
const loadingMore = ref(false);
const hasMore = computed(() => posts.value.length < totalCount.value);
// Horizontal scroll container and sentinel for IntersectionObserver
const cardsScrollRef = ref<HTMLElement | null>(null);
const cardsSentinelRef = ref<HTMLElement | null>(null);
let cardsObserver: IntersectionObserver | null = null;
const selectedPostId = ref<string | null>(null);

// Currently selected post and its display helpers
const selectedPost = computed(() => posts.value.find(p => p.id === selectedPostId.value) || null);
const selectedPostTitle = computed(() => selectedPost.value?.title || '');
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
            selectedPostId.value = v || null;
        } catch {}
    }
}
watch(selectedPostId, (val) => {
    if (!process.client) return;
    try {
        if (val) localStorage.setItem(selectedStorageKey.value, val);
        else localStorage.removeItem(selectedStorageKey.value);
    } catch {}
});

const isOpen = ref(false)
const isFilterOpen = ref(false)
const isCreateOpen = ref(false)
const isEditOpen = ref(false)
const editingPost = ref<Post | null>(null)
const isDeleteConfirmOpen = ref(false)

// Create form state
const form = reactive<{ title: string; description?: string; location: { address?: string; city?: string; country?: string; comment?: string; latitude?: number | '' ; longitude?: number | '' }, pin: string }>(
        { title: '', description: '', location: { address: '', city: '', country: '', comment: '', latitude: '', longitude: '' }, pin: '' }
);

function generatePin() {
    // 6-digit random PIN, leading zeros allowed
    form.pin = String(Math.floor(100000 + Math.random() * 900000)).slice(0, 6);
}
function copyPin() {
    if (process.client && form.pin) {
        navigator.clipboard.writeText(form.pin);
        pinCopied.value = true;
        setTimeout(() => { pinCopied.value = false; }, 1500);
    }
}
const pinCopied = ref(false);

// Edit form state
const editForm = reactive<{ title: string; description?: string; location: { address?: string; city?: string; country?: string; comment?: string; latitude?: number | '' ; longitude?: number | '' }, pin: string }>(
    { title: '', description: '', location: { address: '', city: '', country: '', comment: '', latitude: '', longitude: '' }, pin: '' }
);
const editPinCopied = ref(false);
function generateEditPin() {
    editForm.pin = String(Math.floor(100000 + Math.random() * 900000)).slice(0, 6);
}
function copyEditPin() {
    if (typeof window !== 'undefined' && editForm.pin) {
        window.navigator.clipboard.writeText(editForm.pin);
        editPinCopied.value = true;
        setTimeout(() => { editPinCopied.value = false; }, 1500);
    }
}

const router = useRouter();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);

async function ensureAtraceToken(): Promise<string | null> {
    const cookie = useCookie<string | null>(CookieKeys.ATRACE_TOKEN, { path: '/' });
    const tok = cookie.value;
    if (!tok) return null;
    try {
        const parts = tok.split('.');
        if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1]));
            const expSec = payload.exp as number | undefined;
            if (expSec && Date.now() / 1000 >= expSec) {
                cookie.value = null;
                return null;
            }
        }
    } catch {}
    return cookie.value;
}

async function loadPosts() {
    // Initial load (page 1)
    loading.value = true;
    error.value = null;
    try {
        const atraceToken = await ensureAtraceToken();
        if (!atraceToken) {
            router.push('/');
            return;
        }
        const { atracePostsList } = await import('@/api/atrace/post/list');
        page.value = 1;
        const res = await atracePostsList(atraceToken, nsSlug.value, { page: page.value, length: pageLength.value });
        // Always keep client-side ASC title order as a safety net (should already be sorted from server)
        posts.value = [...res.posts].sort((a, b) => (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' }));
        totalCount.value = res.count || 0;
        // Ensure a single selection (radio-like)
        if (!selectedPostId.value || !posts.value.some(p => p.id === selectedPostId.value)) {
            selectedPostId.value = posts.value[0]?.id ?? null;
        }
    } catch (e: any) {
        error.value = e?.message || 'Failed to load posts';
    } finally {
        loading.value = false;
    }
}

async function loadMorePosts() {
    if (loading.value || loadingMore.value) return;
    if (!hasMore.value) return;
    loadingMore.value = true;
    try {
        const atraceToken = await ensureAtraceToken();
        if (!atraceToken) return;
        const { atracePostsList } = await import('@/api/atrace/post/list');
        const nextPage = page.value + 1;
        const res = await atracePostsList(atraceToken, nsSlug.value, { page: nextPage, length: pageLength.value });
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
    const atraceToken = await ensureAtraceToken();
    if (!atraceToken) return router.push('/');
    try {
        const { atraceCreatePost } = await import('@/api/atrace/post/create');
        const payload: any = { title: form.title };
        if (form.description) payload.description = form.description;
        // send only filled location fields
        const loc: any = {};
        for (const k of ['address','city','country','comment','latitude','longitude'] as const) {
            const v = (form.location as any)[k];
            if (v !== undefined && v !== null && v !== '') loc[k] = v;
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
    form.location = { address: '', city: '', country: '', comment: '', latitude: '', longitude: '' };
    form.pin = '';
    } catch (e) {
        // noop; errors are logged in client
    }
}

async function handleDelete(p: Post, opts?: { skipConfirm?: boolean }) {
    if (!opts?.skipConfirm) {
        const ok = confirm(t('common.confirmDelete') || 'Delete?');
        if (!ok) return;
    }
    const atraceToken = await ensureAtraceToken();
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
    };
    editForm.pin = p.phrase || '';
    isEditOpen.value = true;
}

async function handleEditSave() {
    if (!editingPost.value) return;
    const atraceToken = await ensureAtraceToken();
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
    // Добавляем phrase если PIN заполнен
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
    // Always include string fields (allow null to explicitly clear)
    const c = norm(editForm.location.comment);
    const cn = norm(editForm.location.country);
    const ct = norm(editForm.location.city);
    const ad = norm(editForm.location.address);
    if (c && c !== '') loc.comment = c;
    if (cn && cn !== '') loc.country = cn;
    if (ct && ct !== '') loc.city = ct;
    if (ad && ad !== '') loc.address = ad;
    // Include lat/lon only when we have both valid numbers; omit otherwise to avoid 422
    if (lat !== null && lat !== 0 && lon !== null && lon !== 0) {
        loc.latitude = lat as number;
        loc.longitude = lon as number;
    }
    // Заглушки для необходимых полей location
    if (Object.keys(loc).length === 0) {
        payload.location = {
            comment: 'placeholder',
            country: 'placeholder',
            city: 'placeholder',
            address: 'placeholder',
            latitude: 1,
            longitude: 1
        };
    } else {
        payload.location = loc;
    }

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
    const tok = await ensureAtraceToken();
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
    

    <UModal v-model="isFilterOpen">
        <UCard :ui="{ ring: '', divide: 'divide-y divide-gray-100 dark:divide-gray-800' }">
            <template #header>
                <div class="flex items-center justify-between">
                    <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">
                        Filter
                    </h3>
                    <UButton color="gray" variant="ghost" icon="lucide:x" class="-my-1"
                        @click="isFilterOpen = false" />
                </div>
            </template>

            <Placeholder class="h-64" />

            <template #footer>
                <div class="flex justify-between gap-2">
                    <UButton icon="lucide:check" size="sm" color="primary" variant="solid"
                        label="Apply" :trailing="false" />
                    <UButton icon="lucide:x" size="sm" color="primary" variant="outline"
                        label="Cancel" :trailing="false" />
                </div>
            </template>
        </UCard>
    </UModal>

    <div class="h-screen flex flex-col">
        <div class="flex justify-between items-center mb-5 mt-5 px-4">
            <div class="text-left">
                <h1 class="text-3xl font-bold">{{ t('app.atraceTitle') }}</h1>
                <span>{{ t('app.atraceSubtitle') }}</span>
            </div>
        </div>

        <div class="overflow-x-auto whitespace-nowrap py-4 px-4" ref="cardsScrollRef">
            <div class="flex space-x-4 items-stretch">
                <div v-if="loading" class="text-gray-500">Loading…</div>
                <div v-else-if="error" class="text-red-500">{{ error }}</div>
                <div v-else class="flex space-x-4">
                    <div v-for="post in posts" :key="post.id">
                        <Card :post="post" :selected="post.id === selectedPostId" :can-delete="false"
                              @select="() => (selectedPostId = post.id)"
                              @edit="() => openEdit(post)" />
                    </div>
                    <button @click="isCreateOpen = true"
                        class="bg-blue-400 dark:bg-blue-900 text-white shadow-md p-4 rounded-xl w-60 min-h-[100px] flex items-center justify-center cursor-pointer hover:bg-blue-500 dark:hover:bg-blue-800 flex-shrink-0">
                        {{ t('app.atraceAddLocation') }}
                    </button>
                    <!-- Loading more indicator -->
                    <div v-if="loadingMore" class="flex items-center justify-center w-20 text-gray-500">…</div>
                    <!-- Sentinel element to trigger infinite scroll -->
                    <div ref="cardsSentinelRef" class="w-1 h-1"></div>
                </div>
            </div>
        </div>

        <div class="flex justify-between items-center mb-5 mt-5 px-4">
            <div class="text-left">
                <h2 class="text-2xl font-bold">{{ t('app.attendance') }} — {{ selectedPostTitle }}</h2>
                <span>{{ selectedPostLocationLine }}</span>
            </div>

            <!-- Search and filter buttons removed -->
        </div>



        <div v-if="posts.length > 0 && selectedPostId" class="flex-1 h-full px-4 pb-4 flex flex-col overflow-y-auto">
            <Table :post-id="selectedPostId" />
        </div>
        <div v-else class="flex-1 h-full px-4 pb-4 flex flex-col items-center justify-center">
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
    <UModal v-model="isCreateOpen">
        <UCard :ui="{ ring: '', divide: 'divide-y divide-gray-100 dark:divide-gray-800' }">
            <template #header>
                <div class="flex items-center justify-between">
                    <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">
                        {{ t('app.atraceAddLocation') }}
                    </h3>
                    <UButton color="gray" variant="ghost" icon="lucide:x" class="-my-1" @click="isCreateOpen = false" />
                </div>
            </template>

            <div class="space-y-3">
                <UFormGroup :label="t('common.title')">
                    <UInput v-model="form.title" :placeholder="t('common.title')" />
                </UFormGroup>
                <UFormGroup :label="t('common.description')">
                    <UTextarea v-model="form.description" :placeholder="t('common.description')" />
                </UFormGroup>
                <USeparator />
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <UFormGroup :label="t('common.address')">
                        <UInput v-model="form.location.address" :placeholder="t('common.address')" />
                    </UFormGroup>
                    <UFormGroup :label="t('common.city')">
                        <UInput v-model="form.location.city" :placeholder="t('common.city')" />
                    </UFormGroup>
                </div>
                <USeparator />
                            <UFormGroup label="PIN (6 digits)">
                                <div class="flex gap-2 items-center">
                                    <UInput v-model="form.pin" maxlength="6" placeholder="******" class="w-32" data-testid="create-pin-input" />
                                    <UButton size="xs" color="primary" @click="() => { form.pin = String(Math.floor(100000 + Math.random() * 900000)).slice(0, 6); }">Generate</UButton>
                                </div>
                                <div class="text-xs text-yellow-600 mt-1">Save this PIN securely. It will be required to access the public post page and generate QR codes. Treat it like a password. <b>It cannot be recovered if lost!</b></div>
                            </UFormGroup>
            </div>

            <template #footer>
                <div class="flex justify-end gap-2">
                    <UButton icon="lucide:x" color="gray" variant="ghost" @click="isCreateOpen = false">{{ t('common.cancel') || 'Cancel' }}</UButton>
                    <UButton icon="lucide:check" color="primary" :disabled="!form.title || String(form.pin).length !== 6" @click="handleCreate">{{ t('common.create') || 'Create' }}</UButton>
                </div>
            </template>
        </UCard>
    </UModal>

    <!-- Edit Post Modal -->
    <UModal v-model="isEditOpen">
        <UCard :ui="{ ring: '', divide: 'divide-y divide-gray-100 dark:divide-gray-800' }">
            <template #header>
                <div class="flex items-center justify-between">
                    <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">
                        {{ t('common.edit') || 'Edit location' }}
                    </h3>
                    <UButton color="gray" variant="ghost" icon="lucide:x" class="-my-1" @click="isEditOpen = false" />
                </div>
            </template>

            <div class="space-y-3">
                <UFormGroup :label="t('common.title')">
                    <UInput v-model="editForm.title" :placeholder="t('common.title')" />
                </UFormGroup>
                <UFormGroup :label="t('common.description')">
                    <UTextarea v-model="editForm.description" :placeholder="t('common.description')" />
                </UFormGroup>
                <USeparator />
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <UFormGroup :label="t('common.address')">
                        <UInput v-model="editForm.location.address" :placeholder="t('common.address')" />
                    </UFormGroup>
                    <UFormGroup :label="t('common.city')">
                        <UInput v-model="editForm.location.city" :placeholder="t('common.city')" />
                    </UFormGroup>
                </div>

                <USeparator />

                                <UFormGroup label="PIN (6 digits)">
                                    <div class="flex gap-2 items-center">
                                        <UInput v-model="editForm.pin" maxlength="6" placeholder="******" class="w-32" data-testid="edit-pin-input" />
                                        <UButton size="xs" color="primary" @click="generateEditPin">Generate</UButton>
                                        <UButton size="xs" color="gray" variant="outline" @click="copyEditPin" :disabled="!editForm.pin">
                                            <span v-if="!editPinCopied">Copy</span>
                                            <span v-else>Copied!</span>
                                        </UButton>
                                    </div>
                                    <div class="text-xs text-yellow-600 mt-1">Save this PIN securely. It will be required to access the public post page and generate QR codes. Treat it like a password. <b>It cannot be recovered if lost!</b></div>
                                </UFormGroup>
            </div>

            <template #footer>
                <div class="flex items-center justify-between gap-2">
                    <!-- Delete with confirmation popover -->
                    <UPopover v-model="isDeleteConfirmOpen" :popper="{ placement: 'top-start' }">
                        <UButton color="red" variant="outline" icon="lucide:trash-2"
                                 :disabled="!editingPost"
                        >{{ t('common.delete') || 'Delete' }}</UButton>
                        <template #panel>
                            <div class="p-3 max-w-xs">
                                <p class="text-sm mb-3">{{ t('common.confirmDelete') || 'Delete?' }}</p>
                                <div class="flex gap-2 justify-end">
                                    <UButton color="gray" variant="ghost" @click="isDeleteConfirmOpen = false">{{ t('common.cancel') || 'Cancel' }}</UButton>
                                    <UButton color="red" variant="solid" icon="lucide:trash-2"
                                             @click="() => { if (editingPost) handleDelete(editingPost, { skipConfirm: true }); isDeleteConfirmOpen = false; }"
                                    >{{ t('common.delete') || 'Delete' }}</UButton>
                                </div>
                            </div>
                        </template>
                    </UPopover>

                    <div class="flex justify-end gap-2">
                        <UButton icon="lucide:x" color="gray" variant="ghost" @click="isEditOpen = false">{{ t('common.cancel') || 'Cancel' }}</UButton>
                        <UButton icon="lucide:check" color="primary" :disabled="!editForm.title" @click="handleEditSave">{{ t('common.save') || 'Save' }}</UButton>
                    </div>
                </div>
            </template>
        </UCard>
    </UModal>
</template>