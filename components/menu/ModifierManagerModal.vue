<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { useMenuToken } from '@/composables/useMenuToken';
import { logError } from '@/utils/logger';
import { getErrorMessage } from '@/utils/types/errors';
import type { MenuModifierGroup } from '@/api/menu/modifiergroup/list';
import type { MenuModifierOption } from '@/api/menu/modifieroption/list';

const { t } = useI18n();
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

const groups = ref<MenuModifierGroup[]>([]);
const groupsLoading = ref(false);
const groupSaving = ref(false);
const editingGroupId = ref<string | null>(null);
const selectedGroupId = ref<string | null>(null);

const options = ref<MenuModifierOption[]>([]);
const optionsLoading = ref(false);
const optionSaving = ref(false);
const editingOptionId = ref<string | null>(null);

const groupForm = reactive({ name: '', type: 'single' as 'single' | 'multi', minSelect: 0, maxSelect: undefined as number | undefined, isRequired: false });
const optionForm = reactive({ name: '', price: 0 });

async function getToken(): Promise<string> {
  const { current } = useMenuToken();
  const menuToken = current();
  if (!menuToken) throw new Error('No menu token');
  return menuToken;
}

function resetGroupForm() {
  editingGroupId.value = null;
  groupForm.name = '';
  groupForm.type = 'single';
  groupForm.minSelect = 0;
  groupForm.maxSelect = undefined;
  groupForm.isRequired = false;
}

function resetOptionForm() {
  editingOptionId.value = null;
  optionForm.name = '';
  optionForm.price = 0;
}

async function loadGroups() {
  groupsLoading.value = true;
  try {
    const menuToken = await getToken();
    const { menuModifierGroupsList } = await import('@/api/menu/modifiergroup/list');
    const res = await menuModifierGroupsList(menuToken, nsSlug.value);
    groups.value = res.groups;
  } catch (e) {
    logError('[ModifierManagerModal] loadGroups failed', e);
  } finally {
    groupsLoading.value = false;
  }
}

async function loadOptions(groupId: string) {
  optionsLoading.value = true;
  try {
    const menuToken = await getToken();
    const { menuModifierOptionsList } = await import('@/api/menu/modifieroption/list');
    options.value = (await menuModifierOptionsList(menuToken, nsSlug.value, groupId)).sort((a, b) => a.sortOrder - b.sortOrder);
  } catch (e) {
    logError('[ModifierManagerModal] loadOptions failed', e);
  } finally {
    optionsLoading.value = false;
  }
}

function selectGroup(g: MenuModifierGroup) {
  selectedGroupId.value = g.id;
  editingGroupId.value = g.id;
  groupForm.name = g.name;
  groupForm.type = g.type === 'multi' ? 'multi' : 'single';
  groupForm.minSelect = g.minSelect || 0;
  groupForm.maxSelect = g.maxSelect ?? undefined;
  groupForm.isRequired = g.isRequired;
  resetOptionForm();
  loadOptions(g.id);
}

function startNewGroup() {
  selectedGroupId.value = null;
  resetGroupForm();
  options.value = [];
  resetOptionForm();
}

const isGroupFormValid = computed(() => groupForm.name.trim().length > 0);

async function saveGroup() {
  if (!isGroupFormValid.value) return;
  groupSaving.value = true;
  try {
    const menuToken = await getToken();
    if (editingGroupId.value) {
      const { menuUpdateModifierGroup } = await import('@/api/menu/modifiergroup/update');
      const updated = await menuUpdateModifierGroup(menuToken, nsSlug.value, {
        id: editingGroupId.value,
        name: groupForm.name.trim(),
        type: groupForm.type,
        minSelect: groupForm.minSelect,
        maxSelect: groupForm.maxSelect ?? 0,
        isRequired: groupForm.isRequired,
      });
      const idx = groups.value.findIndex((g) => g.id === updated.id);
      if (idx !== -1) groups.value[idx] = updated;
      useToast().add({ title: t('menu.modifierGroupUpdated') || 'Modifier group updated', color: 'primary' });
    } else {
      const { menuCreateModifierGroup } = await import('@/api/menu/modifiergroup/create');
      const created = await menuCreateModifierGroup(menuToken, nsSlug.value, {
        name: groupForm.name.trim(),
        type: groupForm.type,
        minSelect: groupForm.minSelect,
        maxSelect: groupForm.maxSelect,
        isRequired: groupForm.isRequired,
      });
      groups.value = [...groups.value, created];
      selectGroup(created);
      useToast().add({ title: t('menu.modifierGroupCreated') || 'Modifier group created', color: 'primary' });
    }
    emit('changed');
  } catch (e) {
    logError('[ModifierManagerModal] saveGroup failed', e);
    useToast().add({ title: getErrorMessage(e) || 'Failed to save modifier group', color: 'red' });
  } finally {
    groupSaving.value = false;
  }
}

async function removeGroup(g: MenuModifierGroup) {
  if (process.client && !window.confirm(t('menu.confirmDeleteModifierGroup') || 'Delete this modifier group?')) return;
  try {
    const menuToken = await getToken();
    const { menuDeleteModifierGroup } = await import('@/api/menu/modifiergroup/delete');
    await menuDeleteModifierGroup(menuToken, nsSlug.value, g.id);
    groups.value = groups.value.filter((x) => x.id !== g.id);
    if (selectedGroupId.value === g.id) startNewGroup();
    useToast().add({ title: t('menu.modifierGroupDeleted') || 'Modifier group deleted', color: 'primary' });
    emit('changed');
  } catch (e) {
    logError('[ModifierManagerModal] removeGroup failed', e);
    useToast().add({ title: getErrorMessage(e) || 'Failed to delete modifier group', color: 'red' });
  }
}

function editOption(o: MenuModifierOption) {
  editingOptionId.value = o.id;
  optionForm.name = o.name;
  optionForm.price = o.price;
}

const isOptionFormValid = computed(() => optionForm.name.trim().length > 0);

async function saveOption() {
  if (!isOptionFormValid.value || !selectedGroupId.value) return;
  optionSaving.value = true;
  try {
    const menuToken = await getToken();
    if (editingOptionId.value) {
      const existing = options.value.find((o) => o.id === editingOptionId.value);
      const { menuUpdateModifierOption } = await import('@/api/menu/modifieroption/update');
      const updated = await menuUpdateModifierOption(menuToken, nsSlug.value, {
        id: editingOptionId.value,
        name: optionForm.name.trim(),
        price: optionForm.price,
        sortOrder: existing?.sortOrder ?? 0,
      });
      const idx = options.value.findIndex((o) => o.id === updated.id);
      if (idx !== -1) options.value[idx] = updated;
    } else {
      const nextSortOrder = options.value.length ? Math.max(...options.value.map((o) => o.sortOrder)) + 1 : 0;
      const { menuCreateModifierOption } = await import('@/api/menu/modifieroption/create');
      const created = await menuCreateModifierOption(menuToken, nsSlug.value, {
        groupId: selectedGroupId.value,
        name: optionForm.name.trim(),
        price: optionForm.price,
        sortOrder: nextSortOrder,
      });
      options.value = [...options.value, created];
    }
    resetOptionForm();
  } catch (e) {
    logError('[ModifierManagerModal] saveOption failed', e);
    useToast().add({ title: getErrorMessage(e) || 'Failed to save option', color: 'red' });
  } finally {
    optionSaving.value = false;
  }
}

async function removeOption(o: MenuModifierOption) {
  if (process.client && !window.confirm(t('menu.confirmDeleteModifierOption') || 'Delete this option?')) return;
  try {
    const menuToken = await getToken();
    const { menuDeleteModifierOption } = await import('@/api/menu/modifieroption/delete');
    await menuDeleteModifierOption(menuToken, nsSlug.value, o.id);
    options.value = options.value.filter((x) => x.id !== o.id);
    if (editingOptionId.value === o.id) resetOptionForm();
  } catch (e) {
    logError('[ModifierManagerModal] removeOption failed', e);
    useToast().add({ title: getErrorMessage(e) || 'Failed to delete option', color: 'red' });
  }
}

watch(() => props.modelValue, (open) => {
  if (open) {
    loadGroups();
    startNewGroup();
  }
});
</script>

<template>
  <UModal v-model="isOpen" :ui="{ width: 'sm:max-w-3xl' }">
    <UCard :ui="{ ring: '', divide: 'divide-y divide-gray-100 dark:divide-gray-800', body: { base: 'p-0 sm:p-0' } }">
      <template #header>
        <div class="flex items-center gap-3">
          <span class="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-100 dark:bg-primary-900/40 flex-shrink-0">
            <Icon name="lucide:list-plus" class="h-5 w-5 text-primary-600 dark:text-primary-300" />
          </span>
          <div class="min-w-0">
            <h3 class="text-base font-semibold leading-tight">
              {{ t('menu.modifiers') || 'Modifiers' }}
            </h3>
            <p class="text-xs text-gray-500 dark:text-gray-400 truncate">
              {{ t('menu.modifiersHint') || 'Extras and choices customers pick when adding an item — sizes, toppings, sauces' }}
            </p>
          </div>
        </div>
      </template>

      <div class="grid grid-cols-1 md:grid-cols-[220px_1fr] md:divide-x md:divide-gray-100 dark:md:divide-gray-800 max-h-[70vh] md:max-h-[65vh]">
        <!-- Groups list -->
        <div class="flex flex-col min-h-0 border-b md:border-b-0 border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-950/40">
          <div class="flex items-center justify-between px-4 pt-4 pb-2 flex-shrink-0">
            <span class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {{ t('menu.modifierGroups') || 'Groups' }}
            </span>
            <UTooltip :text="t('menu.addModifierGroup') || 'New group'">
              <UButton icon="lucide:plus" size="2xs" color="primary" variant="soft" @click="startNewGroup" />
            </UTooltip>
          </div>
          <div class="flex-1 overflow-y-auto px-2.5 pb-3">
            <div v-if="groupsLoading" class="flex items-center justify-center py-8">
              <UIcon name="lucide:loader-2" class="w-5 h-5 animate-spin text-gray-400" />
            </div>
            <div v-else-if="!groups.length" class="text-xs text-gray-500 dark:text-gray-400 px-2 py-4 text-center">
              {{ t('menu.noModifierGroups') || 'No modifier groups yet' }}
            </div>
            <div v-else class="space-y-1">
              <button
                v-for="g in groups"
                :key="g.id"
                type="button"
                class="group w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-sm transition-colors"
                :class="g.id === selectedGroupId
                  ? 'bg-white dark:bg-gray-900 text-primary-700 dark:text-primary-300 font-medium shadow-sm ring-1 ring-primary-100 dark:ring-primary-900/50'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-white/70 dark:hover:bg-gray-900/50'"
                @click="selectGroup(g)"
              >
                <Icon :name="g.type === 'multi' ? 'lucide:list-checks' : 'lucide:circle-dot'" class="h-3.5 w-3.5 flex-shrink-0 opacity-60" />
                <span class="truncate flex-1">{{ g.name }}</span>
                <UButton
                  icon="lucide:trash-2"
                  size="2xs"
                  color="red"
                  variant="ghost"
                  class="hidden group-hover:flex flex-shrink-0"
                  @click.stop="removeGroup(g)"
                />
              </button>
            </div>
          </div>
        </div>

        <!-- Group form + options -->
        <div class="overflow-y-auto p-5 space-y-5">
          <div class="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            <Icon :name="editingGroupId ? 'lucide:pencil' : 'lucide:sparkles'" class="h-3.5 w-3.5" />
            {{ editingGroupId ? (t('menu.editModifierGroup') || 'Edit group') : (t('menu.addModifierGroup') || 'New group') }}
          </div>

          <UFormGroup :label="t('menu.name') || 'Name'" required>
            <UInput v-model="groupForm.name" size="lg" :placeholder="t('menu.modifierNamePlaceholder') || 'e.g. Size, Toppings'" />
          </UFormGroup>

          <UFormGroup :label="t('menu.modifierType') || 'Selection type'">
            <div class="grid grid-cols-2 gap-2">
              <button
                type="button"
                class="flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors"
                :class="groupForm.type === 'single'
                  ? 'border-primary-300 dark:border-primary-700 bg-primary-50 dark:bg-primary-950/30 text-primary-700 dark:text-primary-300'
                  : 'border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-700'"
                @click="groupForm.type = 'single'"
              >
                <Icon name="lucide:circle-dot" class="h-4 w-4 flex-shrink-0" />
                {{ t('menu.modifierTypeSingle') || 'Single choice' }}
              </button>
              <button
                type="button"
                class="flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors"
                :class="groupForm.type === 'multi'
                  ? 'border-primary-300 dark:border-primary-700 bg-primary-50 dark:bg-primary-950/30 text-primary-700 dark:text-primary-300'
                  : 'border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-700'"
                @click="groupForm.type = 'multi'"
              >
                <Icon name="lucide:list-checks" class="h-4 w-4 flex-shrink-0" />
                {{ t('menu.modifierTypeMulti') || 'Multiple choice' }}
              </button>
            </div>
          </UFormGroup>

          <label class="flex items-center gap-2 text-sm cursor-pointer w-fit">
            <UCheckbox v-model="groupForm.isRequired" />
            {{ t('menu.modifierRequiredHint') || 'Customer must pick one' }}
          </label>

          <div v-if="groupForm.type === 'multi'" class="grid grid-cols-2 gap-3">
            <UFormGroup :label="t('menu.modifierMinSelect') || 'Min selections'">
              <UInput v-model.number="groupForm.minSelect" type="number" min="0" size="lg" />
            </UFormGroup>
            <UFormGroup :label="t('menu.modifierMaxSelect') || 'Max selections'">
              <UInput v-model.number="groupForm.maxSelect" type="number" min="0" size="lg" :placeholder="t('menu.unbounded') || 'Unbounded'" />
            </UFormGroup>
          </div>

          <div class="flex justify-end">
            <UButton color="primary" :icon="editingGroupId ? 'lucide:check' : 'lucide:plus'" :loading="groupSaving" :disabled="!isGroupFormValid || groupSaving" @click="saveGroup">
              {{ editingGroupId ? (t('app.save') || 'Save') : (t('menu.addModifierGroup') || 'Create group') }}
            </UButton>
          </div>

          <!-- Options for the selected (already-saved) group -->
          <div v-if="editingGroupId" class="pt-4 border-t border-gray-100 dark:border-gray-800 space-y-3">
            <div class="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              <Icon name="lucide:tags" class="h-3.5 w-3.5" />
              {{ t('menu.modifierOptions') || 'Options' }}
            </div>
            <div v-if="optionsLoading" class="flex items-center justify-center py-4">
              <UIcon name="lucide:loader-2" class="w-4 h-4 animate-spin text-gray-400" />
            </div>
            <div v-else-if="!options.length" class="text-xs text-gray-500 dark:text-gray-400 rounded-xl border border-dashed border-gray-200 dark:border-gray-800 px-3 py-4 text-center">
              {{ t('menu.noModifierOptions') || 'No options yet — add the first one below' }}
            </div>
            <div v-else class="rounded-xl border border-gray-100 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800 overflow-hidden">
              <div
                v-for="o in options"
                :key="o.id"
                class="group flex items-center justify-between gap-2 px-3 py-2 text-sm transition-colors"
                :class="editingOptionId === o.id ? 'bg-primary-50 dark:bg-primary-950/30' : 'bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/50'"
              >
                <span class="truncate">{{ o.name }}</span>
                <div class="flex items-center gap-1 flex-shrink-0">
                  <span class="text-xs text-gray-500 dark:text-gray-400 tabular-nums mr-1">{{ o.price }}</span>
                  <UButton icon="lucide:pencil" size="2xs" color="gray" variant="ghost" @click="editOption(o)" />
                  <UButton icon="lucide:trash-2" size="2xs" color="red" variant="ghost" @click="removeOption(o)" />
                </div>
              </div>
            </div>

            <div class="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-950/40 p-3 flex flex-col sm:flex-row sm:items-end gap-2">
              <UFormGroup :label="t('menu.name') || 'Name'" class="flex-1">
                <UInput v-model="optionForm.name" size="sm" :placeholder="t('menu.modifierOptionPlaceholder') || 'e.g. Large'" />
              </UFormGroup>
              <UFormGroup :label="t('menu.price') || 'Price'" class="sm:w-24">
                <UInput v-model.number="optionForm.price" type="number" step="0.01" size="sm" />
              </UFormGroup>
              <div class="flex items-center gap-1.5 flex-shrink-0">
                <UButton
                  :icon="editingOptionId ? 'lucide:check' : 'lucide:plus'"
                  size="sm"
                  color="primary"
                  class="flex-1 sm:flex-initial justify-center"
                  :loading="optionSaving"
                  :disabled="!isOptionFormValid || optionSaving"
                  @click="saveOption"
                >
                  {{ editingOptionId ? (t('app.save') || 'Save') : (t('app.add') || 'Add') }}
                </UButton>
                <UButton v-if="editingOptionId" icon="lucide:x" size="sm" color="gray" variant="ghost" @click="resetOptionForm" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end">
          <UButton color="gray" variant="ghost" @click="isOpen = false">
            {{ t('app.close') || 'Close' }}
          </UButton>
        </div>
      </template>
    </UCard>
  </UModal>
</template>
