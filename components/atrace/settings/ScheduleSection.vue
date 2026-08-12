<script lang="ts" setup>
import AppTable from '@/components/ui/AppTable.vue';
import { useI18n } from '@/composables/useI18n';
import { useAtraceMembers } from '@/composables/useAtraceMembers';
import { isAtracePermissionError } from '@/utils/atracePermissions';
import type { AtraceShiftPattern, AtraceScheduleAssignment } from '@/api/atrace/schedule/schedule';
import { useNamespace } from '@/composables/useNamespace';
import QuickSetupButton from '@/components/onboarding/QuickSetupButton.vue';
import type { BusinessType } from '@/config/businessTypes';

const { t, locale } = useI18n();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);
const { idBySlug } = useNamespace();
const namespaceId = computed(() => idBySlug(nsSlug.value));

const { members, loadMembers } = useAtraceMembers(nsSlug);
// Schedules only make sense for people currently working -- an inactive
// member shouldn't be assignable a new shift pattern.
const activeMembers = computed(() => members.value.filter((m) => m.isActive));
const patterns = ref<AtraceShiftPattern[]>([]);
const assignments = ref<AtraceScheduleAssignment[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const saving = ref(false);

// -- Pattern create/edit modal --
const showPatternModal = ref(false);
const editingPattern = ref<AtraceShiftPattern | null>(null);

const WEEKDAYS = [
  { value: 1, label: 'Пн' }, { value: 2, label: 'Вт' }, { value: 3, label: 'Ср' },
  { value: 4, label: 'Чт' }, { value: 5, label: 'Пт' }, { value: 6, label: 'Сб' }, { value: 7, label: 'Вс' },
];

function emptyPatternForm(): AtraceShiftPattern {
  return {
    id: '',
    name: '',
    type: 'FIXED_WEEKDAYS',
    workDaysOfWeek: [1, 2, 3, 4, 5],
    rotationWorkDays: 2,
    rotationOffDays: 2,
    rotationAnchorDate: new Date().toISOString().split('T')[0],
    shiftStartTime: '09:00',
    shiftEndTime: '18:00',
    lateThreshold: '',
    earlyLeaveThreshold: '',
    requiredHoursPerDay: 8,
    comment: '',
  };
}
const patternForm = ref<AtraceShiftPattern>(emptyPatternForm());

// -- Assignment modal --
const showAssignModal = ref(false);
const formUserIds = ref<string[]>([]);
const formPatternId = ref('');
const formEffectiveFrom = ref(new Date().toISOString().split('T')[0]);
const formComment = ref('');

const allMembersSelected = computed({
  get: () => activeMembers.value.length > 0 && formUserIds.value.length === activeMembers.value.length,
  set: (val: boolean) => {
    formUserIds.value = val ? activeMembers.value.map((m) => m.userId) : [];
  },
});

const patternColumns = computed(() => ([
  { key: 'name', label: t('common.name') || 'Название' },
  { key: 'type', label: t('app.scheduleType') || 'Тип' },
  { key: 'summary', label: t('app.scheduleSummary') || 'Параметры' },
  { key: 'requiredHoursPerDay', label: t('app.requiredWorkingHours') || 'Часов в день' },
  { key: 'assignedCount', label: t('app.assignedEmployees') || 'Назначено' },
  { key: 'actions', label: t('common.actions') },
]));

const assignmentColumns = computed(() => ([
  { key: 'userName', label: t('app.user') || 'Сотрудник' },
  { key: 'patternName', label: t('app.shiftPattern') || 'График' },
  { key: 'effectiveFrom', label: t('app.effectiveFrom') || 'Действует с' },
  { key: 'effectiveTo', label: t('app.effectiveTo') || 'Действует по' },
  { key: 'actions', label: t('common.actions') },
]));

const memberNameById = computed(() => {
  const map = new Map<string, string>();
  members.value.forEach(m => map.set(m.userId, m.nickname || m.username || m.email || m.userId));
  return map;
});
const patternNameById = computed(() => {
  const map = new Map<string, string>();
  patterns.value.forEach(p => map.set(p.id, p.name));
  return map;
});

const activeAssignments = computed(() => {
  const today = new Date().toISOString().split('T')[0];
  return assignments.value.filter(a => !a.effectiveTo || a.effectiveTo >= today);
});

const assignedCountByPattern = computed(() => {
  const map = new Map<string, number>();
  activeAssignments.value.forEach(a => map.set(a.shiftPatternId, (map.get(a.shiftPatternId) || 0) + 1));
  return map;
});

const patternRows = computed(() => patterns.value.map(p => ({
  ...p,
  assignedCount: assignedCountByPattern.value.get(p.id) || 0,
})));

const assignmentRows = computed(() => activeAssignments.value.map(a => ({
  ...a,
  userName: memberNameById.value.get(a.userId) || a.userId,
  patternName: patternNameById.value.get(a.shiftPatternId) || a.shiftPatternId,
})));

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const { atraceGetShiftPatterns, atraceGetScheduleAssignments } = await import('@/api/atrace/schedule/schedule');
    const [p, a] = await Promise.all([
      atraceGetShiftPatterns(undefined, nsSlug.value),
      atraceGetScheduleAssignments(undefined, nsSlug.value),
    ]);
    patterns.value = p;
    assignments.value = a;
  } catch (e: any) {
    error.value = isAtracePermissionError(e, 'tracker.schedule.view')
      ? (t('app.schedulePermissionError') || 'Недостаточно прав для просмотра графиков')
      : (t('app.attendanceLoadFailed') || 'Не удалось загрузить');
  } finally {
    loading.value = false;
  }
}

async function applyShiftPatternPreset(businessType: BusinessType) {
  const { atraceApplyShiftPatternPreset } = await import('@/api/atrace/schedule/schedule');
  await atraceApplyShiftPatternPreset(businessType, locale.value, nsSlug.value);
  await load();
}

function openCreatePattern() {
  editingPattern.value = null;
  patternForm.value = emptyPatternForm();
  showPatternModal.value = true;
}

function openEditPattern(pattern: AtraceShiftPattern) {
  editingPattern.value = pattern;
  patternForm.value = {
    ...pattern,
    workDaysOfWeek: pattern.workDaysOfWeek ? [...pattern.workDaysOfWeek] : [],
    lateThreshold: pattern.lateThreshold || '',
    earlyLeaveThreshold: pattern.earlyLeaveThreshold || '',
    comment: pattern.comment || '',
  };
  showPatternModal.value = true;
}

function toggleWeekday(day: number) {
  const days = patternForm.value.workDaysOfWeek || [];
  const idx = days.indexOf(day);
  if (idx >= 0) days.splice(idx, 1);
  else days.push(day);
  patternForm.value.workDaysOfWeek = [...days].sort();
}

async function savePattern() {
  saving.value = true;
  error.value = null;
  try {
    if (editingPattern.value) {
      const { atraceUpdateShiftPattern } = await import('@/api/atrace/schedule/schedule');
      await atraceUpdateShiftPattern(patternForm.value, nsSlug.value);
    } else {
      const { atraceCreateShiftPattern } = await import('@/api/atrace/schedule/schedule');
      const { id, ...rest } = patternForm.value;
      await atraceCreateShiftPattern(rest, nsSlug.value);
    }
    showPatternModal.value = false;
    await load();
  } catch (e: any) {
    error.value = isAtracePermissionError(e, 'tracker.schedule.manage')
      ? (t('app.schedulePermissionError') || 'Недостаточно прав')
      : (t('app.saveFailed') || 'Не удалось сохранить');
  } finally {
    saving.value = false;
  }
}

async function removePattern(pattern: AtraceShiftPattern) {
  try {
    const { atraceDeleteShiftPattern } = await import('@/api/atrace/schedule/schedule');
    await atraceDeleteShiftPattern(pattern.id, nsSlug.value);
    await load();
  } catch (e: any) {
    error.value = isAtracePermissionError(e, 'tracker.schedule.manage')
      ? (t('app.schedulePermissionError') || 'Недостаточно прав')
      : (t('app.saveFailed') || 'Не удалось удалить');
  }
}

function summary(p: AtraceShiftPattern): string {
  if (p.type === 'FIXED_WEEKDAYS') {
    const names = (p.workDaysOfWeek || []).map(d => WEEKDAYS.find(w => w.value === d)?.label || d).join(', ');
    return `${names} · ${p.shiftStartTime}-${p.shiftEndTime}`;
  }
  return `${p.rotationWorkDays}/${p.rotationOffDays} · ${p.shiftStartTime}-${p.shiftEndTime}`;
}

function openAssign(pattern?: AtraceShiftPattern) {
  formUserIds.value = [];
  formPatternId.value = pattern?.id || patterns.value[0]?.id || '';
  formEffectiveFrom.value = new Date().toISOString().split('T')[0];
  formComment.value = '';
  showAssignModal.value = true;
}

async function assign() {
  if (!formUserIds.value.length || !formPatternId.value) return;
  saving.value = true;
  error.value = null;
  try {
    const { atraceAssignSchedule } = await import('@/api/atrace/schedule/schedule');
    // No bulk-assign mutation on the backend -- fan out one call per selected
    // employee instead. Fine at this scale (a namespace's whole staff list).
    await Promise.all(formUserIds.value.map((userId) =>
      atraceAssignSchedule(userId, formPatternId.value, formEffectiveFrom.value, undefined, formComment.value, nsSlug.value)
    ));
    showAssignModal.value = false;
    await load();
  } catch (e: any) {
    error.value = isAtracePermissionError(e, 'tracker.schedule.manage')
      ? (t('app.schedulePermissionError') || 'Недостаточно прав')
      : (t('app.saveFailed') || 'Не удалось сохранить');
  } finally {
    saving.value = false;
  }
}

async function unassign(assignment: AtraceScheduleAssignment) {
  try {
    const { atraceEndScheduleAssignment } = await import('@/api/atrace/schedule/schedule');
    const today = new Date().toISOString().split('T')[0];
    await atraceEndScheduleAssignment(assignment.id, today, nsSlug.value);
    await load();
  } catch (e: any) {
    error.value = isAtracePermissionError(e, 'tracker.schedule.manage')
      ? (t('app.schedulePermissionError') || 'Недостаточно прав')
      : (t('app.saveFailed') || 'Не удалось снять назначение');
  }
}

onMounted(async () => {
  await loadMembers();
  await load();
});
</script>

<template>
  <div class="flex-1 min-h-0 flex flex-col gap-6 overflow-auto pb-safe-or-4">
    <div
      v-if="error"
      class="p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-700 dark:text-red-200"
    >
      {{ error }}
    </div>

    <!-- Patterns -->
    <div>
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-base font-medium">
          {{ t('app.shiftPatterns') || 'Графики работы' }}
        </h2>
        <UButton
          size="xs"
          color="primary"
          icon="lucide:plus"
          @click="openCreatePattern"
        >
          {{ t('app.createSchedule') || 'Создать график' }}
        </UButton>
      </div>

      <div
        v-if="loading && patterns.length === 0"
        class="text-gray-500 text-sm"
      >
        {{ t('app.loading') }}
      </div>
      <div
        v-else-if="patterns.length === 0"
        class="text-gray-500 text-center py-8 border border-dashed rounded-lg dark:border-gray-700 space-y-3"
      >
        <p>{{ t('app.noSchedules') || 'Графики ещё не созданы' }}</p>
        <div v-if="namespaceId" class="flex justify-center">
          <QuickSetupButton :namespace-id="namespaceId" :on-apply="applyShiftPatternPreset" />
        </div>
      </div>
      <div
        v-else
        class="h-[360px]"
      >
        <AppTable
          :rows="patternRows"
          :columns="patternColumns"
          :loading="loading"
          :total="patternRows.length"
          :pagination="false"
        >
          <template #type-data="{ row }">
            {{ row.type === 'FIXED_WEEKDAYS' ? (t('app.fixedWeekdays') || 'Фикс. дни недели') : (t('app.rotating') || 'Ротация N/M') }}
          </template>
          <template #summary-data="{ row }">
            <span class="text-xs text-gray-600 dark:text-gray-400">{{ summary(row) }}</span>
          </template>
          <template #assignedCount-data="{ row }">
            <span
              v-if="row.assignedCount > 0"
              class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-200"
            >
              {{ row.assignedCount }}
            </span>
            <span
              v-else
              class="text-gray-400 text-xs"
            >—</span>
          </template>
          <template #actions-data="{ row }">
            <div class="flex justify-end gap-1">
              <UButton
                size="xs"
                variant="soft"
                color="emerald"
                icon="lucide:user-plus"
                @click="openAssign(row)"
              >
                {{ t('app.assign') || 'Назначить' }}
              </UButton>
              <UButton
                size="xs"
                variant="soft"
                color="primary"
                icon="lucide:pencil"
                @click="openEditPattern(row)"
              />
              <UButton
                size="xs"
                variant="soft"
                color="red"
                icon="lucide:trash-2"
                @click="removePattern(row)"
              />
            </div>
          </template>
        </AppTable>
      </div>
    </div>

    <!-- Assignments -->
    <div>
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-base font-medium">
          {{ t('app.scheduleAssignments') || 'Назначения графиков' }}
        </h2>
        <UButton
          size="xs"
          color="primary"
          variant="soft"
          icon="lucide:plus"
          :disabled="patterns.length === 0"
          @click="openAssign()"
        >
          {{ t('app.assignSchedule') || 'Назначить график' }}
        </UButton>
      </div>

      <div
        v-if="!loading && assignmentRows.length === 0"
        class="text-gray-500 text-center py-8 border border-dashed rounded-lg dark:border-gray-700"
      >
        {{ t('app.noAssignments') || 'Назначений пока нет' }}
      </div>
      <div
        v-else
        class="h-[360px]"
      >
        <AppTable
          :rows="assignmentRows"
          :columns="assignmentColumns"
          :loading="loading"
          :total="assignmentRows.length"
          :pagination="false"
        >
          <template #effectiveTo-data="{ row }">
            <span v-if="row.effectiveTo">{{ row.effectiveTo }}</span>
            <span
              v-else
              class="text-gray-400"
            >{{ t('app.ongoing') || 'бессрочно' }}</span>
          </template>
          <template #actions-data="{ row }">
            <div class="flex justify-end">
              <UButton
                size="xs"
                variant="soft"
                color="red"
                icon="lucide:x"
                @click="unassign(row)"
              >
                {{ t('app.unassign') || 'Снять' }}
              </UButton>
            </div>
          </template>
        </AppTable>
      </div>
    </div>

    <!-- Pattern create/edit modal -->
    <UModal
      v-model="showPatternModal"
      :ui="{ width: 'w-full sm:max-w-xl' }"
    >
      <UCard>
        <template #header>
          <h3 class="text-base font-semibold">
            {{ editingPattern ? (t('common.edit') || 'Редактировать') : (t('app.createSchedule') || 'Создать график') }}
          </h3>
        </template>

        <div class="flex flex-col gap-3">
          <UFormGroup :label="t('common.name') || 'Название'">
            <UInput
              v-model="patternForm.name"
              placeholder="Смена завода 5/2"
            />
          </UFormGroup>

          <UFormGroup :label="t('app.scheduleType') || 'Тип графика'">
            <USelectMenu
              v-model="patternForm.type"
              :options="['FIXED_WEEKDAYS', 'ROTATING']"
            >
              <template #option="{ option }">
                {{ option === 'FIXED_WEEKDAYS' ? (t('app.fixedWeekdays') || 'Фикс. дни недели') : (t('app.rotating') || 'Ротация N/M') }}
              </template>
              <template #label>
                {{ patternForm.type === 'FIXED_WEEKDAYS' ? (t('app.fixedWeekdays') || 'Фикс. дни недели') : (t('app.rotating') || 'Ротация N/M') }}
              </template>
            </USelectMenu>
          </UFormGroup>

          <div v-if="patternForm.type === 'FIXED_WEEKDAYS'">
            <label class="text-sm font-medium mb-2 block">{{ t('app.workDays') || 'Рабочие дни' }}</label>
            <div class="flex flex-wrap gap-1.5">
              <UButton
                v-for="wd in WEEKDAYS"
                :key="wd.value"
                size="xs"
                :color="(patternForm.workDaysOfWeek || []).includes(wd.value) ? 'primary' : 'gray'"
                :variant="(patternForm.workDaysOfWeek || []).includes(wd.value) ? 'solid' : 'soft'"
                @click="toggleWeekday(wd.value)"
              >
                {{ wd.label }}
              </UButton>
            </div>
          </div>

          <div
            v-else
            class="grid grid-cols-1 sm:grid-cols-3 gap-3"
          >
            <UFormGroup :label="t('app.rotationWorkDays') || 'Рабочих дней'">
              <UInput
                v-model.number="patternForm.rotationWorkDays"
                type="number"
                min="1"
              />
            </UFormGroup>
            <UFormGroup :label="t('app.rotationOffDays') || 'Выходных дней'">
              <UInput
                v-model.number="patternForm.rotationOffDays"
                type="number"
                min="1"
              />
            </UFormGroup>
            <UFormGroup :label="t('app.rotationAnchorDate') || 'Дата отсчёта'">
              <input
                v-model="patternForm.rotationAnchorDate"
                type="date"
                class="w-full px-2 py-1.5 border rounded dark:bg-gray-800 dark:border-gray-700 text-sm"
              >
            </UFormGroup>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <UFormGroup :label="t('app.shiftStartTime') || 'Начало смены'">
              <UInput
                v-model="patternForm.shiftStartTime"
                type="time"
              />
            </UFormGroup>
            <UFormGroup :label="t('app.shiftEndTime') || 'Конец смены'">
              <UInput
                v-model="patternForm.shiftEndTime"
                type="time"
              />
            </UFormGroup>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <UFormGroup :label="t('app.lateArrivalAfter') + ' (' + (t('common.optional') || 'опционально') + ')'">
              <UInput
                v-model="patternForm.lateThreshold"
                type="time"
              />
            </UFormGroup>
            <UFormGroup :label="t('app.earlyLeaveBefore') + ' (' + (t('common.optional') || 'опционально') + ')'">
              <UInput
                v-model="patternForm.earlyLeaveThreshold"
                type="time"
              />
            </UFormGroup>
          </div>

          <UFormGroup :label="t('app.requiredWorkingHours') || 'Часов в день'">
            <UInput
              v-model.number="patternForm.requiredHoursPerDay"
              type="number"
              min="1"
              step="0.5"
            />
          </UFormGroup>

          <UFormGroup :label="t('common.comment') || 'Комментарий'">
            <UInput v-model="patternForm.comment" />
          </UFormGroup>
        </div>

        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton
              variant="soft"
              color="gray"
              @click="showPatternModal = false"
            >
              {{ t('common.cancel') }}
            </UButton>
            <UButton
              color="primary"
              :loading="saving"
              @click="savePattern"
            >
              {{ t('app.save') }}
            </UButton>
          </div>
        </template>
      </UCard>
    </UModal>

    <!-- Assign modal -->
    <UModal
      v-model="showAssignModal"
      :ui="{ width: 'w-full sm:max-w-lg' }"
    >
      <UCard>
        <template #header>
          <h3 class="text-base font-semibold">
            {{ t('app.assignSchedule') || 'Назначить график' }}
          </h3>
        </template>

        <div class="flex flex-col gap-3">
          <UFormGroup :label="t('app.user') || 'Сотрудник'">
            <div class="flex flex-col gap-1.5">
              <USelectMenu
                v-model="formUserIds"
                multiple
                :options="activeMembers.map(m => ({ value: m.userId, label: m.nickname || m.username || m.email }))"
                value-attribute="value"
                option-attribute="label"
                searchable
              >
                <template #label>
                  <span class="truncate">
                    {{ formUserIds.length ? `${formUserIds.length} ${t('app.selected') || 'выбрано'}` : (t('app.user') || 'Сотрудник') }}
                  </span>
                </template>
              </USelectMenu>
              <UCheckbox
                v-model="allMembersSelected"
                :label="t('app.selectAllEmployees') || 'Выбрать всех'"
              />
            </div>
          </UFormGroup>
          <UFormGroup :label="t('app.shiftPattern') || 'График'">
            <USelectMenu
              v-model="formPatternId"
              :options="patterns.map(p => ({ value: p.id, label: p.name }))"
              value-attribute="value"
              option-attribute="label"
            />
          </UFormGroup>
          <UFormGroup :label="t('app.effectiveFrom') || 'Действует с'">
            <input
              v-model="formEffectiveFrom"
              type="date"
              class="w-full px-2 py-1.5 border rounded dark:bg-gray-800 dark:border-gray-700 text-sm"
            >
          </UFormGroup>
          <UFormGroup :label="t('common.comment') || 'Комментарий'">
            <UInput v-model="formComment" />
          </UFormGroup>
        </div>

        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton
              variant="soft"
              color="gray"
              @click="showAssignModal = false"
            >
              {{ t('common.cancel') }}
            </UButton>
            <UButton
              color="primary"
              :loading="saving"
              :disabled="!formUserIds.length || !formPatternId"
              @click="assign"
            >
              {{ t('app.save') }}
            </UButton>
          </div>
        </template>
      </UCard>
    </UModal>
  </div>
</template>
