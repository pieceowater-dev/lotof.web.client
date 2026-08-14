<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import type { MenuCategory } from '@/api/menu/category/list';

const { t } = useI18n();

const props = defineProps<{
  modelValue: boolean;
  category?: MenuCategory | null;
  categories?: MenuCategory[];
  saving?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
  (e: 'submit', payload: Record<string, any>): void;
}>();

const isOpen = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
});

// ISO weekday numbers (1=Mon..7=Sun), matching the backend's AvailableDays
// format -- ordered to line up with the day-picker buttons below.
const DAY_NUMBERS = [1, 2, 3, 4, 5, 6, 7] as const;
const DAY_LABEL_KEYS = ['dayMon', 'dayTue', 'dayWed', 'dayThu', 'dayFri', 'daySat', 'daySun'] as const;

const form = reactive({
  name: '',
  parentId: '' as string, // '' = root category
  restrictTime: false,
  availableFrom: '09:00',
  availableTo: '21:00',
  restrictDays: false,
  availableDays: [] as number[],
});

// A category that already has children of its own can't also become a
// child (the backend/UI only support one level of nesting) -- forcing it
// to stay root here is simpler and safer than letting a save silently
// orphan its children's depth invariant.
const editingHasChildren = computed(() => {
  if (!props.category) return false;
  return (props.categories || []).some((c) => c.parentId === props.category!.id);
});

// Only root categories can be picked as a parent -- picking an
// already-nested category would create a third level, which nothing in
// the storefront or this form is built to display.
const parentOptions = computed(() => {
  return (props.categories || [])
    .filter((c) => !c.parentId && c.id !== props.category?.id)
    .map((c) => ({ label: c.name, value: c.id }));
});

watch(() => [props.modelValue, props.category], () => {
  if (!props.modelValue) return;
  form.name = props.category?.name || '';
  form.parentId = props.category?.parentId || '';
  form.availableFrom = props.category?.availableFrom || '09:00';
  form.availableTo = props.category?.availableTo || '21:00';
  form.restrictTime = !!(props.category?.availableFrom && props.category?.availableTo);
  let days: number[] = [];
  try {
    const parsed = props.category?.availableDays ? JSON.parse(props.category.availableDays) : [];
    if (Array.isArray(parsed)) days = parsed.filter((d) => Number.isInteger(d) && d >= 1 && d <= 7);
  } catch {}
  form.availableDays = days;
  form.restrictDays = days.length > 0;
}, { immediate: true });

const isFormValid = computed(() => form.name.trim().length > 0);

function toggleDay(day: number) {
  const idx = form.availableDays.indexOf(day);
  if (idx >= 0) form.availableDays.splice(idx, 1);
  else form.availableDays.push(day);
}

function handleClose() {
  isOpen.value = false;
}

function handleSubmit() {
  if (!isFormValid.value) return;
  emit('submit', {
    name: form.name.trim(),
    parentId: editingHasChildren.value ? '' : form.parentId,
    availableFrom: form.restrictTime ? form.availableFrom : '',
    availableTo: form.restrictTime ? form.availableTo : '',
    availableDays: form.restrictDays && form.availableDays.length > 0
      ? JSON.stringify([...form.availableDays].sort((a, b) => a - b))
      : '',
  });
}
</script>

<template>
  <UModal v-model="isOpen" @close="handleClose">
    <UCard :ui="{ ring: '', divide: 'divide-y divide-gray-100 dark:divide-gray-800' }">
      <template #header>
        <h3 class="text-lg font-semibold">
          {{ category ? (t('menu.editCategory') || 'Edit category') : (t('menu.createCategory') || 'Add category') }}
        </h3>
      </template>

      <div class="space-y-4">
        <UFormGroup :label="t('menu.name') || 'Name'" required>
          <UInput v-model="form.name" size="lg" />
        </UFormGroup>

        <UFormGroup :label="t('menu.parentCategory') || 'Parent category'">
          <USelectMenu
            v-model="form.parentId"
            :options="[{ label: t('menu.noParentCategory') || 'None (top-level)', value: '' }, ...parentOptions]"
            value-attribute="value"
            option-attribute="label"
            :disabled="editingHasChildren"
          />
          <p v-if="editingHasChildren" class="mt-1 text-xs text-gray-400">
            {{ t('menu.parentCategoryDisabledHint') || 'This category already has subcategories of its own, so it can\'t also be nested under another one.' }}
          </p>
        </UFormGroup>

        <div class="flex items-center justify-between">
          <span class="text-sm font-medium">{{ t('menu.restrictByTime') || 'Restrict by time of day' }}</span>
          <UToggle v-model="form.restrictTime" />
        </div>
        <div v-if="form.restrictTime" class="flex items-center gap-2">
          <UInput v-model="form.availableFrom" type="time" size="md" class="w-32" />
          <span class="text-gray-400 text-sm">{{ t('menu.timeRangeDash') || '—' }}</span>
          <UInput v-model="form.availableTo" type="time" size="md" class="w-32" />
        </div>

        <div class="flex items-center justify-between">
          <span class="text-sm font-medium">{{ t('menu.restrictByDays') || 'Restrict by day of week' }}</span>
          <UToggle v-model="form.restrictDays" />
        </div>
        <div v-if="form.restrictDays" class="flex flex-wrap gap-1.5">
          <button
            v-for="(day, i) in DAY_NUMBERS"
            :key="day"
            type="button"
            class="w-10 h-9 rounded-lg text-xs font-medium border transition-colors"
            :class="form.availableDays.includes(day)
              ? 'bg-primary-500 border-primary-500 text-white'
              : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'"
            @click="toggleDay(day)"
          >
            {{ t('menu.' + DAY_LABEL_KEYS[i]) }}
          </button>
        </div>
        <p v-if="form.restrictDays && form.availableDays.length === 0" class="text-xs text-amber-500">
          {{ t('menu.restrictByDaysEmptyHint') || 'Pick at least one day, or the category will never show up.' }}
        </p>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton color="gray" variant="ghost" :label="t('app.cancel')" @click="handleClose" />
          <UButton
            color="primary"
            :label="saving ? (t('app.loading') || 'Loading...') : (t('app.save') || 'Save')"
            :loading="saving"
            :disabled="!isFormValid || saving"
            @click="handleSubmit"
          />
        </div>
      </template>
    </UCard>
  </UModal>
</template>
