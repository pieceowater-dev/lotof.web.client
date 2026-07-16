<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { useMenuToken } from '@/composables/useMenuToken';
import { logError } from '@/utils/logger';
import { getErrorMessage } from '@/utils/types/errors';
import PromoBannerModal from '@/components/menu/PromoBannerModal.vue';
import type { MenuPromoBanner } from '@/api/menu/promobanner/list';

const { t } = useI18n();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);

const banners = ref<MenuPromoBanner[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

const isModalOpen = ref(false);
const editingBanner = ref<MenuPromoBanner | null>(null);
const saving = ref(false);

async function getToken(): Promise<string> {
  const { current } = useMenuToken();
  const menuToken = current();
  if (!menuToken) throw new Error('No menu token');
  return menuToken;
}

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const menuToken = await getToken();
    const { menuPromoBannersList } = await import('@/api/menu/promobanner/list');
    const res = await menuPromoBannersList(menuToken, nsSlug.value);
    banners.value = res.banners;
  } catch (e) {
    logError('[menu/settings/banners] load failed', e);
    error.value = getErrorMessage(e) || 'Failed to load banners';
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  editingBanner.value = null;
  isModalOpen.value = true;
}

function openEdit(b: MenuPromoBanner) {
  editingBanner.value = b;
  isModalOpen.value = true;
}

async function handleSubmit(payload: Record<string, any>) {
  saving.value = true;
  try {
    const menuToken = await getToken();
    if (editingBanner.value) {
      const { menuUpdatePromoBanner } = await import('@/api/menu/promobanner/update');
      const updated = await menuUpdatePromoBanner(menuToken, nsSlug.value, { id: editingBanner.value.id, ...payload });
      const idx = banners.value.findIndex((b) => b.id === updated.id);
      if (idx !== -1) banners.value[idx] = updated;
      useToast().add({ title: t('menu.bannerUpdated') || 'Banner updated', color: 'primary' });
    } else {
      const { menuCreatePromoBanner } = await import('@/api/menu/promobanner/create');
      const created = await menuCreatePromoBanner(menuToken, nsSlug.value, payload as any);
      banners.value = [...banners.value, created];
      useToast().add({ title: t('menu.bannerCreated') || 'Banner created', color: 'primary' });
    }
    isModalOpen.value = false;
  } catch (e) {
    logError('[menu/settings/banners] save failed', e);
    useToast().add({ title: getErrorMessage(e) || 'Failed to save banner', color: 'red' });
  } finally {
    saving.value = false;
  }
}

async function handleDelete(b: MenuPromoBanner) {
  if (process.client && !window.confirm(t('menu.confirmDeleteBanner') || 'Delete this banner?')) return;
  try {
    const menuToken = await getToken();
    const { menuDeletePromoBanner } = await import('@/api/menu/promobanner/delete');
    await menuDeletePromoBanner(menuToken, nsSlug.value, b.id);
    banners.value = banners.value.filter((x) => x.id !== b.id);
    useToast().add({ title: t('menu.bannerDeleted') || 'Banner deleted', color: 'primary' });
  } catch (e) {
    logError('[menu/settings/banners] delete failed', e);
    useToast().add({ title: getErrorMessage(e) || 'Failed to delete banner', color: 'red' });
  }
}

onMounted(load);
</script>

<template>
  <div class="h-full flex flex-col min-h-0">
    <div class="flex justify-end mb-3 flex-shrink-0">
      <UButton
        icon="lucide:plus"
        size="xs"
        color="primary"
        class="min-w-fit whitespace-nowrap"
        @click="openCreate"
      >
        {{ t('menu.addBanner') || 'Add banner' }}
      </UButton>
    </div>

    <div
      v-if="error"
      class="mb-4 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-sm px-3 py-2"
    >
      {{ error }}
    </div>

    <div class="flex-1 min-h-0 overflow-y-auto">
      <div v-if="loading" class="flex items-center justify-center py-12">
        <Icon name="lucide:loader-2" class="h-6 w-6 animate-spin text-gray-400" />
      </div>
      <div v-else-if="!banners.length" class="flex flex-col items-center justify-center py-16 text-gray-400">
        <Icon name="lucide:image" class="h-8 w-8 mb-2" />
        <span class="text-sm">{{ t('menu.noBanners') || 'No banners yet' }}</span>
      </div>
      <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="b in banners"
          :key="b.id"
          class="group relative rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900"
        >
          <div class="w-full h-28 relative bg-gray-100 dark:bg-gray-800">
            <img v-if="b.imageUrl" :src="b.imageUrl" :alt="b.imageAlt || b.title" class="w-full h-full object-cover">
            <div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-3">
              <span class="text-white text-sm font-semibold truncate">{{ b.title }}</span>
            </div>
            <UBadge
              class="absolute top-2 right-2"
              :color="b.isActive ? 'primary' : 'gray'"
              variant="solid"
              size="xs"
            >
              {{ b.isActive ? (t('menu.isActive') || 'Active') : '—' }}
            </UBadge>
            <div class="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
              <UButton icon="lucide:pencil" size="xs" color="white" variant="solid" @click="openEdit(b)" />
              <UButton icon="lucide:trash-2" size="xs" color="red" variant="solid" @click="handleDelete(b)" />
            </div>
          </div>
          <div v-if="b.description" class="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 truncate">
            {{ b.description }}
          </div>
        </div>
      </div>
    </div>

    <PromoBannerModal
      v-model="isModalOpen"
      :ns-slug="nsSlug"
      :banner="editingBanner"
      :saving="saving"
      @submit="handleSubmit"
    />
  </div>
</template>
