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
  <UModal v-model="isOpen" :ui="{ width: 'sm:max-w-2xl' }">
    <UCard :ui="{ ring: '', divide: 'divide-y divide-gray-100 dark:divide-gray-800' }">
      <template #header>
        <div class="flex items-center gap-2.5">
          <span class="flex h-8 w-8 items-center justify-center rounded-xl bg-primary-100 dark:bg-primary-900/40">
            <Icon name="lucide:list-plus" class="h-4 w-4 text-primary-600 dark:text-primary-300" />
          </span>
          <h3 class="text-lg font-semibold">
            {{ t('menu.modifiers') || 'Modifiers' }}
          </h3>
        </div>
      </template>

      <div class="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-4">
        <!-- Groups list -->
        <div class="border-b md:border-b-0 md:border-r border-gray-100 dark:border-gray-800 pb-4 md:pb-0 md:pr-4">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {{ t('menu.modifierGroups') || 'Groups' }}
            </span>
            <UButton icon="lucide:plus" size="2xs" color="primary" variant="soft" @click="startNewGroup" />
          </div>
          <div v-if="groupsLoading" class="flex items-center justify-center py-6">
            <UIcon name="lucide:loader-2" class="w-5 h-5 animate-spin text-gray-400" />
          </div>
          <div v-else-if="!groups.length" class="text-xs text-gray-500 dark:text-gray-400 py-2">
            {{ t('menu.noModifierGroups') || 'No modifier groups yet' }}
          </div>
          <div v-else class="space-y-0.5">
            <div
              v-for="g in groups"
              :key="g.id"
              class="group flex items-center justify-between px-2 py-1.5 rounded-lg cursor-pointer text-sm"
              :class="g.id === selectedGroupId
                ? 'bg-primary-50 dark:bg-primary-950/30 text-primary-700 dark:text-primary-300 font-medium'
                : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'"
              @click="selectGroup(g)"
            >
              <span class="truncate">{{ g.name }}</span>
              <UButton
                icon="lucide:trash-2"
                size="2xs"
                color="red"
                variant="ghost"
                class="hidden group-hover:flex flex-shrink-0"
                @click.stop="removeGroup(g)"
              />
            </div>
          </div>
        </div>

        <!-- Group form + options -->
        <div class="space-y-4">
          <div class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {{ editingGroupId ? (t('menu.editModifierGroup') || 'Edit group') : (t('menu.addModifierGroup') || 'New group') }}
          </div>

          <UFormGroup :label="t('menu.name') || 'Name'" required>
            <UInput v-model="groupForm.name" size="lg" />
          </UFormGroup>

          <div class="grid grid-cols-2 gap-3">
            <UFormGroup :label="t('menu.modifierType') || 'Selection type'">
              <div class="flex rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
                <button
                  type="button"
                  class="flex-1 px-2 py-1.5 text-xs font-medium transition-colors"
                  :class="groupForm.type === 'single' ? 'bg-primary-500 text-white' : 'bg-transparent text-gray-500 dark:text-gray-400'"
                  @click="groupForm.type = 'single'"
                >
                  {{ t('menu.modifierTypeSingle') || 'Single choice' }}
                </button>
                <button
                  type="button"
                  class="flex-1 px-2 py-1.5 text-xs font-medium transition-colors"
                  :class="groupForm.type === 'multi' ? 'bg-primary-500 text-white' : 'bg-transparent text-gray-500 dark:text-gray-400'"
                  @click="groupForm.type = 'multi'"
                >
                  {{ t('menu.modifierTypeMulti') || 'Multiple choice' }}
                </button>
              </div>
            </UFormGroup>
            <UFormGroup :label="t('menu.isRequired') || 'Required'">
              <label class="flex items-center gap-1.5 h-9 text-sm cursor-pointer">
                <UCheckbox v-model="groupForm.isRequired" />
                {{ t('menu.modifierRequiredHint') || 'Customer must pick one' }}
              </label>
            </UFormGroup>
          </div>

          <div v-if="groupForm.type === 'multi'" class="grid grid-cols-2 gap-3">
            <UFormGroup :label="t('menu.modifierMinSelect') || 'Min selections'">
              <UInput v-model.number="groupForm.minSelect" type="number" min="0" size="lg" />
            </UFormGroup>
            <UFormGroup :label="t('menu.modifierMaxSelect') || 'Max selections'">
              <UInput v-model.number="groupForm.maxSelect" type="number" min="0" size="lg" :placeholder="t('menu.unbounded') || 'Unbounded'" />
            </UFormGroup>
          </div>

          <div class="flex justify-end">
            <UButton color="primary" size="sm" :loading="groupSaving" :disabled="!isGroupFormValid || groupSaving" @click="saveGroup">
              {{ editingGroupId ? (t('app.save') || 'Save') : (t('menu.addModifierGroup') || 'Create group') }}
            </UButton>
          </div>

          <!-- Options for the selected (already-saved) group -->
          <div v-if="editingGroupId" class="pt-3 border-t border-gray-100 dark:border-gray-800 space-y-2">
            <div class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {{ t('menu.modifierOptions') || 'Options' }}
            </div>
            <div v-if="optionsLoading" class="flex items-center justify-center py-4">
              <UIcon name="lucide:loader-2" class="w-4 h-4 animate-spin text-gray-400" />
            </div>
            <div v-else-if="!options.length" class="text-xs text-gray-500 dark:text-gray-400">
              {{ t('menu.noModifierOptions') || 'No options yet' }}
            </div>
            <div v-else class="space-y-1">
              <div
                v-for="o in options"
                :key="o.id"
                class="group flex items-center justify-between px-2 py-1 rounded-lg text-sm"
                :class="editingOptionId === o.id ? 'bg-primary-50 dark:bg-primary-950/30' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'"
              >
                <span class="truncate">{{ o.name }}</span>
                <div class="flex items-center gap-2 flex-shrink-0">
                  <span class="text-xs text-gray-500 dark:text-gray-400 tabular-nums">{{ o.price }}</span>
                  <UButton icon="lucide:pencil" size="2xs" color="gray" variant="ghost" @click="editOption(o)" />
                  <UButton icon="lucide:trash-2" size="2xs" color="red" variant="ghost" @click="removeOption(o)" />
                </div>
              </div>
            </div>

            <div class="flex items-end gap-2 pt-2">
              <UFormGroup :label="t('menu.name') || 'Name'" class="flex-1">
                <UInput v-model="optionForm.name" size="sm" />
              </UFormGroup>
              <UFormGroup :label="t('menu.price') || 'Price'" class="w-24">
                <UInput v-model.number="optionForm.price" type="number" step="0.01" size="sm" />
              </UFormGroup>
              <UButton
                :icon="editingOptionId ? 'lucide:check' : 'lucide:plus'"
                size="sm"
                color="primary"
                :loading="optionSaving"
                :disabled="!isOptionFormValid || optionSaving"
                @click="saveOption"
              />
              <UButton v-if="editingOptionId" icon="lucide:x" size="sm" color="gray" variant="ghost" @click="resetOptionForm" />
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
