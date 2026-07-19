<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { useMenuToken } from '@/composables/useMenuToken';
import { useConfirm } from '@/composables/useConfirm';
import { logError } from '@/utils/logger';
import { getErrorMessage } from '@/utils/types/errors';
import type { MenuBadge } from '@/api/menu/badge/list';
import { useMenuPlanLimits } from '@/composables/useMenuPlanLimits';

const { t } = useI18n();
const { confirm } = useConfirm();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
  (e: 'changed'): void;
}>();

const isOpen = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
});

const badges = ref<MenuBadge[]>([]);
const loading = ref(false);
const saving = ref(false);
const editingId = ref<string | null>(null);
const isIconPickerOpen = ref(false);

// Curated set covering the common menu-badge use cases (spicy, new, popular,
// diet tags, discounts, ...) rather than a full emoji library — keeps the
// picker a single glance-able grid instead of a searchable mega-list.
const ICON_OPTIONS = [
  '🔥', '⭐', '🆕', '🏆', '💯', '👍',
  '🌶️', '🥩', '🍗', '🐟', '🥦', '🌱',
  '🥗', '🍰', '🍯', '🧊', '☕', '🍺',
  '💰', '🏷️', '⏱️', '📦', '🚚', '✅',
];

const form = reactive({ text: '', bgColor: '#b91c1c', textColor: '#ffffff', icon: '' });

function resetForm() {
  editingId.value = null;
  form.text = '';
  form.bgColor = '#b91c1c';
  form.textColor = '#ffffff';
  form.icon = '';
  isIconPickerOpen.value = false;
}

async function getToken(): Promise<string> {
  const { current } = useMenuToken();
  const menuToken = current();
  if (!menuToken) throw new Error('No menu token');
  return menuToken;
}

async function load() {
  loading.value = true;
  try {
    const menuToken = await getToken();
    const { menuBadgesList } = await import('@/api/menu/badge/list');
    const res = await menuBadgesList(menuToken, nsSlug.value);
    badges.value = res.badges;
  } catch (e) {
    logError('[BadgeManagerModal] load failed', e);
  } finally {
    loading.value = false;
  }
}

function edit(b: MenuBadge) {
  editingId.value = b.id;
  form.text = b.text;
  form.bgColor = b.bgColor;
  form.textColor = b.textColor;
  form.icon = b.icon || '';
  isIconPickerOpen.value = false;
}

function pickIcon(icon: string) {
  form.icon = form.icon === icon ? '' : icon;
  isIconPickerOpen.value = false;
}

const isFormValid = computed(() => form.text.trim().length > 0);

const { isAtLimit, loadPlanLimits } = useMenuPlanLimits();

async function save() {
  if (!isFormValid.value) return;
  if (!editingId.value && isAtLimit('max_badges', badges.value.length)) {
    useToast().add({ title: t('menu.planLimitBadges') || 'Badge limit reached for your plan — upgrade to add more.', color: 'amber' });
    return;
  }
  saving.value = true;
  try {
    const menuToken = await getToken();
    if (editingId.value) {
      const { menuUpdateBadge } = await import('@/api/menu/badge/update');
      const updated = await menuUpdateBadge(menuToken, nsSlug.value, {
        id: editingId.value,
        text: form.text.trim(),
        bgColor: form.bgColor,
        textColor: form.textColor,
        icon: form.icon.trim() || undefined,
      });
      const idx = badges.value.findIndex((b) => b.id === updated.id);
      if (idx !== -1) badges.value[idx] = updated;
      useToast().add({ title: t('menu.badgeUpdated') || 'Badge updated', color: 'primary' });
    } else {
      const { menuCreateBadge } = await import('@/api/menu/badge/create');
      const created = await menuCreateBadge(menuToken, nsSlug.value, {
        text: form.text.trim(),
        bgColor: form.bgColor,
        textColor: form.textColor,
        icon: form.icon.trim() || undefined,
      });
      badges.value = [...badges.value, created];
      useToast().add({ title: t('menu.badgeCreated') || 'Badge created', color: 'primary' });
    }
    resetForm();
    emit('changed');
  } catch (e) {
    logError('[BadgeManagerModal] save failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to save badge', color: 'red' });
  } finally {
    saving.value = false;
  }
}

async function remove(b: MenuBadge) {
  if (!(await confirm({ message: t('menu.confirmDeleteBadge') || 'Delete this badge?' }))) return;
  try {
    const menuToken = await getToken();
    const { menuDeleteBadge } = await import('@/api/menu/badge/delete');
    await menuDeleteBadge(menuToken, nsSlug.value, b.id);
    badges.value = badges.value.filter((x) => x.id !== b.id);
    if (editingId.value === b.id) resetForm();
    useToast().add({ title: t('menu.badgeDeleted') || 'Badge deleted', color: 'primary' });
    emit('changed');
  } catch (e) {
    logError('[BadgeManagerModal] delete failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to delete badge', color: 'red' });
  }
}

watch(() => props.modelValue, async (open) => {
  if (open) {
    load();
    loadPlanLimits(await getToken(), nsSlug.value);
  } else {
    resetForm();
  }
});
</script>

<template>
  <UModal v-model="isOpen" :ui="{ width: 'sm:max-w-lg' }">
    <UCard :ui="{ ring: '', divide: 'divide-y divide-gray-100 dark:divide-gray-800' }">
      <template #header>
        <div class="flex items-center gap-2.5">
          <span class="flex h-8 w-8 items-center justify-center rounded-xl bg-primary-100 dark:bg-primary-900/40">
            <Icon name="lucide:tag" class="h-4 w-4 text-primary-600 dark:text-primary-300" />
          </span>
          <h3 class="text-lg font-semibold">
            {{ t('menu.badges') || 'Badges' }}
          </h3>
        </div>
      </template>

      <div class="space-y-5">
        <!-- Existing badges, rendered exactly as they'll appear on an item -->
        <div>
          <div class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
            {{ t('menu.badges') || 'Badges' }}
          </div>
          <div v-if="loading" class="flex items-center justify-center py-6">
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
                :class="editingId === b.id ? 'ring-2 ring-primary-500' : ''"
                :style="{ backgroundColor: b.bgColor, color: b.textColor }"
                @click="edit(b)"
              >
                <span v-if="b.icon">{{ b.icon }}</span>{{ b.text }}
              </button>
              <div class="absolute -top-2 -right-2 hidden group-hover:flex gap-0.5">
                <button
                  class="h-5 w-5 rounded-full bg-white dark:bg-gray-800 ring-1 ring-gray-200 dark:ring-gray-700 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-700"
                  @click="edit(b)"
                >
                  <Icon name="lucide:pencil" class="h-2.5 w-2.5 text-gray-600 dark:text-gray-300" />
                </button>
                <button
                  class="h-5 w-5 rounded-full bg-white dark:bg-gray-800 ring-1 ring-gray-200 dark:ring-gray-700 flex items-center justify-center hover:bg-red-50 dark:hover:bg-red-950/40"
                  @click="remove(b)"
                >
                  <Icon name="lucide:x" class="h-2.5 w-2.5 text-red-500" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Create / edit form with a live preview -->
        <div class="pt-4 border-t border-gray-100 dark:border-gray-800 space-y-3">
          <div class="flex items-center justify-between">
            <div class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {{ editingId ? (t('menu.editBadge') || 'Edit badge') : (t('menu.addBadge') || 'Add badge') }}
            </div>
            <span
              class="inline-flex items-center gap-1 pl-2.5 pr-2 py-1 rounded-full text-xs font-semibold shadow-sm ring-1 ring-black/5"
              :style="{ backgroundColor: form.bgColor, color: form.textColor }"
            >
              <span v-if="form.icon">{{ form.icon }}</span>{{ form.text || (t('menu.preview') || 'Preview') }}
            </span>
          </div>

          <div class="grid grid-cols-[1fr_auto] gap-3">
            <UFormGroup :label="t('menu.badgeText') || 'Text'" required>
              <UInput v-model="form.text" size="lg" />
            </UFormGroup>
            <UFormGroup :label="t('menu.icon') || 'Icon'">
              <UPopover v-model:open="isIconPickerOpen">
                <button
                  type="button"
                  class="h-9 w-14 flex items-center justify-center text-lg rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-primary-400 dark:hover:border-primary-500 transition-colors"
                >
                  <span v-if="form.icon">{{ form.icon }}</span>
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
                        :class="form.icon === opt ? 'bg-primary-100 dark:bg-primary-900/40 ring-1 ring-primary-400' : ''"
                        @click="pickIcon(opt)"
                      >
                        {{ opt }}
                      </button>
                    </div>
                    <button
                      v-if="form.icon"
                      type="button"
                      class="mt-2 w-full text-xs text-gray-500 dark:text-gray-400 hover:text-red-500 py-1"
                      @click="pickIcon(form.icon)"
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
              <input v-model="form.bgColor" type="color" class="h-9 w-full rounded-lg border border-gray-200 dark:border-gray-800 cursor-pointer bg-transparent">
            </UFormGroup>
            <UFormGroup :label="t('menu.textColor') || 'Text color'">
              <input v-model="form.textColor" type="color" class="h-9 w-full rounded-lg border border-gray-200 dark:border-gray-800 cursor-pointer bg-transparent">
            </UFormGroup>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton color="gray" variant="ghost" @click="isOpen = false">
            {{ t('app.close') || 'Close' }}
          </UButton>
          <UButton v-if="editingId" color="gray" variant="ghost" @click="resetForm">
            {{ t('app.cancel') }}
          </UButton>
          <UButton color="primary" :loading="saving" :disabled="!isFormValid || saving" @click="save">
            {{ editingId ? (t('app.save') || 'Save') : (t('menu.addBadge') || 'Add badge') }}
          </UButton>
        </div>
      </template>
    </UCard>
  </UModal>
</template>
