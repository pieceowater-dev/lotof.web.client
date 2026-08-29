<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { log, logError } from '@/utils/logger';
import UserDayRecordsAccordion from '@/components/atrace/UserDayRecordsAccordion.vue';
import ShiftCoverageRequestModal from '@/components/atrace/ShiftCoverageRequestModal.vue';
import LeaveRequestModal from '@/components/atrace/LeaveRequestModal.vue';
import { useRoute } from 'vue-router';
import { isAtracePermissionError } from '@/utils/atracePermissions';
import { CURRENCIES, formatMoney } from '@/utils/currency';
import { useAtraceActiveMembers } from '@/composables/useAtraceActiveMembers';
import { useAtracePermissions } from '@/composables/useAtracePermissions';
import { CookieKeys } from '@/utils/storageKeys';
import { memberDisplayNameWithFallback } from '@/utils/memberDisplayName';

const { t, locale } = useI18n();

const currencyOptions = CURRENCIES.map((c) => ({ label: `${c.symbol}  ${c.code}`, value: c.code }));

function overtimeRateLabel(r: { calcType: string; multiplier: number; fixedAmountPerHour: number; currency: string }): string {
  return r.calcType === 'fixed' ? formatMoney(r.fixedAmountPerHour, r.currency) : `x${r.multiplier}`;
}

const props = defineProps<{
  postId: string | null;
  ready?: boolean;
}>();

const route = useRoute();
const namespaceSlug = computed(() => route.params.namespace as string | undefined);

type UserStats = {
  userId: string;
  username?: string;
  email?: string;
  workDays: number;
  attendedDays: number;
  violationDays: number;
  legitimateAbsences: number;
  totalWorkedHours: number;
  lateDays: number;
  earlyLeaveDays: number;
  hasScheduleAssignment: boolean;
  geoConfirmedDays: number;
  suspiciousDays: number;
};

const stats = ref<UserStats[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

// getAllUsersStats' username/email come from tracker's own hub lookup and
// don't carry the per-namespace nickname (that lives in hub.msvc.namespaces
// only) -- cross-referenced client-side here, same idea as
// LeaveRequestsSection's memberNameById, so this table doesn't show a raw
// Google account name a manager already renamed everywhere else.
const nicknameByUserId = ref<Map<string, string>>(new Map());

async function loadNicknames() {
  if (!namespaceSlug.value) return;
  try {
    const hubToken = useCookie<string | null>(CookieKeys.TOKEN, { path: '/' }).value;
    if (!hubToken) return;
    const { hubNamespaceBySlug } = await import('@/api/hub/namespaces/get');
    const namespace = await hubNamespaceBySlug(hubToken, namespaceSlug.value);
    if (!namespace) return;
    const { hubMembersList } = await import('@/api/hub/members/list');
    const { FilterPaginationLengthEnum } = await import('@/api/__generated__/hub-types');
    const members = await hubMembersList(hubToken, namespace.id, 1, FilterPaginationLengthEnum.OneHundred);
    const map = new Map<string, string>();
    for (const m of members) {
      if (m.nickname?.trim()) map.set(m.userId, m.nickname.trim());
    }
    nicknameByUserId.value = map;
  } catch (e) {
    logError('[AttendanceStatsTable] loadNicknames failed', e);
  }
}

function statUserDisplayName(user: { userId: string; username?: string; email?: string }): string {
  const nickname = nicknameByUserId.value.get(user.userId);
  return memberDisplayNameWithFallback({ nickname, username: user.username }, user.email, user.userId);
}

// getAllUsersStats has no isActive field of its own (it's sourced from Hub's
// member list on the backend, not Atrace's), so active-only filtering is
// cross-referenced client-side against a dedicated active-members lookup --
// an inactive employee shouldn't clutter attendance stats for managers/
// admins. Deliberately NOT useAtraceMembers(): that also joins role +
// schedule per member (one extra GraphQL call *per member*, N+1 over the
// whole namespace) which this view has no use for -- only isActive.
const { activeUserIds, loaded: activeMembersLoaded, loadActiveMembers } = useAtraceActiveMembers(computed(() => namespaceSlug.value || ''));

// Gates the per-row "Расчёт зарплаты" button -- it opens a modal that both
// reads and sets pay (tracker.salary.manage), not just views it, so a
// Teammate (who at most has salary/view for their own pay, via the /me page)
// must never see it, and neither should a Manager (salary is deliberately
// kept off that role entirely, see role.seeder.go).
const { can: canDo, loadPermissions } = useAtracePermissions(computed(() => namespaceSlug.value || ''));
const canManageSalary = computed(() => canDo('tracker.salary.manage'));
// Gates Export and the late/early-threshold Settings button: both write
// paths (exportDailyAttendance, updateAttendanceSettings) require
// attendance/manage server-side even though getAttendanceSettings itself
// only needs attendance/view -- a Teammate could open the settings panel
// and see current values, but Apply would always fail for them.
const canManageAttendance = computed(() => canDo('tracker.attendance.manage'));

// Gated on both stats and active-members being loaded, rather than filtering
// as each one resolves independently: otherwise the table would briefly
// render the full unfiltered list the instant stats arrive, then visibly
// shrink down once active-members catches up a moment later. A stats error
// short-circuits this (shown as soon as it happens) rather than waiting on
// active-members too, since the error view doesn't depend on it.
const statsReady = computed(() => !loading.value && (error.value !== null || activeMembersLoaded.value));

const sortedStats = computed(() => {
  const visible = statsReady.value
    ? stats.value.filter((u) => activeUserIds.value.has(u.userId))
    : [];
  return visible
    .map((user, index) => ({ user, index }))
    .sort((a, b) => {
      const diff = (b.user.violationDays || 0) - (a.user.violationDays || 0);
      if (diff !== 0) return diff;
      const nameA = statUserDisplayName(a.user).toLowerCase();
      const nameB = statUserDisplayName(b.user).toLowerCase();
      if (nameA < nameB) return -1;
      if (nameA > nameB) return 1;
      return a.index - b.index;
    })
    .map((item) => item.user);
});

// Search box that replaced the always-on desktop legend swatches (moved
// into the info-button modal instead, see showLegendModal) -- narrows the
// visible rows only, deliberately left out of exportToExcel/statsForExport
// below so a manager mid-search doesn't accidentally export a filtered
// subset without noticing.
const memberSearchQuery = ref('');
const visibleStats = computed(() => {
  const q = memberSearchQuery.value.trim().toLowerCase();
  if (!q) return sortedStats.value;
  return sortedStats.value.filter((user) => {
    const name = statUserDisplayName(user).toLowerCase();
    return name.includes(q) || (user.email || '').toLowerCase().includes(q);
  });
});

// Time thresholds for highlighting -- persisted server-side (namespace-wide),
// not localStorage: this needs to be consistent for every manager viewing
// the same company's data, and mutating it is permission-gated
// (tracker.attendance.manage) same as the rest of attendance settings.
const lateArrivalTime = ref('09:15');
const earlyLeaveTime = ref('18:15');
// Preserved (not editable from this quick panel) so saving thresholds here
// doesn't silently clobber the sit-out toggle / rounding configured on the
// Settings page.
const allowLatenessMakeup = ref(false);
const roundingMinutes = ref(0);
const showSettings = ref(false);
const lateArrivalDraft = ref(lateArrivalTime.value);
const earlyLeaveDraft = ref(earlyLeaveTime.value);
const timeSettingsError = ref<string | null>(null);
const timeSettingsLoading = ref(false);
const timeSettingsSaving = ref(false);

async function loadTimeSettings() {
  if (!namespaceSlug.value) return;
  timeSettingsLoading.value = true;
  try {
    const { atraceGetAttendanceSettings } = await import('@/api/atrace/attendance/settings');
    const settings = await atraceGetAttendanceSettings(namespaceSlug.value);
    lateArrivalTime.value = settings.lateArrivalThreshold;
    earlyLeaveTime.value = settings.earlyLeaveThreshold;
    allowLatenessMakeup.value = settings.allowLatenessMakeup;
    roundingMinutes.value = settings.roundingMinutes ?? 0;
  } catch (e) {
    logError('[AttendanceStatsTable] failed to load attendance settings:', e);
  } finally {
    timeSettingsLoading.value = false;
  }
}

function openSettings() {
  showSettings.value = !showSettings.value;
  if (showSettings.value) {
    lateArrivalDraft.value = lateArrivalTime.value;
    earlyLeaveDraft.value = earlyLeaveTime.value;
    timeSettingsError.value = null;
  }
}

async function applyTimeSettings() {
  const isValidTime = (val: string) => /^\d{2}:\d{2}$/.test(val) && (() => {
    const [h, m] = val.split(':').map((v) => Number(v));
    return h >= 0 && h < 24 && m >= 0 && m < 60;
  })();

  if (!isValidTime(lateArrivalDraft.value) || !isValidTime(earlyLeaveDraft.value)) {
    timeSettingsError.value = t('app.invalidTimeFormat') || 'Неверный формат времени (HH:MM)';
    return;
  }

  timeSettingsSaving.value = true;
  timeSettingsError.value = null;
  try {
    const { atraceUpdateAttendanceSettings } = await import('@/api/atrace/attendance/settings');
    const settings = await atraceUpdateAttendanceSettings(lateArrivalDraft.value, earlyLeaveDraft.value, allowLatenessMakeup.value, roundingMinutes.value, namespaceSlug.value);
    lateArrivalTime.value = settings.lateArrivalThreshold;
    earlyLeaveTime.value = settings.earlyLeaveThreshold;
    allowLatenessMakeup.value = settings.allowLatenessMakeup;
    roundingMinutes.value = settings.roundingMinutes ?? 0;
    showSettings.value = false;
    // Late/earlyLeave flags on already-loaded records were computed against
    // the previous thresholds server-side -- reload so the table/accordions
    // reflect the new setting immediately.
    safeLoadStats();
  } catch (e: any) {
    timeSettingsError.value = isAtracePermissionError(e, 'tracker.attendance.manage')
      ? (t('app.attendancePermissionError') || 'Недостаточно прав')
      : (t('app.saveFailed') || 'Не удалось сохранить');
  } finally {
    timeSettingsSaving.value = false;
  }
}

// Date filter state
type PeriodType = 'month' | 'week' | '3months' | 'custom';

// Load selected period from localStorage
const PERIOD_STORAGE_KEY = 'atrace-attendance-period';
const CUSTOM_START_STORAGE_KEY = 'atrace-attendance-custom-start';
const CUSTOM_END_STORAGE_KEY = 'atrace-attendance-custom-end';

function loadPeriodFromStorage(): PeriodType {
  if (typeof window === 'undefined') return 'month';
  try {
    const stored = localStorage.getItem(PERIOD_STORAGE_KEY);
    if (stored && ['month', 'week', '3months', 'custom'].includes(stored)) {
      return stored as PeriodType;
    }
  } catch {}
  return 'month';
}

function loadCustomDatesFromStorage() {
  if (typeof window === 'undefined') return { start: '', end: '' };
  try {
    return {
      start: localStorage.getItem(CUSTOM_START_STORAGE_KEY) || '',
      end: localStorage.getItem(CUSTOM_END_STORAGE_KEY) || ''
    };
  } catch {}
  return { start: '', end: '' };
}

const selectedPeriod = ref<PeriodType>(loadPeriodFromStorage());
const customDates = loadCustomDatesFromStorage();
const customStartDate = ref(customDates.start);
const customEndDate = ref(customDates.end);
const showDateModal = ref(false);
const showLegendModal = ref(false);
const showCoverageModal = ref(false);
const showLeaveModal = ref(false);
const dateModalError = ref<string | null>(null);

const isStartInvalid = computed(() => {
  if (!showDateModal.value) return false;
  if (!customStartDate.value) return false;
  const d = new Date(customStartDate.value);
  return isNaN(d.getTime());
});
const isEndInvalid = computed(() => {
  if (!showDateModal.value) return false;
  if (!customEndDate.value) return false;
  const d = new Date(customEndDate.value);
  return isNaN(d.getTime());
});
const hasRangeOrderIssue = computed(() => {
  if (!customStartDate.value || !customEndDate.value) return false;
  const s = new Date(customStartDate.value);
  const e = new Date(customEndDate.value);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return false;
  return s > e;
});
const canApplyRange = computed(() => {
  if (!customStartDate.value || !customEndDate.value) return false;
  if (isStartInvalid.value || isEndInvalid.value || hasRangeOrderIssue.value) return false;
  return true;
});

// Accordion state - track expanded user IDs
const expandedUserIds = ref<Set<string>>(new Set());

// Salary calculator state -- backed by the server-side, permission-gated
// salary entity (tracker.salary.view/manage), not localStorage: this is the
// only way "an employee can't see/edit someone else's salary" can actually
// be enforced.
const showSalaryModal = ref(false);
const selectedUserId = ref<string | null>(null);
const salaryInput = ref('');
const salaryCurrency = ref('KZT');
const workingDaysInMonth = ref(0);
const totalWorkedHours = ref(0);
const salaryLoading = ref(false);
const salarySaving = ref(false);
const salaryError = ref<string | null>(null);

// Overtime/penalty assignment + backend-computed pay breakdown
const overtimeRates = ref<Array<{ id: string; name: string; calcType: string; multiplier: number; fixedAmountPerHour: number; currency: string }>>([]);
const penaltyRules = ref<Array<{ id: string; name: string; type: string }>>([]);
const salaryOvertimeRateId = ref<string>('');
const salaryPenaltyRuleIds = ref<string[]>([]);
const salaryCalcResult = ref<import('@/api/atrace/salary/payroll').AtraceSalaryCalculationResult | null>(null);
const salaryCalcLoading = ref(false);
const salaryCalcError = ref<string | null>(null);

// Calculate date range based on selected period
const dateRange = computed(() => {
  const today = new Date();
  let startDate: Date;
  let endDate = today;

  switch (selectedPeriod.value) {
    case 'month':
      // From 1st of current month to today
      startDate = new Date(today.getFullYear(), today.getMonth(), 1);
      break;
    case 'week': {
      // From Monday of current week to today
      const dayOfWeek = today.getDay();
      const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Monday is 1
      startDate = new Date(today);
      startDate.setDate(today.getDate() + diff);
      break;
    }
    case '3months':
      // 3 months ago to today
      startDate = new Date(today);
      startDate.setMonth(today.getMonth() - 3);
      break;
    case 'custom':
      if (!customStartDate.value || !customEndDate.value) {
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
      } else {
        startDate = new Date(customStartDate.value);
        endDate = new Date(customEndDate.value);
      }
      break;
    default:
      startDate = new Date(today.getFullYear(), today.getMonth(), 1);
  }

  // formatDateYMD (not startDate.toISOString() directly) -- toISOString()
  // converts to UTC first, which rolls back to the previous day for any
  // timezone ahead of UTC (e.g. UTC+5) whenever "today" is still early
  // morning locally. That silently dropped today from the "this month"/
  // "this week"/"3 months" quick filters -- the custom-range presets already
  // used formatDateYMD and didn't have this problem.
  return {
    startDate: formatDateYMD(startDate),
    endDate: formatDateYMD(endDate)
  };
});

async function loadStats() {
  if (props.ready === false || props.postId === null) return;
  if (!namespaceSlug.value) {
    error.value = t('app.attendanceLoadFailed');
    stats.value = [];
    return;
  }
  loading.value = true;
  error.value = null;
  
  try {
    const { atraceGetAllUsersStats } = await import('@/api/atrace/attendance/stats');
    const result = await atraceGetAllUsersStats(
      dateRange.value.startDate,
      dateRange.value.endDate,
      props.postId || null,
      namespaceSlug.value
    );
    stats.value = result;
  } catch (e: any) {
    const permissionError = isAtracePermissionError(e, 'tracker.attendance.view');
    const unauthorizedError =
      e?.response?.errors?.some((err: any) =>
        String(err?.message || '').includes('unauthorized: token is missing for key "AtraceAuthorization"')
      );
    if (permissionError) {
      error.value = t('app.attendancePermissionError');
    } else if (unauthorizedError) {
      error.value = t('app.attendanceUnauthorizedError');
    } else {
      error.value = t('app.attendanceLoadFailed');
    }
    stats.value = [];
  } finally {
    loading.value = false;
  }
}

function safeLoadStats() {
  if (props.ready === false || props.postId === null) return;
  loadStats();
}

function toggleUserDetails(userId: string) {
  if (expandedUserIds.value.has(userId)) {
    expandedUserIds.value.delete(userId);
  } else {
    expandedUserIds.value.add(userId);
  }
  // Trigger reactivity
  expandedUserIds.value = new Set(expandedUserIds.value);
}

function isExpanded(userId: string): boolean {
  return expandedUserIds.value.has(userId);
}

async function openSalaryCalculator(userId: string) {
  selectedUserId.value = userId;
  salaryInput.value = '';
  salaryCurrency.value = 'KZT';
  salaryError.value = null;
  salaryOvertimeRateId.value = '';
  salaryPenaltyRuleIds.value = [];
  salaryCalcResult.value = null;
  salaryCalcError.value = null;

  // Calculate working days and hours for the user from stats
  const user = stats.value.find(u => u.userId === userId);
  if (user) {
    workingDaysInMonth.value = user.attendedDays + user.legitimateAbsences;
    totalWorkedHours.value = user.totalWorkedHours;
  }

  showSalaryModal.value = true;
  salaryLoading.value = true;
  try {
    const [{ atraceGetMemberSalary }, { atraceGetOvertimeRates, atraceGetPenaltyRules }] = await Promise.all([
      import('@/api/atrace/salary/salary'),
      import('@/api/atrace/salary/payroll'),
    ]);
    const [salary, rates, rules] = await Promise.all([
      atraceGetMemberSalary(userId, namespaceSlug.value),
      atraceGetOvertimeRates(namespaceSlug.value).catch(() => []),
      atraceGetPenaltyRules(namespaceSlug.value).catch(() => []),
    ]);
    overtimeRates.value = rates;
    penaltyRules.value = rules;
    if (salary) {
      salaryInput.value = String(salary.amount);
      salaryCurrency.value = salary.currency || 'KZT';
      salaryOvertimeRateId.value = salary.overtimeRateId || '';
      salaryPenaltyRuleIds.value = salary.penaltyRuleIds || [];
    }
  } catch (e: any) {
    salaryError.value = isAtracePermissionError(e, 'tracker.salary.view')
      ? (t('app.salaryPermissionError') || 'Недостаточно прав для просмотра зарплаты')
      : (t('app.attendanceLoadFailed') || 'Не удалось загрузить');
  } finally {
    salaryLoading.value = false;
  }
}

async function saveSalary() {
  if (!selectedUserId.value) return;
  const amount = parseFloat(salaryInput.value) || 0;
  salarySaving.value = true;
  salaryError.value = null;
  try {
    const { atraceSetMemberSalary } = await import('@/api/atrace/salary/salary');
    await atraceSetMemberSalary(
      selectedUserId.value,
      amount,
      salaryCurrency.value || 'KZT',
      undefined,
      salaryOvertimeRateId.value || null,
      salaryPenaltyRuleIds.value,
      namespaceSlug.value
    );
    showSalaryModal.value = false;
  } catch (e: any) {
    salaryError.value = isAtracePermissionError(e, 'tracker.salary.manage')
      ? (t('app.salaryPermissionError') || 'Недостаточно прав для изменения зарплаты')
      : (t('app.saveFailed') || 'Не удалось сохранить');
  } finally {
    salarySaving.value = false;
  }
}

function togglePenaltyRule(id: string) {
  const idx = salaryPenaltyRuleIds.value.indexOf(id);
  if (idx >= 0) salaryPenaltyRuleIds.value.splice(idx, 1);
  else salaryPenaltyRuleIds.value.push(id);
}

async function calculateSalaryBackend() {
  if (!selectedUserId.value) return;
  salaryCalcLoading.value = true;
  salaryCalcError.value = null;
  try {
    // The backend calculates from the persisted salary/overtime-rate/penalty
    // assignment, not whatever's currently typed in this form -- save first
    // so "Рассчитать" always reflects exactly what's on screen instead of
    // whatever was last saved (or nothing at all, on the very first attempt
    // for an employee with no salary configured yet, which came back as an
    // all-zero result with no indication why).
    const { atraceSetMemberSalary } = await import('@/api/atrace/salary/salary');
    await atraceSetMemberSalary(
      selectedUserId.value,
      parseFloat(salaryInput.value) || 0,
      salaryCurrency.value || 'KZT',
      undefined,
      salaryOvertimeRateId.value || null,
      salaryPenaltyRuleIds.value,
      namespaceSlug.value
    );

    const { atraceCalculateSalary } = await import('@/api/atrace/salary/payroll');
    salaryCalcResult.value = await atraceCalculateSalary(
      dateRange.value.startDate,
      dateRange.value.endDate,
      selectedUserId.value,
      namespaceSlug.value
    );
  } catch (e: any) {
    salaryCalcError.value = isAtracePermissionError(e, 'tracker.salary.view') || isAtracePermissionError(e, 'tracker.salary.manage')
      ? (t('app.salaryPermissionError') || 'Недостаточно прав')
      : (t('app.saveFailed') || 'Не удалось рассчитать');
  } finally {
    salaryCalcLoading.value = false;
  }
}

function openCustomRange() {
  selectedPeriod.value = 'custom';
  showDateModal.value = true;
  dateModalError.value = null;
}

function applyCustomRange() {
  dateModalError.value = null;
  if (!canApplyRange.value) {
    dateModalError.value = t('app.invalidDateRange');
    return;
  }
  showDateModal.value = false;
  safeLoadStats();
}

function formatDateYMD(d: Date) {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
    .toISOString()
    .split('T')[0];
}

function startOfWeek(d: Date) {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday is 1
  const s = new Date(d);
  s.setDate(d.getDate() + diff);
  return s;
}

function applyPreset(preset: 'today' | 'yesterday' | 'thisWeek' | 'last7' | 'last30') {
  const today = new Date();
  let start = new Date(today);
  let end = new Date(today);

  switch (preset) {
    case 'today':
      // start/end already today
      break;
    case 'yesterday':
      start.setDate(today.getDate() - 1);
      end.setDate(today.getDate() - 1);
      break;
    case 'thisWeek':
      start = startOfWeek(today);
      break;
    case 'last7':
      start.setDate(today.getDate() - 6);
      break;
    case 'last30':
      start.setDate(today.getDate() - 29);
      break;
  }

  selectedPeriod.value = 'custom';
  customStartDate.value = formatDateYMD(start);
  customEndDate.value = formatDateYMD(end);
  dateModalError.value = null;
}

// Watch for period changes (custom range loads only on apply)
watch(selectedPeriod, (newPeriod) => {
  if (newPeriod !== 'custom') {
    safeLoadStats();
  }
  // Save to localStorage
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(PERIOD_STORAGE_KEY, newPeriod);
    } catch {}
  }
});

// Watch for custom date changes
watch([customStartDate, customEndDate], ([newStart, newEnd]) => {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(CUSTOM_START_STORAGE_KEY, newStart);
      localStorage.setItem(CUSTOM_END_STORAGE_KEY, newEnd);
    } catch {}
  }
});


// Watch for postId/ready changes
watch([() => props.postId, () => props.ready], () => {
  // Load for both specific post and "All" (empty string)
  safeLoadStats();
});

onMounted(() => {
  safeLoadStats();
  loadTimeSettings();
  loadActiveMembers();
  loadPermissions();
  loadNicknames();
});

// Export functionality
const isExportingExcel = ref(false);
const exportError = ref<string | null>(null);

function isDateRangeLimited(): boolean {
  const start = new Date(dateRange.value.startDate);
  const end = new Date(dateRange.value.endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  // 3 months ≈ 100 days max
  return diffDays <= 100;
}

async function exportToExcel() {
  exportError.value = null;
  
  // Validate date range (max 3 months)
  if (!isDateRangeLimited()) {
    exportError.value = t('app.exportRangeTooLarge');
    return;
  }

  isExportingExcel.value = true;
  try {
    // Use atrace client to call the gateway with proper token
    const { atraceExportDailyAttendance } = await import('@/api/atrace/attendance/stats');
    const rawRecords = await atraceExportDailyAttendance(
      dateRange.value.startDate,
      dateRange.value.endDate,
      namespaceSlug.value
    );
    const filteredRecords = activeMembersLoaded.value
      ? rawRecords.filter((r) => activeUserIds.value.has(r.userId))
      : rawRecords;
    if (filteredRecords.length === 0) {
      exportError.value = t('app.noDataToExport');
      return;
    }

    // exportDailyAttendance/getAllUsersStats resolve username server-side
    // without the per-namespace nickname (see nicknameByUserId above) --
    // override it here so the exported sheet matches what the table shows.
    const records = filteredRecords.map((r) => ({ ...r, username: statUserDisplayName(r) }));
    const statsForExport = sortedStats.value.map((s) => ({ ...s, username: statUserDisplayName(s) }));

    const { exportPivotTableToExcel } = await import('@/utils/exportToExcel');
    await exportPivotTableToExcel(
      records,
      dateRange.value.startDate,
      dateRange.value.endDate,
      locale.value,
      undefined,
      statsForExport
    );
    useAnalytics().track('atrace_report_exported', {
      startDate: dateRange.value.startDate,
      endDate: dateRange.value.endDate,
      recordCount: records.length,
    });
  } catch (e: any) {
    logError('[AttendanceStatsTable] export failed:', e);
    exportError.value = t('app.exportFailed');
  } finally {
    isExportingExcel.value = false;
  }
}

// Computed properties for salary calculation
const salaryByDays = computed(() => {
  const salary = parseFloat(salaryInput.value) || 0;
  const daysInMonth = 22;
  return (salary / daysInMonth) * workingDaysInMonth.value;
});

const salaryByHours = computed(() => {
  const salary = parseFloat(salaryInput.value) || 0;
  const hoursInMonth = 22 * 8;
  return (salary / hoursInMonth) * totalWorkedHours.value;
});

// Locale-aware number formatting (spaces for thousands in ru-RU)
function formatNumber(val: number, fractionDigits = 0) {
  try {
    return new Intl.NumberFormat(
      locale.value === 'ru' ? 'ru-RU' : 'en-US',
      {
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
      }
    ).format(val || 0);
  } catch {
    const num = typeof val === 'number' ? val : 0;
    return num.toFixed(fractionDigits);
  }
}

</script>

<template>
  <div class="h-full flex flex-col overflow-hidden">
    <!-- Period Filter, Legend & Settings -->
    <div class="mb-3 flex flex-wrap items-center gap-3">
      <!-- Period Filter Buttons -->
      <div class="flex flex-wrap gap-1.5">
        <UButton 
          :color="selectedPeriod === 'month' ? 'primary' : 'gray'" 
          size="sm"
          @click="selectedPeriod = 'month'"
        >
          {{ t('app.thisMonth') }}
        </UButton>
        <UButton 
          :color="selectedPeriod === 'week' ? 'primary' : 'gray'" 
          size="sm"
          class="hidden md:inline-flex"
          @click="selectedPeriod = 'week'"
        >
          {{ t('app.thisWeek') }}
        </UButton>
        <UButton 
          :color="selectedPeriod === '3months' ? 'primary' : 'gray'" 
          size="sm"
          class="hidden md:inline-flex"
          @click="selectedPeriod = '3months'"
        >
          {{ t('app.last3Months') }}
        </UButton>
        <UButton 
          :color="selectedPeriod === 'custom' ? 'primary' : 'gray'" 
          size="sm"
          @click="openCustomRange()"
        >
          {{ t('app.customPeriod') }}
        </UButton>
      </div>

      <!-- Export and Settings Buttons -->
      <div class="flex flex-col md:flex-row gap-2 md:gap-1.5 md:items-center">
        <UButton
          v-if="canManageAttendance"
          size="xs"
          variant="ghost"
          icon="i-heroicons-arrow-down-tray"
          :loading="isExportingExcel"
          @click="exportToExcel"
        >
          {{ t('app.exportToExcel') || 'Export' }}
        </UButton>
        <UButton
          v-if="canManageAttendance"
          size="xs"
          variant="ghost"
          icon="i-heroicons-cog-6-tooth"
          @click="openSettings"
        >
          {{ t('app.configureTime') }}
        </UButton>
        <UButton
          size="xs"
          variant="ghost"
          icon="lucide:repeat"
          @click="showCoverageModal = true"
        >
          {{ t('app.requestCoverage') || 'Запросить подмену' }}
        </UButton>
        <UButton
          size="xs"
          variant="ghost"
          icon="lucide:calendar-off"
          @click="showLeaveModal = true"
        >
          {{ t('app.requestLeave') || 'Запросить отгул/отпуск' }}
        </UButton>
      </div>

      <!-- Member search -- replaced the always-on legend swatches; the
           legend itself moved into the info-button modal below (both
           mobile and desktop now use it, not just mobile). -->
      <UInput
        v-model="memberSearchQuery"
        icon="i-heroicons-magnifying-glass"
        size="xs"
        class="ml-auto w-40 sm:w-56"
        :placeholder="t('app.searchMemberPlaceholder') || 'Поиск по сотруднику'"
      />

      <!-- Legend info button -->
      <UButton
        icon="lucide:info"
        size="xs"
        color="gray"
        variant="ghost"
        @click="showLegendModal = true"
      />
    </div>

    <!-- Export Error -->
    <div
      v-if="exportError"
      class="mb-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-700 dark:text-red-200"
    >
      {{ exportError }}
    </div>

    <!-- Settings Panel -->
    <div
      v-if="showSettings"
      class="mb-3 p-3 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 flex-shrink-0 space-y-3"
    >
      <div class="flex items-center justify-between gap-2">
        <div>
          <div class="text-sm font-semibold leading-tight">
            {{ t('app.timeThresholds') }}
          </div>
          <div class="text-xs text-gray-500 dark:text-gray-400">
            {{ t('app.timeThresholdsHint') || 'Используется для подсветки опозданий/ранних уходов' }}
          </div>
        </div>
        <UButton
          size="xs"
          color="primary"
          variant="solid"
          icon="i-heroicons-check"
          :loading="timeSettingsSaving"
          @click="applyTimeSettings"
        >
          {{ t('common.apply') || 'Применить' }}
        </UButton>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <UFormGroup :label="t('app.lateArrivalAfter')">
          <UInput
            v-model="lateArrivalDraft"
            type="time"
            size="sm"
            icon="i-heroicons-clock"
            :disabled="timeSettingsLoading"
            :ui="{ base: 'font-mono' }"
          />
        </UFormGroup>
        <UFormGroup :label="t('app.earlyLeaveBefore')">
          <UInput
            v-model="earlyLeaveDraft"
            type="time"
            size="sm"
            icon="i-heroicons-clock"
            :disabled="timeSettingsLoading"
            :ui="{ base: 'font-mono' }"
          />
        </UFormGroup>
      </div>
      <div
        v-if="timeSettingsError"
        class="text-xs text-red-500"
      >
        {{ timeSettingsError }}
      </div>
    </div>

    <!-- Stats Table -->
    <div class="flex-1 min-h-0 overflow-auto pb-safe-or-4">
      <div
        v-if="!statsReady"
        class="flex flex-col items-center justify-center py-6"
      >
        <UIcon
          name="i-heroicons-arrow-path"
          class="w-8 h-8 mb-1.5 animate-spin text-emerald-400 dark:text-emerald-300"
        />
        <div class="text-sm">
          {{ t('app.loading') }}
        </div>
      </div>
      <div
        v-else-if="error"
        class="flex flex-col items-center justify-center py-6 text-red-500"
      >
        <UIcon
          name="i-heroicons-lock-closed"
          class="w-10 h-10 mb-1.5 text-red-400 dark:text-red-300"
        />
        <div class="text-base font-semibold mb-1.5">
          {{ error }}
        </div>
        <div class="text-xs text-gray-500 dark:text-gray-400">
          {{ t('app.attendancePermissionErrorHint') }}
        </div>
      </div>
      <div
        v-else-if="sortedStats.length === 0"
        class="text-gray-500 py-6 text-center flex flex-col items-center justify-center"
      >
        <UIcon
          name="i-heroicons-information-circle"
          class="w-8 h-8 mb-1.5 text-emerald-400 dark:text-emerald-300"
        />
        <div class="text-sm">
          {{ t('app.noData') }}
        </div>
      </div>
      <div
        v-else-if="visibleStats.length === 0"
        class="text-gray-500 py-6 text-center flex flex-col items-center justify-center"
      >
        <UIcon
          name="i-heroicons-magnifying-glass"
          class="w-8 h-8 mb-1.5 text-gray-400"
        />
        <div class="text-sm">
          {{ t('app.noSearchResults') || 'Ничего не найдено' }}
        </div>
      </div>
      <table
        v-else
        class="w-full text-sm"
      >
        <thead class="bg-gray-100 dark:bg-gray-800 sticky top-0 z-10 text-xs">
          <tr>
            <th class="px-3 py-2 text-left font-medium w-7" />
            <th class="px-3 py-2 text-left font-medium">
              {{ t('app.user') }}
            </th>
            <th class="px-3 py-2 text-center font-medium">
              {{ t('app.workDays') }}
            </th>
            <th class="px-3 py-2 text-center font-medium">
              {{ t('app.attended') }}
            </th>
            <th class="px-3 py-2 text-center font-medium">
              {{ t('app.violations') }}
            </th>
            <th class="px-3 py-2 text-center font-medium">
              {{ t('app.exceptions') }}
            </th>
            <th class="px-3 py-2 text-center font-medium">
              {{ t('app.lateArrivals') || 'Опоздания' }}
            </th>
            <th class="px-3 py-2 text-center font-medium">
              {{ t('app.earlyLeaves') || 'Ранние уходы' }}
            </th>
            <th class="px-3 py-2 text-center font-medium">
              {{ t('app.geoConfirmedDays') || 'Гео-подтв.' }}
            </th>
            <th class="px-3 py-2 text-center font-medium">
              {{ t('app.suspiciousDays') || 'Подозрительные' }}
            </th>
          </tr>
        </thead>
        <tbody>
          <template
            v-for="(user, index) in visibleStats"
            :key="user.userId"
          >
            <!-- Main row -->
            <tr 
              :class="[
                'border-b dark:border-gray-700',
                postId ? 'hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer' : 'cursor-default'
              ]"
              :data-tour="index === 0 ? 'attendance-table' : undefined"
              @click="postId ? toggleUserDetails(user.userId) : null"
            >
              <td class="px-3 py-2 text-center">
                <UButton
                  v-if="!postId && canManageSalary"
                  data-tour="calculate-btn"
                  size="xs"
                  variant="soft"
                  icon="i-heroicons-calculator"
                  @click.stop="openSalaryCalculator(user.userId)"
                >
                  {{ t('app.calculate') }}
                </UButton>
                <UIcon
                  v-else
                  :name="isExpanded(user.userId) ? 'i-heroicons-chevron-down' : 'i-heroicons-chevron-right'"
                  class="w-4 h-4 transition-transform"
                />
              </td>
              <td class="px-3 py-2">
                <div class="font-medium leading-tight">
                  {{ statUserDisplayName(user) }}
                </div>
                <div
                  v-if="user.username && user.email"
                  class="text-xs text-gray-500 leading-tight"
                >
                  {{ user.email }}
                </div>
              </td>
              <td class="px-3 py-2 text-center">
                {{ user.workDays }}
              </td>
              <td class="px-3 py-2 text-center">
                <span class="px-1.5 py-0.5 text-xs bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-100 rounded">
                  {{ user.attendedDays }}
                </span>
              </td>
              <td class="px-3 py-2 text-center">
                <span 
                  v-if="user.violationDays > 0"
                  class="px-1.5 py-0.5 text-xs bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-100 rounded"
                >
                  {{ user.violationDays }}
                </span>
                <span
                  v-else
                  class="text-gray-400"
                >0</span>
              </td>
              <td class="px-3 py-2 text-center">
                <span
                  v-if="user.legitimateAbsences > 0"
                  class="px-1.5 py-0.5 text-xs bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-100 rounded"
                >
                  {{ user.legitimateAbsences }}
                </span>
                <span
                  v-else
                  class="text-gray-400"
                >0</span>
              </td>
              <td class="px-3 py-2 text-center">
                <span
                  v-if="user.lateDays > 0"
                  class="px-1.5 py-0.5 text-xs bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-100 rounded"
                >
                  {{ user.lateDays }}
                </span>
                <span
                  v-else
                  class="text-gray-400"
                >0</span>
              </td>
              <td class="px-3 py-2 text-center">
                <span
                  v-if="user.earlyLeaveDays > 0"
                  class="px-1.5 py-0.5 text-xs bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-100 rounded"
                >
                  {{ user.earlyLeaveDays }}
                </span>
                <span
                  v-else
                  class="text-gray-400"
                >0</span>
              </td>
              <td class="px-3 py-2 text-center">
                <span class="px-1.5 py-0.5 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100 rounded">
                  {{ user.geoConfirmedDays }}
                </span>
              </td>
              <td class="px-3 py-2 text-center">
                <span
                  v-if="user.suspiciousDays > 0"
                  class="px-1.5 py-0.5 text-xs bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-100 rounded"
                >
                  {{ user.suspiciousDays }}
                </span>
                <span
                  v-else
                  class="text-gray-400"
                >0</span>
              </td>
            </tr>

            <!-- Expanded details row -->
            <tr
              v-if="postId && isExpanded(user.userId)"
              class="bg-gray-50 dark:bg-gray-900"
            >
              <td
                :colspan="10"
                class="px-3 py-3"
              >
                <div class="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm">
                  <h4 class="text-sm font-semibold mb-2">
                    {{ t('app.attendanceDetails') }}
                  </h4>
                  <UserDayRecordsAccordion
                    v-if="postId"
                    :post-id="postId"
                    :user-id="user.userId"
                    :start-date="dateRange.startDate"
                    :end-date="dateRange.endDate"
                  />
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <!-- Custom Date Range Modal -->
    <UModal
      v-model="showDateModal"
      :ui="{ container: 'items-center', width: 'w-full max-w-2xl sm:max-w-3xl' }"
    >
      <UCard :ui="{ ring: '', divide: 'divide-y divide-gray-100 dark:divide-gray-800', body: { padding: 'px-4 py-4 sm:px-6 sm:py-5' } }">
        <template #header>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <UIcon
                name="i-heroicons-calendar-days"
                class="w-5 h-5 sm:w-6 sm:h-6 text-emerald-500"
              />
              <h3 class="text-sm sm:text-base font-semibold leading-6 text-gray-900 dark:text-white">
                {{ t('app.customRangeTitle') }}
              </h3>
            </div>
            <UButton
              color="primary"
              variant="ghost"
              icon="lucide:x"
              size="sm"
              class="-my-1"
              @click="showDateModal = false"
            />
          </div>
        </template>

        <div class="flex flex-col gap-4 overflow-x-hidden">
          <!-- Presets -->
          <div class="flex flex-wrap gap-2 text-xs sm:text-sm">
            <UButton
              size="sm"
              variant="soft"
              color="primary"
              class="text-xs"
              @click="applyPreset('today')"
            >
              {{ t('app.datePresetToday') }}
            </UButton>
            <UButton
              size="sm"
              variant="soft"
              color="primary"
              class="text-xs"
              @click="applyPreset('yesterday')"
            >
              {{ t('app.datePresetYesterday') }}
            </UButton>
            <UButton
              size="sm"
              variant="soft"
              color="primary"
              class="text-xs"
              @click="applyPreset('thisWeek')"
            >
              {{ t('app.datePresetThisWeek') }}
            </UButton>
            <UButton
              size="sm"
              variant="soft"
              color="primary"
              class="text-xs"
              @click="applyPreset('last7')"
            >
              {{ t('app.datePresetLast7') }}
            </UButton>
            <UButton
              size="sm"
              variant="soft"
              color="primary"
              class="text-xs"
              @click="applyPreset('last30')"
            >
              {{ t('app.datePresetLast30') }}
            </UButton>
          </div>

          <!-- Inputs -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="flex flex-col min-w-0">
              <label class="text-sm mb-1">{{ t('app.startDate') }}</label>
              <div class="relative max-w-full overflow-hidden">
                <UIcon
                  name="i-heroicons-calendar"
                  class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10"
                />
                <input
                  v-model="customStartDate"
                  type="date"
                  class="date-input-ios w-full max-w-full pl-9 pr-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-gray-800 dark:border-gray-700 text-sm"
                  :class="{ 'border-red-500 focus:ring-red-500': isStartInvalid || hasRangeOrderIssue }"
                >
              </div>
            </div>
            <div class="flex flex-col min-w-0">
              <label class="text-sm mb-1">{{ t('app.endDate') }}</label>
              <div class="relative max-w-full overflow-hidden">
                <UIcon
                  name="i-heroicons-calendar"
                  class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10"
                />
                <input
                  v-model="customEndDate"
                  type="date"
                  class="date-input-ios w-full max-w-full pl-9 pr-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-gray-800 dark:border-gray-700 text-sm"
                  :class="{ 'border-red-500 focus:ring-red-500': isEndInvalid || hasRangeOrderIssue }"
                >
              </div>
            </div>
          </div>

          <div
            v-if="dateModalError || hasRangeOrderIssue || isStartInvalid || isEndInvalid"
            class="text-sm text-red-500"
          >
            {{ dateModalError || t('app.invalidDateRange') }}
          </div>
        </div>

        <template #footer>
          <div class="flex flex-col sm:flex-row justify-between w-full gap-2">
            <UButton
              size="sm"
              variant="soft"
              color="primary"
              class="w-full sm:w-auto"
              @click="() => { customStartDate = ''; customEndDate = ''; dateModalError = null; }"
            >
              {{ t('common.reset') }}
            </UButton>
            <div class="flex gap-2">
              <UButton
                size="sm"
                variant="soft"
                color="primary"
                class="flex-1 sm:flex-none"
                @click="showDateModal = false"
              >
                {{ t('common.cancel') }}
              </UButton>
              <UButton
                size="sm"
                color="primary"
                class="flex-1 sm:flex-none"
                :disabled="!canApplyRange"
                @click="applyCustomRange"
              >
                {{ t('common.apply') }}
              </UButton>
            </div>
          </div>
        </template>
      </UCard>
    </UModal>

    <!-- Salary Calculation Modal -->
    <UModal
      v-model="showSalaryModal"
      :ui="{ container: 'items-center', width: 'w-full sm:max-w-2xl' }"
    >
      <UCard :ui="{ ring: '', divide: 'divide-y divide-gray-100 dark:divide-gray-800' }">
        <template #header>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <UIcon
                name="i-heroicons-calculator"
                class="w-6 h-6 text-emerald-500"
              />
              <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">
                {{ t('app.salaryCalculation') }}
              </h3>
            </div>
            <UButton
              color="primary"
              variant="ghost"
              icon="lucide:x"
              class="-my-1"
              @click="showSalaryModal = false"
            />
          </div>
        </template>

        <div class="flex flex-col gap-6">
          <div
            v-if="salaryError"
            class="p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-700 dark:text-red-200"
          >
            {{ salaryError }}
          </div>

          <!-- Salary Input -->
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div class="sm:col-span-2">
              <label class="text-sm font-medium mb-2 block">{{ t('app.salary') }}</label>
              <input
                v-model="salaryInput"
                type="number"
                :disabled="salaryLoading"
                class="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-gray-800 dark:border-gray-700"
                :placeholder="t('app.enterSalary')"
              >
            </div>
            <div>
              <label class="text-sm font-medium mb-2 block">{{ t('app.currency') || 'Валюта' }}</label>
              <USelectMenu
                v-model="salaryCurrency"
                :options="currencyOptions"
                value-attribute="value"
                option-attribute="label"
                :disabled="salaryLoading"
              />
            </div>
          </div>

          <!-- Overtime rate + penalty rules assignment -->
          <div
            v-if="overtimeRates.length > 0 || penaltyRules.length > 0"
            class="grid grid-cols-1 sm:grid-cols-2 gap-3"
          >
            <div v-if="overtimeRates.length > 0">
              <label class="text-sm font-medium mb-2 block">{{ t('app.overtimeRate') || 'Ставка переработки' }}</label>
              <select
                v-model="salaryOvertimeRateId"
                class="w-full px-3 py-2 border rounded dark:bg-gray-800 dark:border-gray-700 text-sm"
              >
                <option value="">
                  {{ t('common.none') || 'Нет' }}
                </option>
                <option
                  v-for="r in overtimeRates"
                  :key="r.id"
                  :value="r.id"
                >
                  {{ r.name }} ({{ overtimeRateLabel(r) }})
                </option>
              </select>
            </div>
            <div v-if="penaltyRules.length > 0">
              <label class="text-sm font-medium mb-2 block">{{ t('app.penaltyRules') || 'Штрафы' }}</label>
              <div class="flex flex-wrap gap-1.5">
                <UButton
                  v-for="rule in penaltyRules"
                  :key="rule.id"
                  size="xs"
                  :color="salaryPenaltyRuleIds.includes(rule.id) ? 'primary' : 'gray'"
                  :variant="salaryPenaltyRuleIds.includes(rule.id) ? 'solid' : 'soft'"
                  @click="togglePenaltyRule(rule.id)"
                >
                  {{ rule.name }}
                </UButton>
              </div>
            </div>
          </div>

          <!-- Calculation Results Grid -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- Working Days -->
            <div class="border rounded-lg p-4 dark:border-gray-700">
              <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">
                {{ t('app.workingDaysInMonth') }}
              </p>
              <p class="text-2xl font-bold text-gray-900 dark:text-white">
                {{ formatNumber(workingDaysInMonth) }} / 22
              </p>
            </div>

            <!-- Total Worked Hours -->
            <div class="border rounded-lg p-4 dark:border-gray-700">
              <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">
                {{ t('app.totalWorkedHours') }}
              </p>
              <p class="text-2xl font-bold text-gray-900 dark:text-white">
                {{ formatNumber(totalWorkedHours, 2) }} / 176
              </p>
            </div>
          </div>

          <!-- Salary by Days -->
          <div class="border rounded-lg p-4 dark:border-gray-700 bg-emerald-50 dark:bg-emerald-900/20">
            <p class="text-sm font-medium text-gray-900 dark:text-white mb-3">
              {{ t('app.salaryByDays') }}
            </p>
            <div class="flex items-end gap-2">
              <div>
                <p class="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                  {{ formatNumber(salaryByDays, 2) }}
                </p>
                <p class="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  {{ t('app.formula') }}: ({{ t('app.salary') }} / 22) × {{ formatNumber(workingDaysInMonth) }}
                </p>
              </div>
            </div>
          </div>

          <!-- Salary by Hours -->
          <div class="border rounded-lg p-4 dark:border-gray-700 bg-emerald-50 dark:bg-emerald-900/20">
            <p class="text-sm font-medium text-gray-900 dark:text-white mb-3">
              {{ t('app.salaryByHours') }}
            </p>
            <div class="flex items-end gap-2">
              <div>
                <p class="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                  {{ formatNumber(salaryByHours, 2) }}
                </p>
                <p class="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  {{ t('app.formula') }}: ({{ t('app.salary') }} / 22 / 8) × {{ formatNumber(totalWorkedHours, 2) }}
                </p>
              </div>
            </div>
          </div>

          <!-- Backend-computed pay breakdown: base (prorated by hours) + overtime - penalties -->
          <div class="border rounded-lg p-4 dark:border-gray-700">
            <div class="flex items-center justify-between mb-3">
              <p class="text-sm font-medium text-gray-900 dark:text-white">
                {{ t('app.payrollBreakdown') || 'Расчёт с учётом переработок и штрафов' }}
              </p>
              <UButton
                size="xs"
                variant="soft"
                color="primary"
                icon="lucide:calculator"
                :loading="salaryCalcLoading"
                @click="calculateSalaryBackend"
              >
                {{ t('app.calculate') || 'Рассчитать' }}
              </UButton>
            </div>
            <div
              v-if="salaryCalcError"
              class="text-sm text-red-500 mb-2"
            >
              {{ salaryCalcError }}
            </div>
            <div
              v-if="salaryCalcResult"
              class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm"
            >
              <div>
                <p class="text-xs text-gray-500">
                  {{ t('app.baseAmount') || 'База' }}
                </p>
                <p class="font-semibold">
                  {{ formatNumber(salaryCalcResult.baseAmount, 2) }}
                </p>
              </div>
              <div>
                <p class="text-xs text-gray-500">
                  {{ t('app.overtimeAmount') || 'Переработка' }} ({{ formatNumber(salaryCalcResult.overtimeHours, 1) }}ч)
                </p>
                <p class="font-semibold text-emerald-600 dark:text-emerald-400">
                  +{{ formatNumber(salaryCalcResult.overtimeAmount, 2) }}
                </p>
              </div>
              <div>
                <p class="text-xs text-gray-500">
                  {{ t('app.penaltyAmount') || 'Штрафы' }}
                </p>
                <p class="font-semibold text-red-600 dark:text-red-400">
                  -{{ formatNumber(salaryCalcResult.penaltyAmount, 2) }}
                </p>
              </div>
              <div>
                <p class="text-xs text-gray-500">
                  {{ t('app.totalAmount') || 'Итого' }}
                </p>
                <p class="font-bold text-lg text-emerald-600 dark:text-emerald-400">
                  {{ formatNumber(salaryCalcResult.totalAmount, 2) }} {{ salaryCalcResult.currency }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <template #footer>
          <div class="flex justify-end w-full">
            <div class="flex gap-2">
              <UButton
                size="sm"
                variant="soft"
                color="primary"
                @click="showSalaryModal = false"
              >
                {{ t('common.close') }}
              </UButton>
              <UButton
                size="sm"
                color="primary"
                :loading="salarySaving"
                @click="saveSalary"
              >
                {{ t('app.save') }}
              </UButton>
            </div>
          </div>
        </template>
      </UCard>
    </UModal>

    <!-- Legend Modal -->
    <UModal v-model="showLegendModal">
      <UCard :ui="{ ring: '', divide: 'divide-y divide-gray-100 dark:divide-gray-800' }">
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="text-base font-semibold leading-6 text-gray-900 dark:text-white">
              {{ t('app.legend') || 'Легенда' }}
            </h3>
            <UButton
              color="gray"
              variant="ghost"
              icon="lucide:x"
              class="-my-1"
              @click="showLegendModal = false"
            />
          </div>
        </template>

        <div class="space-y-3 py-2">
          <div class="flex items-center gap-2">
            <div class="w-4 h-4 rounded bg-red-100 dark:bg-red-900/40 border border-red-300 dark:border-red-700" />
            <span class="text-sm">{{ t('app.violationDay') }}</span>
          </div>
          <div class="flex items-center gap-2">
            <div class="w-4 h-4 rounded bg-emerald-100 dark:bg-emerald-900/40 border border-emerald-300 dark:border-emerald-700" />
            <span class="text-sm">{{ t('app.legitimateDay') }}</span>
          </div>
          <div class="flex items-center gap-2">
            <div class="w-4 h-4 rounded bg-orange-100 dark:bg-orange-900/40 border border-orange-300 dark:border-orange-700" />
            <span class="text-sm">{{ t('app.timeViolation') }}</span>
          </div>
        </div>

        <template #footer>
          <div class="flex justify-end">
            <UButton
              size="sm"
              color="primary"
              @click="showLegendModal = false"
            >
              {{ t('common.close') }}
            </UButton>
          </div>
        </template>
      </UCard>
    </UModal>

    <ShiftCoverageRequestModal
      v-model="showCoverageModal"
      :ns-slug="namespaceSlug || ''"
    />
    <LeaveRequestModal
      v-model="showLeaveModal"
      :ns-slug="namespaceSlug || ''"
    />
  </div>
</template>
<style scoped>
/* iOS Safari specific fixes for date inputs */
.date-input-ios {
  box-sizing: border-box;
  -webkit-appearance: none;
  appearance: none;
}

/* iOS specific overrides */
.ios .date-input-ios {
  max-width: 100% !important;
  width: 100% !important;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Prevent iOS Safari from expanding date picker */
.ios .date-input-ios::-webkit-date-and-time-value {
  text-align: left;
  max-width: 100%;
  overflow: hidden;
}

/* Hide default calendar icon on iOS */
.ios .date-input-ios::-webkit-calendar-picker-indicator {
  position: absolute;
  right: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
}
</style>