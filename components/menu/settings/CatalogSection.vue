<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { useMenuToken } from '@/composables/useMenuToken';
import { useConfirm } from '@/composables/useConfirm';
import { useMenuPlanLimits } from '@/composables/useMenuPlanLimits';
import { logError } from '@/utils/logger';
import { getErrorMessage } from '@/utils/types/errors';
import CategoryModal from '@/components/menu/CategoryModal.vue';
import MenuItemModal from '@/components/menu/MenuItemModal.vue';
import BadgeManagerModal from '@/components/menu/BadgeManagerModal.vue';
import ModifierManagerModal from '@/components/menu/ModifierManagerModal.vue';
import type { MenuCategory } from '@/api/menu/category/list';
import type { MenuItem } from '@/api/menu/menuitem/list';
import type { UpdateMenuItemInput } from '@/api/menu/menuitem/update';
import type { MenuBadge } from '@/api/menu/badge/list';
import type { MenuBranch } from '@/api/menu/branch/list';
import type { MenuModifierGroup } from '@/api/menu/modifiergroup/list';

const { t } = useI18n();
const { confirm } = useConfirm();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);

const categories = ref<MenuCategory[]>([]);
const categoriesLoading = ref(false);
const selectedCategoryId = ref<string | null>(null);

const items = ref<MenuItem[]>([]);
const itemsLoading = ref(false);
const error = ref<string | null>(null);

const badges = ref<MenuBadge[]>([]);
const branches = ref<MenuBranch[]>([]);
const modifierGroups = ref<MenuModifierGroup[]>([]);

const isCategoryModalOpen = ref(false);
const editingCategory = ref<MenuCategory | null>(null);
const categorySaving = ref(false);

const isItemModalOpen = ref(false);
const editingItem = ref<MenuItem | null>(null);
const itemSaving = ref(false);

const isBadgeManagerOpen = ref(false);
const isModifierManagerOpen = ref(false);

async function getToken(): Promise<string> {
  const { current } = useMenuToken();
  const menuToken = current();
  if (!menuToken) throw new Error('No menu token');
  return menuToken;
}

async function loadCategories() {
  categoriesLoading.value = true;
  error.value = null;
  try {
    const menuToken = await getToken();
    const { menuCategoriesList } = await import('@/api/menu/category/list');
    const res = await menuCategoriesList(menuToken, nsSlug.value);
    categories.value = res.categories.sort((a, b) => a.sortOrder - b.sortOrder);
    if (!selectedCategoryId.value && categories.value.length) {
      selectedCategoryId.value = categories.value[0].id;
    }
  } catch (e) {
    logError('[menu/settings/catalog] loadCategories failed', e);
    error.value = getErrorMessage(e, t) || 'Failed to load categories';
  } finally {
    categoriesLoading.value = false;
  }
}

async function loadItems() {
  if (!selectedCategoryId.value) {
    items.value = [];
    return;
  }
  itemsLoading.value = true;
  try {
    const menuToken = await getToken();
    const { menuMenuItemsList } = await import('@/api/menu/menuitem/list');
    const res = await menuMenuItemsList(menuToken, nsSlug.value, selectedCategoryId.value);
    items.value = res.items.sort((a, b) => a.sortOrder - b.sortOrder);
  } catch (e) {
    logError('[menu/settings/catalog] loadItems failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to load items', color: 'red' });
  } finally {
    itemsLoading.value = false;
  }
}

async function loadBadges() {
  try {
    const menuToken = await getToken();
    const { menuBadgesList } = await import('@/api/menu/badge/list');
    const res = await menuBadgesList(menuToken, nsSlug.value);
    badges.value = res.badges;
  } catch (e) {
    logError('[menu/settings/catalog] loadBadges failed', e);
  }
}

async function loadBranches() {
  try {
    const menuToken = await getToken();
    const { menuBranchesList } = await import('@/api/menu/branch/list');
    const res = await menuBranchesList(menuToken, nsSlug.value);
    branches.value = res.branches;
  } catch (e) {
    logError('[menu/settings/catalog] loadBranches failed', e);
  }
}

async function loadModifierGroups() {
  try {
    const menuToken = await getToken();
    const { menuModifierGroupsList } = await import('@/api/menu/modifiergroup/list');
    const res = await menuModifierGroupsList(menuToken, nsSlug.value);
    modifierGroups.value = res.groups;
  } catch (e) {
    logError('[menu/settings/catalog] loadModifierGroups failed', e);
  }
}

// Stop list — temporarily marking an item unavailable at one branch (e.g.
// "we're out of tomatoes today"), as opposed to excludedBranchIds which is a
// permanent "we never sell this here". Branch-scoped, so nothing shows until
// a branch is picked.
const stopListBranchId = ref('');
const stopListEntries = ref<{ id: string; menuItemId: string }[]>([]);
const stopListLoading = ref(false);
const stoppedItemIds = computed(() => new Set(stopListEntries.value.map((e) => e.menuItemId)));
async function loadStopList() {
  if (!stopListBranchId.value) { stopListEntries.value = []; return; }
  stopListLoading.value = true;
  try {
    const menuToken = await getToken();
    const { menuStopList } = await import('@/api/menu/stoplist/list');
    stopListEntries.value = await menuStopList(menuToken, nsSlug.value, stopListBranchId.value);
  } catch (e) {
    logError('[menu/settings/catalog] loadStopList failed', e);
  } finally {
    stopListLoading.value = false;
  }
}
watch(stopListBranchId, loadStopList);

async function toggleStopped(item: MenuItem) {
  if (!stopListBranchId.value) return;
  try {
    const menuToken = await getToken();
    const existing = stopListEntries.value.find((e) => e.menuItemId === item.id);
    if (existing) {
      const { menuRemoveFromStopList } = await import('@/api/menu/stoplist/mutate');
      await menuRemoveFromStopList(menuToken, nsSlug.value, existing.id);
      stopListEntries.value = stopListEntries.value.filter((e) => e.id !== existing.id);
    } else {
      const { menuAddToStopList } = await import('@/api/menu/stoplist/mutate');
      const created = await menuAddToStopList(menuToken, nsSlug.value, stopListBranchId.value, item.id);
      stopListEntries.value = [...stopListEntries.value, created];
    }
  } catch (e) {
    logError('[menu/settings/catalog] toggleStopped failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to update stop list', color: 'red' });
  }
}

watch(selectedCategoryId, loadItems);

function badgeById(id: string) {
  return badges.value.find((b) => b.id === id);
}

function modifierGroupById(id: string) {
  return modifierGroups.value.find((g) => g.id === id);
}

function itemIndex(row: MenuItem) {
  return items.value.findIndex((i) => i.id === row.id);
}

// Drag-and-drop reordering for the items list — AppTable/UTable renders
// its own <tr> internally with no hook for draggable/@dragstart, so this
// list is a plain draggable div list instead (see the template), separate
// from moveItem's adjacent-swap arrows which stay as a keyboard/precision
// fallback.
const draggedItem = ref<MenuItem | null>(null);
const dragOverItemId = ref<string | null>(null);

// updateMenuItem does a blind full-column overwrite on the backend (see the
// comment in handleItemSubmit) — any field left out of the payload gets
// reset to its zero value, not left unchanged. Reorder operations only mean
// to change sortOrder, so they must echo every other field back untouched.
function fullItemPayload(it: MenuItem, overrides: Partial<UpdateMenuItemInput>): UpdateMenuItemInput {
  return {
    id: it.id,
    categoryId: it.categoryId,
    name: it.name,
    description: it.description ?? undefined,
    price: it.price,
    imageUrl: it.imageUrl ?? undefined,
    isActive: it.isActive,
    sortOrder: it.sortOrder,
    imageAlt: it.imageAlt ?? undefined,
    seoTitle: it.seoTitle ?? undefined,
    seoDescription: it.seoDescription ?? undefined,
    ...overrides,
  };
}

function onItemDragStart(item: MenuItem) {
  draggedItem.value = item;
}

function onItemDragOver(item: MenuItem) {
  if (draggedItem.value && draggedItem.value.id !== item.id) {
    dragOverItemId.value = item.id;
  }
}

function onItemDragLeave(item: MenuItem) {
  if (dragOverItemId.value === item.id) dragOverItemId.value = null;
}

async function onItemDrop(targetItem: MenuItem) {
  dragOverItemId.value = null;
  const dragged = draggedItem.value;
  draggedItem.value = null;
  if (!dragged || dragged.id === targetItem.id) return;

  const sorted = [...items.value].sort((a, b) => a.sortOrder - b.sortOrder);
  const fromIdx = sorted.findIndex((x) => x.id === dragged.id);
  const toIdx = sorted.findIndex((x) => x.id === targetItem.id);
  if (fromIdx === -1 || toIdx === -1) return;

  const reordered = [...sorted];
  const [moved] = reordered.splice(fromIdx, 1);
  reordered.splice(toIdx, 0, moved);

  // Only persist the items whose position actually changed, not the whole
  // category — a drag from the top to the bottom of a long list would
  // otherwise fire one request per item.
  const changed = reordered
    .map((it, idx) => ({ it, idx }))
    .filter(({ it, idx }) => it.sortOrder !== idx);
  if (!changed.length) return;

  try {
    const menuToken = await getToken();
    const { menuUpdateMenuItem } = await import('@/api/menu/menuitem/update');
    await Promise.all(
      changed.map(({ it, idx }) => menuUpdateMenuItem(menuToken, nsSlug.value, fullItemPayload(it, { sortOrder: idx })))
    );
    changed.forEach(({ it, idx }) => { it.sortOrder = idx; });
    items.value = reordered;
  } catch (e) {
    logError('[menu/settings/catalog] reorder items failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to reorder', color: 'red' });
    await loadItems(); // recover the real order from the server
  }
}

function onItemDragEnd() {
  draggedItem.value = null;
  dragOverItemId.value = null;
}

function openCreateCategory() {
  editingCategory.value = null;
  isCategoryModalOpen.value = true;
}

function openEditCategory(c: MenuCategory) {
  editingCategory.value = c;
  isCategoryModalOpen.value = true;
}

async function handleCategorySubmit(payload: Record<string, any>) {
  categorySaving.value = true;
  try {
    const menuToken = await getToken();
    if (editingCategory.value) {
      const { menuUpdateCategory } = await import('@/api/menu/category/update');
      // Always echo the current sortOrder back — the backend does a blind
      // field overwrite on update (no "field not provided" semantics), so
      // omitting it here would silently reset the category's position.
      const updated = await menuUpdateCategory(menuToken, nsSlug.value, {
        id: editingCategory.value.id,
        ...payload,
        sortOrder: editingCategory.value.sortOrder,
        isActive: editingCategory.value.isActive,
      });
      const idx = categories.value.findIndex((c) => c.id === updated.id);
      if (idx !== -1) categories.value[idx] = updated;
      useToast().add({ title: t('menu.categoryUpdated') || 'Category updated', color: 'primary' });
    } else {
      const nextSortOrder = categories.value.length
        ? Math.max(...categories.value.map((c) => c.sortOrder)) + 1
        : 0;
      const { menuCreateCategory } = await import('@/api/menu/category/create');
      const created = await menuCreateCategory(menuToken, nsSlug.value, { ...payload, sortOrder: nextSortOrder } as any);
      categories.value = [...categories.value, created].sort((a, b) => a.sortOrder - b.sortOrder);
      if (!selectedCategoryId.value) selectedCategoryId.value = created.id;
      useToast().add({ title: t('menu.categoryCreated') || 'Category created', color: 'primary' });
    }
    isCategoryModalOpen.value = false;
  } catch (e) {
    logError('[menu/settings/catalog] category save failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to save category', color: 'red' });
  } finally {
    categorySaving.value = false;
  }
}

async function moveCategory(c: MenuCategory, direction: -1 | 1) {
  const sorted = [...categories.value].sort((a, b) => a.sortOrder - b.sortOrder);
  const idx = sorted.findIndex((x) => x.id === c.id);
  const swapIdx = idx + direction;
  if (idx === -1 || swapIdx < 0 || swapIdx >= sorted.length) return;
  const other = sorted[swapIdx];
  const aOrder = c.sortOrder;
  const bOrder = other.sortOrder;
  try {
    const menuToken = await getToken();
    const { menuUpdateCategory } = await import('@/api/menu/category/update');
    await Promise.all([
      menuUpdateCategory(menuToken, nsSlug.value, { id: c.id, name: c.name, sortOrder: bOrder, isActive: c.isActive }),
      menuUpdateCategory(menuToken, nsSlug.value, { id: other.id, name: other.name, sortOrder: aOrder, isActive: other.isActive }),
    ]);
    c.sortOrder = bOrder;
    other.sortOrder = aOrder;
    categories.value = [...categories.value].sort((a, b) => a.sortOrder - b.sortOrder);
  } catch (e) {
    logError('[menu/settings/catalog] moveCategory failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to reorder', color: 'red' });
  }
}

async function handleCategoryDelete(c: MenuCategory) {
  if (!(await confirm({ message: t('menu.confirmDeleteCategory') || 'Delete this category?' }))) return;
  try {
    const menuToken = await getToken();
    const { menuDeleteCategory } = await import('@/api/menu/category/delete');
    await menuDeleteCategory(menuToken, nsSlug.value, c.id);
    categories.value = categories.value.filter((x) => x.id !== c.id);
    if (selectedCategoryId.value === c.id) {
      selectedCategoryId.value = categories.value[0]?.id || null;
    }
    useToast().add({ title: t('menu.categoryDeleted') || 'Category deleted', color: 'primary' });
  } catch (e) {
    logError('[menu/settings/catalog] category delete failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to delete category', color: 'red' });
  }
}

const { isAtLimit, loadPlanLimits } = useMenuPlanLimits();
const totalItemCount = ref(0);
async function loadTotalItemCount() {
  try {
    const menuToken = await getToken();
    const { menuMenuItemsList } = await import('@/api/menu/menuitem/list');
    const res = await menuMenuItemsList(menuToken, nsSlug.value);
    totalItemCount.value = res.count;
  } catch (e) {
    logError('[menu/settings/catalog] loadTotalItemCount failed', e);
  }
}

function openCreateItem() {
  if (!selectedCategoryId.value) return;
  if (isAtLimit('max_menu_items', totalItemCount.value)) {
    useToast().add({ title: t('menu.planLimitItems') || 'Menu item limit reached for your plan — upgrade to add more.', color: 'amber' });
    return;
  }
  editingItem.value = null;
  isItemModalOpen.value = true;
}

function openEditItem(it: MenuItem) {
  editingItem.value = it;
  isItemModalOpen.value = true;
}

async function syncBadgesAndExclusions(itemId: string, badgeIds: string[], excludedBranchIds: string[]) {
  const menuToken = await getToken();
  const prevBadgeIds = new Set(editingItem.value?.badgeIds || []);
  const nextBadgeIds = new Set(badgeIds);
  const prevExcluded = new Set(editingItem.value?.excludedBranchIds || []);
  const nextExcluded = new Set(excludedBranchIds);

  const { menuAddBadgeToItem, menuRemoveBadgeFromItem } = await import('@/api/menu/menuitem/badge');
  const { menuAddItemBranchExclusion, menuRemoveItemBranchExclusion } = await import('@/api/menu/menuitem/branchExclusion');

  const tasks: Promise<any>[] = [];
  for (const id of nextBadgeIds) {
    if (!prevBadgeIds.has(id)) tasks.push(menuAddBadgeToItem(menuToken, nsSlug.value, itemId, id));
  }
  for (const id of prevBadgeIds) {
    if (!nextBadgeIds.has(id)) tasks.push(menuRemoveBadgeFromItem(menuToken, nsSlug.value, itemId, id));
  }
  for (const id of nextExcluded) {
    if (!prevExcluded.has(id)) tasks.push(menuAddItemBranchExclusion(menuToken, nsSlug.value, itemId, id));
  }
  for (const id of prevExcluded) {
    if (!nextExcluded.has(id)) tasks.push(menuRemoveItemBranchExclusion(menuToken, nsSlug.value, itemId, id));
  }
  await Promise.all(tasks);
}

async function syncModifiers(itemId: string, modifierGroupIds: string[]) {
  const menuToken = await getToken();
  const prevModifierGroupIds = new Set(editingItem.value?.modifierGroupIds || []);
  const nextModifierGroupIds = new Set(modifierGroupIds);

  const { menuAddModifierToItem, menuRemoveModifierFromItem } = await import('@/api/menu/menuitem/modifier');

  const tasks: Promise<any>[] = [];
  for (const id of nextModifierGroupIds) {
    if (!prevModifierGroupIds.has(id)) tasks.push(menuAddModifierToItem(menuToken, nsSlug.value, itemId, id));
  }
  for (const id of prevModifierGroupIds) {
    if (!nextModifierGroupIds.has(id)) tasks.push(menuRemoveModifierFromItem(menuToken, nsSlug.value, itemId, id));
  }
  await Promise.all(tasks);
}

async function handleItemSubmit(payload: Record<string, any>) {
  if (!selectedCategoryId.value) return;
  itemSaving.value = true;
  const { badgeIds, modifierGroupIds, excludedBranchIds, ...itemFields } = payload;
  try {
    const menuToken = await getToken();
    let savedItem: MenuItem;
    if (editingItem.value) {
      const { menuUpdateMenuItem } = await import('@/api/menu/menuitem/update');
      // Always echo categoryId/sortOrder/isActive back — the backend does a
      // blind field overwrite on update (categoryId isn't even optional:
      // it unconditionally parses it as a UUID, so omitting it fails the
      // whole update with "invalid UUID length: 0"), so omitting any of
      // these would either crash or silently reset the item's
      // position/visibility (same pattern as categories).
      savedItem = await menuUpdateMenuItem(menuToken, nsSlug.value, {
        id: editingItem.value.id,
        ...itemFields,
        categoryId: editingItem.value.categoryId,
        sortOrder: editingItem.value.sortOrder,
        isActive: editingItem.value.isActive,
      });
    } else {
      const categoryItems = items.value.filter((i) => i.categoryId === selectedCategoryId.value);
      const nextSortOrder = categoryItems.length
        ? Math.max(...categoryItems.map((i) => i.sortOrder)) + 1
        : 0;
      const { menuCreateMenuItem } = await import('@/api/menu/menuitem/create');
      savedItem = await menuCreateMenuItem(menuToken, nsSlug.value, { categoryId: selectedCategoryId.value, ...itemFields, sortOrder: nextSortOrder } as any);
    }
    await syncBadgesAndExclusions(savedItem.id, badgeIds || [], excludedBranchIds || []);
    await syncModifiers(savedItem.id, modifierGroupIds || []);
    savedItem.badgeIds = badgeIds || [];
    savedItem.excludedBranchIds = excludedBranchIds || [];
    savedItem.modifierGroupIds = modifierGroupIds || [];

    const idx = items.value.findIndex((i) => i.id === savedItem.id);
    if (idx !== -1) {
      items.value[idx] = savedItem;
      useToast().add({ title: t('menu.itemUpdated') || 'Item updated', color: 'primary' });
    } else {
      items.value = [...items.value, savedItem].sort((a, b) => a.sortOrder - b.sortOrder);
      totalItemCount.value += 1;
      useToast().add({ title: t('menu.itemCreated') || 'Item created', color: 'primary' });
    }
    useAnalytics().track('menu_item_saved', {
      itemId: savedItem.id,
      action: editingItem.value ? 'updated' : 'created',
      categoryId: selectedCategoryId.value,
    });
    isItemModalOpen.value = false;
  } catch (e) {
    logError('[menu/settings/catalog] item save failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to save item', color: 'red' });
  } finally {
    itemSaving.value = false;
  }
}

async function moveItem(it: MenuItem, direction: -1 | 1) {
  const sorted = [...items.value].sort((a, b) => a.sortOrder - b.sortOrder);
  const idx = sorted.findIndex((x) => x.id === it.id);
  const swapIdx = idx + direction;
  if (idx === -1 || swapIdx < 0 || swapIdx >= sorted.length) return;
  const other = sorted[swapIdx];
  const aOrder = it.sortOrder;
  const bOrder = other.sortOrder;
  try {
    const menuToken = await getToken();
    const { menuUpdateMenuItem } = await import('@/api/menu/menuitem/update');
    await Promise.all([
      menuUpdateMenuItem(menuToken, nsSlug.value, fullItemPayload(it, { sortOrder: bOrder })),
      menuUpdateMenuItem(menuToken, nsSlug.value, fullItemPayload(other, { sortOrder: aOrder })),
    ]);
    it.sortOrder = bOrder;
    other.sortOrder = aOrder;
    items.value = [...items.value].sort((a, b) => a.sortOrder - b.sortOrder);
  } catch (e) {
    logError('[menu/settings/catalog] moveItem failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to reorder', color: 'red' });
  }
}

async function handleItemDelete(it: MenuItem) {
  if (!(await confirm({ message: t('menu.confirmDeleteMenuItem') || 'Delete this item?' }))) return;
  try {
    const menuToken = await getToken();
    const { menuDeleteMenuItem } = await import('@/api/menu/menuitem/delete');
    await menuDeleteMenuItem(menuToken, nsSlug.value, it.id);
    items.value = items.value.filter((x) => x.id !== it.id);
    useToast().add({ title: t('menu.itemDeleted') || 'Item deleted', color: 'primary' });
  } catch (e) {
    logError('[menu/settings/catalog] item delete failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to delete item', color: 'red' });
  }
}

onMounted(async () => {
  loadCategories();
  loadBadges();
  loadBranches();
  loadModifierGroups();
  loadTotalItemCount();
  loadPlanLimits(await getToken(), nsSlug.value);
});
</script>

<template>
  <div class="h-full flex flex-col min-h-0">
    <div
      v-if="error"
      class="mb-4 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-sm px-3 py-2"
    >
      {{ error }}
    </div>

    <div class="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4">
      <!-- Categories column -->
      <div class="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-col min-h-0">
        <div class="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-gray-800">
          <span class="text-sm font-semibold">{{ t('menu.categories') || 'Categories' }}</span>
          <UButton icon="lucide:plus" size="2xs" color="primary" variant="soft" @click="openCreateCategory" />
        </div>
        <div class="flex-1 overflow-y-auto">
          <div
            v-if="categoriesLoading"
            class="flex items-center justify-center py-8"
          >
            <UIcon name="lucide:loader-2" class="w-5 h-5 animate-spin text-gray-400" />
          </div>
          <div
            v-else-if="!categories.length"
            class="text-sm text-gray-500 dark:text-gray-400 px-3 py-4"
          >
            {{ t('menu.noCategories') || 'No categories yet' }}
          </div>
          <div
            v-for="(c, idx) in categories"
            :key="c.id"
            class="group flex items-center justify-between px-3 py-2 cursor-pointer text-sm border-l-2"
            :class="c.id === selectedCategoryId
              ? 'bg-primary-50 dark:bg-primary-950/30 border-primary-500 font-medium'
              : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-800/50'"
            @click="selectedCategoryId = c.id"
          >
            <span class="truncate">{{ c.name }}</span>
            <div class="hidden group-hover:flex items-center gap-0.5 flex-shrink-0">
              <UButton icon="lucide:chevron-up" size="2xs" color="gray" variant="ghost" :disabled="idx === 0" @click.stop="moveCategory(c, -1)" />
              <UButton icon="lucide:chevron-down" size="2xs" color="gray" variant="ghost" :disabled="idx === categories.length - 1" @click.stop="moveCategory(c, 1)" />
              <UButton icon="lucide:pencil" size="2xs" color="gray" variant="ghost" @click.stop="openEditCategory(c)" />
              <UButton icon="lucide:trash-2" size="2xs" color="red" variant="ghost" @click.stop="handleCategoryDelete(c)" />
            </div>
          </div>
        </div>
        <div class="border-t border-gray-100 dark:border-gray-800 p-2 space-y-1">
          <UButton
            block
            size="xs"
            color="gray"
            variant="ghost"
            icon="lucide:list-plus"
            @click="isModifierManagerOpen = true"
          >
            {{ t('menu.modifiers') || 'Modifiers' }}
          </UButton>
        </div>
      </div>

      <!-- Items column -->
      <div class="flex flex-col min-h-0">
        <div class="flex items-center justify-between mb-2 flex-shrink-0 gap-2">
          <span class="text-sm font-semibold flex-shrink-0">{{ t('menu.menuItems') || 'Items' }}</span>
          <div class="flex items-center gap-2 min-w-0">
            <USelectMenu
              v-model="stopListBranchId"
              :options="[{ label: t('menu.stopListPickBranch') || 'Stop list: pick a branch', value: '' }, ...branches.map((b) => ({ label: b.name, value: b.id }))]"
              value-attribute="value"
              option-attribute="label"
              size="xs"
              class="w-48"
              :popper="{ strategy: 'fixed' }"
            />
            <UButton
              icon="lucide:plus"
              size="xs"
              color="primary"
              :disabled="!selectedCategoryId"
              @click="openCreateItem"
            >
              {{ t('menu.createMenuItem') || 'Add item' }}
            </UButton>
          </div>
        </div>
        <div class="flex-1 min-h-0 overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div v-if="itemsLoading" class="flex items-center justify-center py-8">
            <UIcon name="lucide:loader-2" class="w-5 h-5 animate-spin text-gray-400" />
          </div>
          <div v-else-if="!items.length" class="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <UIcon name="lucide:package" class="w-6 h-6 text-gray-300 dark:text-gray-700" />
            <span class="text-sm text-gray-500 dark:text-gray-400">{{ t('menu.noMenuItems') || 'No items yet' }}</span>
          </div>
          <div v-else class="divide-y divide-gray-100 dark:divide-gray-800">
            <div
              v-for="row in items"
              :key="row.id"
              draggable="true"
              class="group flex items-center gap-2 px-2 py-2 transition-colors"
              :class="dragOverItemId === row.id ? 'bg-primary-50 dark:bg-primary-950/30' : draggedItem?.id === row.id ? 'opacity-40' : 'hover:bg-gray-50 dark:hover:bg-gray-800/40'"
              @dragstart="onItemDragStart(row)"
              @dragover.prevent="onItemDragOver(row)"
              @dragleave="onItemDragLeave(row)"
              @drop.prevent="onItemDrop(row)"
              @dragend="onItemDragEnd"
            >
              <Icon name="lucide:grip-vertical" class="w-4 h-4 text-gray-300 dark:text-gray-600 flex-shrink-0 cursor-grab active:cursor-grabbing" />
              <div class="hidden group-hover:flex flex-col -my-1 flex-shrink-0">
                <UButton icon="lucide:chevron-up" size="2xs" color="gray" variant="ghost" :disabled="itemIndex(row) === 0" @click="moveItem(row, -1)" />
                <UButton icon="lucide:chevron-down" size="2xs" color="gray" variant="ghost" :disabled="itemIndex(row) === items.length - 1" @click="moveItem(row, 1)" />
              </div>
              <button
                type="button"
                class="text-left font-medium text-gray-900 dark:text-gray-100 hover:text-primary-600 dark:hover:text-primary-400 transition-colors truncate w-32 flex-shrink-0"
                @click="openEditItem(row)"
              >
                {{ row.name }}
              </button>
              <span class="text-sm text-gray-600 dark:text-gray-400 tabular-nums flex-shrink-0 w-16 text-right">{{ row.price }}</span>
              <div class="hidden lg:flex flex-wrap gap-1 flex-shrink-0 w-28">
                <span
                  v-for="id in row.badgeIds"
                  :key="id"
                  class="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium"
                  :style="badgeById(id) ? { backgroundColor: badgeById(id)!.bgColor, color: badgeById(id)!.textColor } : {}"
                >
                  {{ badgeById(id)?.text || '' }}
                </span>
              </div>
              <div class="hidden xl:flex flex-wrap gap-1 flex-shrink-0 w-28">
                <span
                  v-for="id in row.modifierGroupIds"
                  :key="id"
                  class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
                >
                  {{ modifierGroupById(id)?.name || '' }}
                </span>
              </div>
              <UBadge :color="row.isActive ? 'primary' : 'gray'" variant="subtle" class="hidden sm:inline-flex flex-shrink-0">
                {{ row.isActive ? (t('menu.isActive') || 'Active') : '—' }}
              </UBadge>
              <div class="flex-shrink-0 w-9 flex justify-center">
                <UTooltip v-if="!stopListBranchId" :text="t('menu.stopListPickBranchHint') || 'Pick a branch to manage'">
                  <span class="text-gray-300 dark:text-gray-700">—</span>
                </UTooltip>
                <UToggle
                  v-else
                  :model-value="stoppedItemIds.has(row.id)"
                  :disabled="stopListLoading"
                  color="red"
                  @update:model-value="toggleStopped(row)"
                />
              </div>
              <div class="flex-1" />
              <UButton icon="lucide:trash-2" size="2xs" color="red" variant="ghost" class="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" @click="handleItemDelete(row)" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <CategoryModal
      v-model="isCategoryModalOpen"
      :category="editingCategory"
      :saving="categorySaving"
      @submit="handleCategorySubmit"
    />
    <MenuItemModal
      v-model="isItemModalOpen"
      :ns-slug="nsSlug"
      :item="editingItem"
      :saving="itemSaving"
      :available-badges="badges"
      :available-branches="branches"
      :available-modifier-groups="modifierGroups"
      @submit="handleItemSubmit"
      @manage-badges="isBadgeManagerOpen = true"
      @manage-modifiers="isModifierManagerOpen = true"
    />
    <BadgeManagerModal
      v-model="isBadgeManagerOpen"
      @changed="loadBadges"
    />
    <ModifierManagerModal
      v-model="isModifierManagerOpen"
      @changed="loadModifierGroups"
    />
  </div>
</template>
