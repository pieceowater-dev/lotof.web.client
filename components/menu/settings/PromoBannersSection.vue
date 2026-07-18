<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { useMenuToken } from '@/composables/useMenuToken';
import { useConfirm } from '@/composables/useConfirm';
import { logError } from '@/utils/logger';
import { getErrorMessage } from '@/utils/types/errors';
import PromoBannerModal from '@/components/menu/PromoBannerModal.vue';
import type { MenuPromoBanner } from '@/api/menu/promobanner/list';
import type { MenuBadge } from '@/api/menu/badge/list';
import { useMenuPlanLimits } from '@/composables/useMenuPlanLimits';

const { t } = useI18n();
const { confirm } = useConfirm();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);

type SectionKey = 'banners' | 'badges';
const activeSection = ref<SectionKey>('banners');
const sections = computed(() => [
  { key: 'banners' as SectionKey, label: t('menu.promoBanners') || 'Banners', icon: 'lucide:image' },
  { key: 'badges' as SectionKey, label: t('menu.badges') || 'Badges', icon: 'lucide:tag' },
]);

async function getToken(): Promise<string> {
  const { current } = useMenuToken();
  const menuToken = current();
  if (!menuToken) throw new Error('No menu token');
  return menuToken;
}

// --- Banners ---
const banners = ref<MenuPromoBanner[]>([]);
const bannersLoading = ref(false);
const bannersError = ref<string | null>(null);

const isModalOpen = ref(false);
const editingBanner = ref<MenuPromoBanner | null>(null);
const saving = ref(false);

async function loadBanners() {
  bannersLoading.value = true;
  bannersError.value = null;
  try {
    const menuToken = await getToken();
    const { menuPromoBannersList } = await import('@/api/menu/promobanner/list');
    const res = await menuPromoBannersList(menuToken, nsSlug.value);
    banners.value = res.banners;
  } catch (e) {
    logError('[menu/settings/banners] load failed', e);
    bannersError.value = getErrorMessage(e) || 'Failed to load banners';
  } finally {
    bannersLoading.value = false;
  }
}

const { isAtLimit, loadPlanLimits } = useMenuPlanLimits();

function openCreate() {
  if (isAtLimit('max_promobanners', banners.value.length)) {
    useToast().add({ title: t('menu.planLimitBanners') || 'Banner limit reached for your plan — upgrade to add more.', color: 'amber' });
    return;
  }
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
  if (!(await confirm({ message: t('menu.confirmDeleteBanner') || 'Delete this banner?' }))) return;
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

// --- Badges ---
const badges = ref<MenuBadge[]>([]);
const badgesLoading = ref(false);
const badgeSaving = ref(false);
const editingBadgeId = ref<string | null>(null);
const isIconPickerOpen = ref(false);

const ICON_OPTIONS = [
  '🔥', '⭐', '🆕', '🏆', '💯', '👍',
  '🌶️', '🥩', '🍗', '🐟', '🥦', '🌱',
  '🥗', '🍰', '🍯', '🧊', '☕', '🍺',
  '💰', '🏷️', '⏱️', '📦', '🚚', '✅',
];

const badgeForm = reactive({ text: '', bgColor: '#b91c1c', textColor: '#ffffff', icon: '' });

function resetBadgeForm() {
  editingBadgeId.value = null;
  badgeForm.text = '';
  badgeForm.bgColor = '#b91c1c';
  badgeForm.textColor = '#ffffff';
  badgeForm.icon = '';
  isIconPickerOpen.value = false;
}

async function loadBadges() {
  badgesLoading.value = true;
  try {
    const menuToken = await getToken();
    const { menuBadgesList } = await import('@/api/menu/badge/list');
    const res = await menuBadgesList(menuToken, nsSlug.value);
    badges.value = res.badges;
  } catch (e) {
    logError('[menu/settings/badges] load failed', e);
  } finally {
    badgesLoading.value = false;
  }
}

function editBadge(b: MenuBadge) {
  editingBadgeId.value = b.id;
  badgeForm.text = b.text;
  badgeForm.bgColor = b.bgColor;
  badgeForm.textColor = b.textColor;
  badgeForm.icon = b.icon || '';
  isIconPickerOpen.value = false;
}

function pickIcon(icon: string) {
  badgeForm.icon = badgeForm.icon === icon ? '' : icon;
  isIconPickerOpen.value = false;
}

const isBadgeFormValid = computed(() => badgeForm.text.trim().length > 0);

async function saveBadge() {
  if (!isBadgeFormValid.value) return;
  if (!editingBadgeId.value && isAtLimit('max_badges', badges.value.length)) {
    useToast().add({ title: t('menu.planLimitBadges') || 'Badge limit reached for your plan — upgrade to add more.', color: 'amber' });
    return;
  }
  badgeSaving.value = true;
  try {
    const menuToken = await getToken();
    if (editingBadgeId.value) {
      const { menuUpdateBadge } = await import('@/api/menu/badge/update');
      const updated = await menuUpdateBadge(menuToken, nsSlug.value, {
        id: editingBadgeId.value,
        text: badgeForm.text.trim(),
        bgColor: badgeForm.bgColor,
        textColor: badgeForm.textColor,
        icon: badgeForm.icon.trim() || undefined,
      });
      const idx = badges.value.findIndex((b) => b.id === updated.id);
      if (idx !== -1) badges.value[idx] = updated;
      useToast().add({ title: t('menu.badgeUpdated') || 'Badge updated', color: 'primary' });
    } else {
      const { menuCreateBadge } = await import('@/api/menu/badge/create');
      const created = await menuCreateBadge(menuToken, nsSlug.value, {
        text: badgeForm.text.trim(),
        bgColor: badgeForm.bgColor,
        textColor: badgeForm.textColor,
        icon: badgeForm.icon.trim() || undefined,
      });
      badges.value = [...badges.value, created];
      useToast().add({ title: t('menu.badgeCreated') || 'Badge created', color: 'primary' });
    }
    resetBadgeForm();
  } catch (e) {
    logError('[menu/settings/badges] save failed', e);
    useToast().add({ title: getErrorMessage(e) || 'Failed to save badge', color: 'red' });
  } finally {
    badgeSaving.value = false;
  }
}

async function removeBadge(b: MenuBadge) {
  if (!(await confirm({ message: t('menu.confirmDeleteBadge') || 'Delete this badge?' }))) return;
  try {
    const menuToken = await getToken();
    const { menuDeleteBadge } = await import('@/api/menu/badge/delete');
    await menuDeleteBadge(menuToken, nsSlug.value, b.id);
    badges.value = badges.value.filter((x) => x.id !== b.id);
    if (editingBadgeId.value === b.id) resetBadgeForm();
    useToast().add({ title: t('menu.badgeDeleted') || 'Badge deleted', color: 'primary' });
  } catch (e) {
    logError('[menu/settings/badges] delete failed', e);
    useToast().add({ title: getErrorMessage(e) || 'Failed to delete badge', color: 'red' });
  }
}

onMounted(async () => {
  loadBanners();
  loadBadges();
  loadPlanLimits(await getToken(), nsSlug.value);
});
</script>

<template>
  <div class="h-full flex flex-col min-h-0">
    <div class="flex items-center justify-between mb-3 flex-shrink-0 gap-2">
      <div class="flex gap-1 overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/60 p-1">
        <button
          v-for="s in sections"
          :key="s.key"
          type="button"
          class="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
          :class="activeSection === s.key
            ? 'bg-white dark:bg-gray-800 text-primary-600 dark:text-primary-400 shadow-sm'
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'"
          @click="activeSection = s.key"
        >
          <UIcon :name="s.icon" class="w-4 h-4" />
          {{ s.label }}
        </button>
      </div>
      <UButton
        v-if="activeSection === 'banners'"
        icon="lucide:plus"
        size="xs"
        color="primary"
        class="min-w-fit whitespace-nowrap flex-shrink-0"
        @click="openCreate"
      >
        {{ t('menu.addBanner') || 'Add banner' }}
      </UButton>
    </div>

    <!-- Banners -->
    <div v-if="activeSection === 'banners'" class="flex-1 min-h-0 flex flex-col">
      <div
        v-if="bannersError"
        class="mb-4 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-sm px-3 py-2"
      >
        {{ bannersError }}
      </div>
      <div class="flex-1 min-h-0 overflow-y-auto">
        <div v-if="bannersLoading" class="flex items-center justify-center py-12">
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
            class="group relative rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm"
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
    </div>

    <!-- Badges -->
    <div v-else class="flex-1 min-h-0 overflow-y-auto">
      <div class="max-w-2xl space-y-5">
        <div>
          <div class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
            {{ t('menu.badges') || 'Badges' }}
          </div>
          <div v-if="badgesLoading" class="flex items-center justify-center py-6">
            <UIcon name="lucide:loader-2" class="w-5 h-5 animate-spin text-gray-400" />
          </div>
          <div v-else-if="!badges.length" class="text-sm text-gray-500 dark:text-gray-400 py-2">
            {{ t('menu.noBadges') || 'No badges yet' }}
          </div>
          <div v-else class="flex flex-wrap gap-2">
            <div
              v-for="b in badges"
              :key="b.id"
              class="group relative"
            >
              <button
                type="button"
                class="inline-flex items-center gap-1 pl-2.5 pr-2 py-1 rounded-full text-xs font-semibold shadow-sm ring-1 ring-black/5"
                :class="editingBadgeId === b.id ? 'ring-2 ring-primary-500' : ''"
                :style="{ backgroundColor: b.bgColor, color: b.textColor }"
                @click="editBadge(b)"
              >
                <span v-if="b.icon">{{ b.icon }}</span>{{ b.text }}
              </button>
              <div class="absolute -top-2 -right-2 hidden group-hover:flex gap-0.5">
                <button
                  class="h-5 w-5 rounded-full bg-white dark:bg-gray-800 ring-1 ring-gray-200 dark:ring-gray-700 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-700"
                  @click="editBadge(b)"
                >
                  <Icon name="lucide:pencil" class="h-2.5 w-2.5 text-gray-600 dark:text-gray-300" />
                </button>
                <button
                  class="h-5 w-5 rounded-full bg-white dark:bg-gray-800 ring-1 ring-gray-200 dark:ring-gray-700 flex items-center justify-center hover:bg-red-50 dark:hover:bg-red-950/40"
                  @click="removeBadge(b)"
                >
                  <Icon name="lucide:x" class="h-2.5 w-2.5 text-red-500" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-3">
          <div class="flex items-center justify-between">
            <div class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {{ editingBadgeId ? (t('menu.editBadge') || 'Edit badge') : (t('menu.addBadge') || 'Add badge') }}
            </div>
            <span
              class="inline-flex items-center gap-1 pl-2.5 pr-2 py-1 rounded-full text-xs font-semibold shadow-sm ring-1 ring-black/5"
              :style="{ backgroundColor: badgeForm.bgColor, color: badgeForm.textColor }"
            >
              <span v-if="badgeForm.icon">{{ badgeForm.icon }}</span>{{ badgeForm.text || (t('menu.preview') || 'Preview') }}
            </span>
          </div>

          <div class="grid grid-cols-[1fr_auto] gap-3">
            <UFormGroup :label="t('menu.badgeText') || 'Text'" required>
              <UInput v-model="badgeForm.text" size="lg" />
            </UFormGroup>
            <UFormGroup :label="t('menu.icon') || 'Icon'">
              <UPopover v-model:open="isIconPickerOpen">
                <button
                  type="button"
                  class="h-9 w-14 flex items-center justify-center text-lg rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-primary-400 dark:hover:border-primary-500 transition-colors"
                >
                  <span v-if="badgeForm.icon">{{ badgeForm.icon }}</span>
                  <Icon v-else name="lucide:smile-plus" class="h-4 w-4 text-gray-400" />
                </button>
                <template #panel>
                  <div class="p-2 w-56">
                    <div class="grid grid-cols-6 gap-1">
                      <button
                        v-for="opt in ICON_OPTIONS"
                        :key="opt"
                        type="button"
                        class="h-8 w-8 flex items-center justify-center text-base rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        :class="badgeForm.icon === opt ? 'bg-primary-100 dark:bg-primary-900/40 ring-1 ring-primary-400' : ''"
                        @click="pickIcon(opt)"
                      >
                        {{ opt }}
                      </button>
                    </div>
                    <button
                      v-if="badgeForm.icon"
                      type="button"
                      class="mt-2 w-full text-xs text-gray-500 dark:text-gray-400 hover:text-red-500 py-1"
                      @click="pickIcon(badgeForm.icon)"
                    >
                      {{ t('app.clear') || 'Clear' }}
                    </button>
                  </div>
                </template>
              </UPopover>
            </UFormGroup>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <UFormGroup :label="t('menu.bgColor') || 'Background color'">
              <input v-model="badgeForm.bgColor" type="color" class="h-9 w-full rounded-lg border border-gray-200 dark:border-gray-800 cursor-pointer bg-transparent">
            </UFormGroup>
            <UFormGroup :label="t('menu.textColor') || 'Text color'">
              <input v-model="badgeForm.textColor" type="color" class="h-9 w-full rounded-lg border border-gray-200 dark:border-gray-800 cursor-pointer bg-transparent">
            </UFormGroup>
          </div>
          <div class="flex justify-end gap-2">
            <UButton v-if="editingBadgeId" color="gray" variant="ghost" size="sm" @click="resetBadgeForm">
              {{ t('app.cancel') }}
            </UButton>
            <UButton color="primary" size="sm" :loading="badgeSaving" :disabled="!isBadgeFormValid || badgeSaving" @click="saveBadge">
              {{ editingBadgeId ? (t('app.save') || 'Save') : (t('menu.addBadge') || 'Add badge') }}
            </UButton>
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
