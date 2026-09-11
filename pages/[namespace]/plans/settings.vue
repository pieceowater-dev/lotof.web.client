<script lang="ts" setup>
definePageMeta({ layout: 'workspace' });

import { useI18n } from '@/composables/useI18n';
import { usePlansAuth } from '@/composables/usePlansAuth';
import { usePlansStaffRole } from '@/composables/usePlansStaffRole';
import { useNamespace } from '@/composables/useNamespace';
import { useAuth } from '@/composables/useAuth';
import { useConfirm } from '@/composables/useConfirm';
import { FilterPaginationLengthEnum } from '@gql-hub';
import { getErrorMessage } from '@/utils/types/errors';
import { logError } from '@/utils/logger';
import PlansImageUpload from '@/components/plans/PlansImageUpload.vue';
import PhoneInput from '@/components/ui/PhoneInput.vue';
import ColorSwatch from '@/components/ui/ColorSwatch.vue';
import { plansApi, type PlansLocation, type PlansSettings, type PlansShareLink, type PlansMaster, type PlansService } from '@/api/plans/ops';
import { parseSocialLinks, serializeSocialLinks, SOCIAL_PLATFORMS, type SocialLink } from '@/utils/social';

const { t } = useI18n();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);
const { titleBySlug } = useNamespace();
const toast = useToast();
const { getToken } = usePlansAuth();
const { isOwnerOrManager, canManageStaff, role } = usePlansStaffRole();
const { confirm } = useConfirm();

useHead(() => ({ title: `${t('plans.settings')} — ${titleBySlug(nsSlug.value) || t('app.plans')}` }));
watch(role, (r) => { if (r && !isOwnerOrManager.value) navigateTo(`/${nsSlug.value}/plans`); }, { immediate: true });

const booting = ref(true);
const saving = ref(false);
const settings = ref<PlansSettings | null>(null);
const socialLinksList = ref<SocialLink[]>([]);
const socialPlatformOptions = SOCIAL_PLATFORMS.map((p) => ({ label: p.label, value: p.value }));
function addSocialLink() { socialLinksList.value.push({ name: 0, link: '' }); }
function removeSocialLink(i: number) { socialLinksList.value.splice(i, 1); }
const locations = ref<PlansLocation[]>([]);
const shareLinks = ref<PlansShareLink[]>([]);
const masters = ref<PlansMaster[]>([]);
const services = ref<PlansService[]>([]);
const publicBase = computed(() => `${typeof window !== 'undefined' ? window.location.origin : ''}/to/${nsSlug.value}/plans`);

const DAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const TZ_OPTIONS = ['Asia/Almaty', 'Asia/Aqtobe', 'Asia/Aqtau', 'Asia/Oral', 'Europe/Moscow', 'Asia/Bishkek', 'Asia/Tashkent', 'Europe/Kyiv'];
const CURRENCY_OPTIONS = [
  { label: '₸ KZT', value: 'KZT' }, { label: '₽ RUB', value: 'RUB' }, { label: '$ USD', value: 'USD' },
  { label: '€ EUR', value: 'EUR' }, { label: 'сом KGS', value: 'KGS' }, { label: 'сўм UZS', value: 'UZS' },
];

type TabKey = 'staff' | 'locations' | 'public' | 'brand' | 'rules';
const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'staff', label: t('plans.staffTab') || 'Сотрудники', icon: 'lucide:users' },
  { key: 'locations', label: t('plans.locations') || 'Точки', icon: 'lucide:map-pin' },
  { key: 'brand', label: t('plans.brandTab') || 'Оформление', icon: 'lucide:palette' },
  { key: 'rules', label: t('plans.rulesTab') || 'Правила записи', icon: 'lucide:sliders-horizontal' },
  { key: 'public', label: t('plans.publicPage') || 'Публичная страница', icon: 'lucide:link' },
];
const activeTab = ref<TabKey>((TABS.some(x => x.key === route.query.tab) ? route.query.tab : 'staff') as TabKey);
watch(activeTab, (tab) => navigateTo({ query: { ...route.query, tab } }, { replace: true }));

async function loadAll() {
  try {
    const [s, l, sl, m, sv] = await Promise.all([
      plansApi.settings(nsSlug.value),
      plansApi.locations(nsSlug.value, true),
      plansApi.shareLinks(nsSlug.value),
      plansApi.masters(nsSlug.value, true),
      plansApi.services(nsSlug.value, true),
    ]);
    settings.value = s; locations.value = l; shareLinks.value = sl; masters.value = m; services.value = sv;
    socialLinksList.value = parseSocialLinks(s?.socialLinks);
  } catch (e) {
    logError('[plans/settings] load', e);
    toast.add({ title: t('common.error'), description: getErrorMessage(e, t), color: 'red' });
  }
}

const locName = (id?: string | null) => id ? (locations.value.find(l => l.id === id)?.name || '') : '';
const locationOptions = computed(() => locations.value.map(l => ({ label: l.name, value: l.id })));

// --- master (staff) create/edit ---
const mstModal = ref(false);
const mstSaving = ref(false);
const mstEditing = ref<PlansMaster | null>(null);
const mstForm = reactive({ name: '', locationId: '', phone: '', bio: '', color: '#7c3aed', photoUrl: '' });
const mstServiceIds = ref<string[]>([]);
function openMst(m?: PlansMaster) {
  mstEditing.value = m || null;
  Object.assign(mstForm, m
    ? { name: m.name, locationId: m.locationId, phone: m.phone, bio: m.bio, color: m.color || '#7c3aed', photoUrl: m.photoUrl || '' }
    : { name: '', locationId: locations.value.find(l => l.isPrimary)?.id || locations.value[0]?.id || '', phone: '', bio: '', color: '#7c3aed', photoUrl: '' });
  mstServiceIds.value = [];
  mstModal.value = true;
  if (m) plansApi.masterServices(nsSlug.value, m.id).then(links => { mstServiceIds.value = links.map(l => l.serviceId); }).catch(() => {});
}
async function saveMst() {
  if (!mstForm.name.trim() || !mstForm.locationId) {
    toast.add({ title: t('common.error'), description: t('plans.fillRequired'), color: 'red' }); return;
  }
  mstSaving.value = true;
  try {
    let id = mstEditing.value?.id;
    if (mstEditing.value) {
      await plansApi.updateMaster(nsSlug.value, {
        id, isActive: mstEditing.value.isActive, sortOrder: mstEditing.value.sortOrder,
        staffId: mstEditing.value.staffId || null, atraceMemberId: mstEditing.value.atraceMemberId || null,
        ...mstForm, name: mstForm.name.trim(),
      });
    } else {
      const created = await plansApi.createMaster(nsSlug.value, { ...mstForm, name: mstForm.name.trim(), seedWorkingHoursFromLocation: true });
      id = created.id;
    }
    if (id) await plansApi.setMasterServices(nsSlug.value, id, mstServiceIds.value.map(serviceId => ({ serviceId })));
    mstModal.value = false; await loadAll();
  } catch (e) { toast.add({ title: t('common.error'), description: getErrorMessage(e, t), color: 'red' }); }
  finally { mstSaving.value = false; }
}
async function toggleMstActive(m: PlansMaster) {
  try {
    await plansApi.updateMaster(nsSlug.value, {
      id: m.id, locationId: m.locationId, name: m.name, photoUrl: m.photoUrl, bio: m.bio, phone: m.phone,
      staffId: m.staffId || null, atraceMemberId: m.atraceMemberId || null, color: m.color, sortOrder: m.sortOrder,
      isActive: !m.isActive,
    });
    await loadAll();
  } catch (e) { toast.add({ title: t('common.error'), description: getErrorMessage(e, t), color: 'red' }); }
}
async function delMst(m: PlansMaster) {
  if (!await confirm({ message: t('plans.confirmDeleteMaster') || `Удалить профиль мастера «${m.name}»?`, color: 'red' })) return;
  try { await plansApi.deleteMaster(nsSlug.value, m.id); await loadAll(); }
  catch (e) { toast.add({ title: t('common.error'), description: getErrorMessage(e, t), color: 'red' }); }
}

// --- staff: namespace members × plans role ---
// Role is one axis; "принимает записи как мастер" (a bookable Master profile)
// is a separate flag that any role senior to MASTER may also carry.
type PlansRole = 'MANAGER' | 'RECEPTIONIST' | 'MASTER' | 'VIEWER';
const PLANS_ROLES: PlansRole[] = ['MANAGER', 'RECEPTIONIST', 'MASTER', 'VIEWER'];
const roleLabelRu: Record<string, string> = {
  OWNER: 'Владелец', MANAGER: 'Менеджер', RECEPTIONIST: 'Администратор', MASTER: 'Мастер', VIEWER: 'Наблюдатель',
};
// USelectMenu renders an empty trigger when the model value is '' — so the
// "no access" choice carries a non-empty sentinel ('NONE') that's mapped back
// to '' in the change handler.
const roleOptions = computed(() => [
  { label: '— ' + (t('plans.noRole') || 'нет доступа'), value: 'NONE' },
  ...PLANS_ROLES.map(r => ({ label: roleLabelRu[r], value: r })),
]);
// roles that may also be a bookable master (senior to MASTER in the hierarchy)
const CAN_ALSO_BE_MASTER = ['OWNER', 'MANAGER', 'RECEPTIONIST'];
const members = ref<Array<{ id: string; userId: string; username: string; email: string; nickname?: string | null }>>([]);
const staffRows = ref<import('@/api/plans/ops').PlansStaffRow[]>([]);
const ownerUserId = ref('');
const staffLoading = ref(false);
const roleSaving = ref<string | null>(null);
const inviteEmail = ref('');
const inviting = ref(false);

const { idBySlug } = useNamespace();
const { token: hubToken } = useAuth();

async function loadStaff() {
  staffLoading.value = true;
  try {
    const nsId = idBySlug(nsSlug.value);
    const { hubMembersList } = await import('@/api/hub/members/list');
    const { hubNamespaceBySlug } = await import('@/api/hub/namespaces/get');
    const [mem, ns, rows] = await Promise.all([
      hubMembersList(hubToken.value || '', nsId, 1, FilterPaginationLengthEnum.OneHundred).catch(() => []),
      hubNamespaceBySlug(hubToken.value || '', nsSlug.value).catch(() => null),
      plansApi.staff(nsSlug.value).catch(() => []),
    ]);
    members.value = mem as any;
    ownerUserId.value = (ns as any)?.owner || '';
    staffRows.value = rows;
  } catch (e) { logError('[plans/settings] loadStaff', e); }
  finally { staffLoading.value = false; }
}

const staffView = computed(() => members.value.map(m => {
  const row = staffRows.value.find(s => s.userId === m.userId);
  const isOwner = m.userId === ownerUserId.value;
  const role = isOwner ? 'OWNER' : (row?.role || '');
  const master = masters.value.find(x => x.staffId === m.userId) || null;
  const isMasterOn = role === 'MASTER' || !!(master && master.isActive);
  const canBeMaster = role === 'MASTER' || CAN_ALSO_BE_MASTER.includes(role);
  return { member: m, staffId: row?.id || null, role, isOwner, master, isMasterOn, canBeMaster };
}));

async function ensureMasterProfile(userId: string, on: boolean) {
  const member = members.value.find(m => m.userId === userId);
  const existing = masters.value.find(x => x.staffId === userId);
  if (on) {
    if (!existing) {
      const primaryLoc = locations.value.find(l => l.isPrimary)?.id || locations.value[0]?.id;
      if (primaryLoc && member) {
        await plansApi.createMaster(nsSlug.value, {
          locationId: primaryLoc, name: member.nickname || member.username || member.email,
          staffId: userId, seedWorkingHoursFromLocation: true,
        });
      }
    } else if (!existing.isActive) {
      await plansApi.updateMaster(nsSlug.value, { ...existing, isActive: true } as any);
    }
  } else if (existing && existing.isActive) {
    await plansApi.updateMaster(nsSlug.value, { ...existing, isActive: false } as any);
  }
}

async function setMemberRole(userId: string, role: string) {
  roleSaving.value = userId;
  try {
    const row = staffRows.value.find(s => s.userId === userId);
    if (!role) {
      if (row) await plansApi.deleteStaff(nsSlug.value, row.id);
    } else if (row) {
      await plansApi.updateStaffRole(nsSlug.value, row.id, role);
    } else {
      await plansApi.createStaff(nsSlug.value, userId, role);
    }
    // MASTER role implies a bookable profile; VIEWER / no-role can't have one
    if (role === 'MASTER') await ensureMasterProfile(userId, true);
    else if (!CAN_ALSO_BE_MASTER.includes(role)) await ensureMasterProfile(userId, false);
    await Promise.all([loadStaff(), loadAll()]);
    toast.add({ title: t('common.saved') || 'Сохранено', color: 'emerald' });
  } catch (e) { toast.add({ title: t('common.error'), description: getErrorMessage(e, t), color: 'red' }); }
  finally { roleSaving.value = null; }
}

async function setMemberIsMaster(userId: string, on: boolean) {
  roleSaving.value = userId;
  try {
    await ensureMasterProfile(userId, on);
    await Promise.all([loadStaff(), loadAll()]);
    toast.add({ title: t('common.saved') || 'Сохранено', color: 'emerald' });
  } catch (e) { toast.add({ title: t('common.error'), description: getErrorMessage(e, t), color: 'red' }); }
  finally { roleSaving.value = null; }
}

async function sendInvite() {
  const email = inviteEmail.value.trim();
  if (!email) return;
  inviting.value = true;
  try {
    const { hubCreateInvite } = await import('@/api/hub/invite/create');
    await hubCreateInvite(hubToken.value || '', { namespaceSlug: nsSlug.value, email, actions: JSON.stringify({ version: 1 }) });
    inviteEmail.value = '';
    toast.add({ title: t('plans.inviteSent') || 'Приглашение отправлено', description: email, color: 'emerald' });
  } catch (e) { toast.add({ title: t('common.error'), description: getErrorMessage(e, t), color: 'red' }); }
  finally { inviting.value = false; }
}

async function saveSettings() {
  if (!settings.value) return;
  saving.value = true;
  try {
    const s = settings.value;
    const socialLinks = serializeSocialLinks(socialLinksList.value.filter((x) => x.link.trim()));
    settings.value = await plansApi.upsertSettings(nsSlug.value, {
      name: s.name, logoUrl: s.logoUrl, primaryColor: s.primaryColor, secondaryColor: s.secondaryColor,
      welcomeMessage: s.welcomeMessage, socialLinks, seoTitle: s.seoTitle, seoDescription: s.seoDescription,
      currency: s.currency, autoConfirmBookings: s.autoConfirmBookings, minLeadTimeMinutes: s.minLeadTimeMinutes,
      maxAdvanceDays: s.maxAdvanceDays, cancellationWindowHours: s.cancellationWindowHours, defaultBufferMinutes: s.defaultBufferMinutes,
      reminderFirstHoursBefore: s.reminderFirstHoursBefore, reminderSecondHoursBefore: s.reminderSecondHoursBefore ?? null,
    });
    toast.add({ title: t('common.saved') || 'Сохранено', color: 'emerald' });
  } catch (e) { toast.add({ title: t('common.error'), description: getErrorMessage(e, t), color: 'red' }); }
  finally { saving.value = false; }
}

// --- location modal + working hours ---
const locModal = ref(false);
const locSaving = ref(false);
const locEditing = ref<PlansLocation | null>(null);
const locForm = reactive({ name: '', address: '', phone: '', timezone: 'Asia/Almaty', description: '', slug: '', isPrimary: false });
const locHours = ref<{ dayOfWeek: number; startTime: string; endTime: string; isDayOff: boolean }[]>([]);
function defaultHours() {
  return Array.from({ length: 7 }, (_, d) => ({ dayOfWeek: d, startTime: '09:00', endTime: '18:00', isDayOff: d === 0 }));
}
async function openLoc(l?: PlansLocation) {
  locEditing.value = l || null;
  Object.assign(locForm, l
    ? { name: l.name, address: l.address, phone: l.phone, timezone: l.timezone, description: l.description, slug: l.slug, isPrimary: l.isPrimary }
    : { name: '', address: '', phone: '', timezone: 'Asia/Almaty', description: '', slug: '', isPrimary: !locations.value.length });
  locHours.value = defaultHours();
  locModal.value = true;
  if (l) {
    try {
      const h = await plansApi.locationWorkingHours(nsSlug.value, l.id);
      if (h.length) locHours.value = defaultHours().map(d => {
        const f = h.find(x => x.dayOfWeek === d.dayOfWeek);
        return f ? { dayOfWeek: f.dayOfWeek, startTime: f.startTime, endTime: f.endTime, isDayOff: f.isDayOff } : d;
      });
    } catch {}
  }
}
async function saveLoc() {
  if (!locForm.name.trim()) { toast.add({ title: t('common.error'), description: t('plans.fillRequired'), color: 'red' }); return; }
  locSaving.value = true;
  try {
    let id = locEditing.value?.id;
    if (locEditing.value) {
      await plansApi.updateLocation(nsSlug.value, {
        id, isActive: locEditing.value.isActive, lat: locEditing.value.lat, lng: locEditing.value.lng,
        categoryTags: locEditing.value.categoryTags, ...locForm, name: locForm.name.trim(),
      });
    } else {
      const created = await plansApi.createLocation(nsSlug.value, { ...locForm, name: locForm.name.trim() });
      id = created.id;
    }
    if (id) await plansApi.setLocationWorkingHours(nsSlug.value, id, locHours.value);
    locModal.value = false; await loadAll();
  } catch (e) { toast.add({ title: t('common.error'), description: getErrorMessage(e, t), color: 'red' }); }
  finally { locSaving.value = false; }
}

// --- master schedule (opened via ?master=) ---
const mstSchedOpen = ref(false);
const mstSchedMaster = ref<PlansMaster | null>(null);
const mstSchedSaving = ref(false);
const mstHours = ref<{ dayOfWeek: number; startTime: string; endTime: string; isDayOff: boolean }[]>([]);
async function openMasterSchedule(id: string) {
  const m = masters.value.find(x => x.id === id);
  if (!m) return;
  mstSchedMaster.value = m;
  mstSchedOpen.value = true;
  mstHours.value = defaultHours();
  try {
    const h = await plansApi.masterWorkingHours(nsSlug.value, id);
    if (h.length) mstHours.value = defaultHours().map(d => {
      const f = h.find(x => x.dayOfWeek === d.dayOfWeek);
      return f ? { dayOfWeek: f.dayOfWeek, startTime: f.startTime, endTime: f.endTime, isDayOff: f.isDayOff } : d;
    });
  } catch {}
}
async function saveMasterSchedule() {
  if (!mstSchedMaster.value) return;
  mstSchedSaving.value = true;
  try {
    await plansApi.setMasterWorkingHours(nsSlug.value, mstSchedMaster.value.id, mstHours.value);
    toast.add({ title: t('common.saved') || 'Сохранено', color: 'emerald' });
    mstSchedOpen.value = false;
  } catch (e) { toast.add({ title: t('common.error'), description: getErrorMessage(e, t), color: 'red' }); }
  finally { mstSchedSaving.value = false; }
}

// --- share links ---
const newLinkLabel = ref('');
async function addLink() {
  if (!newLinkLabel.value.trim()) return;
  try { await plansApi.createShareLink(nsSlug.value, { label: newLinkLabel.value.trim() }); newLinkLabel.value = ''; await loadAll(); }
  catch (e) { toast.add({ title: t('common.error'), description: getErrorMessage(e, t), color: 'red' }); }
}
async function delLink(id: string) {
  try { await plansApi.deleteShareLink(nsSlug.value, id); await loadAll(); }
  catch (e) { toast.add({ title: t('common.error'), description: getErrorMessage(e, t), color: 'red' }); }
}
function copy(text: string) {
  try { navigator.clipboard.writeText(text); toast.add({ title: t('common.copied') || 'Скопировано', color: 'emerald' }); } catch {}
}

onMounted(async () => {
  try {
    await getToken(nsSlug.value);
    await loadAll();
    if (activeTab.value === 'staff') loadStaff();
    const m = route.query.master as string;
    if (m) await openMasterSchedule(m);
  } catch (e) {
    toast.add({ title: t('common.error'), description: getErrorMessage(e, t), color: 'red' });
  } finally { booting.value = false; }
});
watch(activeTab, (tb) => { if (tb === 'staff' && !members.value.length) loadStaff(); });
</script>

<template>
  <div class="h-full flex flex-col p-4 pb-safe-or-4 min-h-0">
    <!-- header -->
    <div class="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center flex-shrink-0">
      <div class="flex items-center gap-3 min-w-0">
        <NuxtLink :to="`/${nsSlug}/plans`" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex-shrink-0">
          <UIcon name="lucide:arrow-left" class="w-5 h-5" />
        </NuxtLink>
        <div class="min-w-0">
          <h1 class="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">{{ t('plans.settings') }}</h1>
          <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('plans.settingsSubtitle') || 'Оформление публичной страницы, точки и правила записи' }}</p>
        </div>
      </div>
      <UButton
        icon="lucide:credit-card" size="xs" color="amber" variant="soft"
        class="self-start sm:self-auto whitespace-nowrap" :to="`/${nsSlug}/plans/plans?manage=1`"
      >
        {{ t('plans.managePlan') || 'Управление тарифом' }}
      </UButton>
    </div>

    <div v-if="booting" class="flex-1 flex items-center justify-center">
      <UIcon name="i-heroicons-arrow-path" class="w-7 h-7 animate-spin text-primary-500" />
    </div>

    <template v-else>
      <!-- pill tabs -->
      <div class="mt-4 flex gap-1 overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/60 p-1 flex-shrink-0">
        <button
          v-for="tb in TABS" :key="tb.key" type="button"
          class="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
          :class="activeTab === tb.key
            ? 'bg-white dark:bg-gray-800 text-primary-600 dark:text-primary-400 shadow-sm'
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'"
          @click="activeTab = tb.key"
        >
          <UIcon :name="tb.icon" class="w-4 h-4" />{{ tb.label }}
        </button>
      </div>

      <div class="flex-1 min-h-0 overflow-y-auto pt-4">
        <div class="max-w-3xl space-y-4">

          <!-- ================= STAFF ================= -->
          <template v-if="activeTab === 'staff'">
            <div>
              <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('plans.staffTab') || 'Сотрудники' }}</h3>
              <p class="text-xs text-gray-400 mt-0.5">{{ t('plans.staffHint2') || 'Участники неймспейса и их роль в Записи. «Мастер» получает свой календарь, услуги и график.' }}</p>
            </div>

            <!-- invite -->
            <div class="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 flex flex-col sm:flex-row gap-2 sm:items-center">
              <UInput v-model="inviteEmail" type="email" size="sm" class="flex-1" icon="i-heroicons-envelope"
                      :placeholder="t('plans.inviteEmail') || 'Email нового сотрудника'" @keydown.enter="sendInvite" />
              <UButton size="sm" :loading="inviting" :disabled="!inviteEmail.trim()" icon="lucide:user-plus" @click="sendInvite">
                {{ t('plans.invite') || 'Пригласить' }}
              </UButton>
            </div>

            <div v-if="staffLoading" class="py-8 flex justify-center"><UIcon name="i-heroicons-arrow-path" class="w-6 h-6 animate-spin text-primary-500" /></div>
            <div v-else class="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800 overflow-hidden">
              <div v-for="row in staffView" :key="row.member.userId"
                   class="px-4 py-3 flex items-center gap-3 hover:bg-gray-50/70 dark:hover:bg-gray-800/40 transition-colors">
                <img v-if="row.master?.photoUrl" :src="row.master.photoUrl" alt=""
                     class="w-9 h-9 rounded-full object-cover flex-shrink-0 bg-gray-100 dark:bg-gray-800" />
                <span v-else class="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
                      :style="{ background: (row.isMasterOn && row.master?.color) || '#94a3b8' }">
                  {{ (row.member.nickname || row.member.username || row.member.email).slice(0, 1).toUpperCase() }}
                </span>
                <div class="min-w-0 flex-1">
                  <div class="font-medium text-sm text-gray-900 dark:text-white truncate">{{ row.member.nickname || row.member.username || row.member.email }}</div>
                  <div class="text-xs text-gray-500 truncate">{{ row.member.email }}</div>
                </div>

                <div class="flex items-center gap-2 flex-shrink-0">
                  <!-- master schedule / edit -->
                  <template v-if="row.isMasterOn && row.master">
                    <UButton size="2xs" variant="ghost" color="gray" icon="lucide:calendar-clock"
                             :title="t('plans.schedule') || 'График'" @click="openMasterSchedule(row.master.id)" />
                    <UButton size="2xs" variant="ghost" color="gray" icon="lucide:pencil"
                             :title="t('common.edit') || 'Редактировать'" @click="openMst(row.master)" />
                  </template>

                  <!-- "принимает записи как мастер" -->
                  <UToggle
                    v-if="row.canBeMaster"
                    :model-value="row.isMasterOn" size="sm" :title="t('plans.asMaster') || 'мастер'"
                    :disabled="row.role === 'MASTER' || !canManageStaff || roleSaving === row.member.userId"
                    @update:model-value="(v: boolean) => setMemberIsMaster(row.member.userId, v)" />

                  <!-- role -->
                  <UBadge v-if="row.isOwner" color="amber" variant="subtle" class="w-40 justify-center">{{ roleLabelRu.OWNER }}</UBadge>
                  <UBadge v-else-if="!canManageStaff" :color="row.role ? 'primary' : 'gray'" variant="subtle" class="w-40 justify-center">
                    {{ row.role ? roleLabelRu[row.role] : (t('plans.noRole') || 'нет доступа') }}
                  </UBadge>
                  <USelectMenu
                    v-else
                    :model-value="row.role || 'NONE'"
                    :options="roleOptions"
                    value-attribute="value" option-attribute="label" size="sm" class="w-40"
                    :loading="roleSaving === row.member.userId" :popper="{ strategy: 'fixed' }"
                    @update:model-value="(v: string) => setMemberRole(row.member.userId, v === 'NONE' ? '' : v)" />
                </div>
              </div>
              <p v-if="!staffView.length" class="p-4 text-sm text-gray-500">
                {{ t('plans.noMembers') || 'В неймспейсе пока только вы. Пригласите сотрудников по email.' }}
              </p>
            </div>

            <p class="text-xs text-gray-400">
              {{ t('plans.masterProfilesNote') || 'Профиль мастера (фото, цвет, услуги, график) создаётся автоматически при выдаче роли «Мастер».' }}
            </p>
          </template>

          <!-- ================= BRAND ================= -->
          <template v-else-if="activeTab === 'brand' && settings">
            <div class="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-4">
              <div class="flex flex-col sm:flex-row gap-4">
                <PlansImageUpload v-model="settings.logoUrl" :ns-slug="nsSlug" />
                <div class="flex-1 min-w-0 space-y-4">
                  <UFormGroup :label="t('plans.brandName') || 'Название для страницы записи'">
                    <UInput v-model="settings.name" size="lg" :placeholder="titleBySlug(nsSlug) || 'lota Plans'" />
                  </UFormGroup>
                  <UFormGroup :label="t('plans.currency') || 'Валюта'">
                    <USelectMenu v-model="settings.currency" :options="CURRENCY_OPTIONS" value-attribute="value" option-attribute="label"
                                 size="lg" class="max-w-[200px]" :popper="{ strategy: 'fixed' }" />
                  </UFormGroup>
                </div>
              </div>
              <UFormGroup :label="t('plans.welcomeMessage') || 'Приветственный текст'"
                          :help="t('plans.welcomeMessageHint') || 'Показывается вверху страницы записи'">
                <UTextarea v-model="settings.welcomeMessage" :rows="2" autoresize />
              </UFormGroup>
            </div>

            <div class="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-4">
              <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('plans.colors') || 'Цвета' }}</h3>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <UFormGroup :label="t('plans.primaryColor') || 'Основной цвет'" :help="t('plans.primaryColorHint') || 'Цвет шапки публичной страницы'">
                  <ColorSwatch v-model="settings.primaryColor" />
                </UFormGroup>
                <UFormGroup :label="t('plans.secondaryColor') || 'Дополнительный цвет'">
                  <ColorSwatch v-model="settings.secondaryColor" />
                </UFormGroup>
              </div>
            </div>

            <div class="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-3">
              <div class="flex items-center justify-between">
                <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('plans.socialLinks') || 'Соцсети' }}</h3>
                <UButton size="2xs" variant="soft" color="gray" icon="lucide:plus" @click="addSocialLink">{{ t('common.add') || 'Добавить' }}</UButton>
              </div>
              <p class="text-xs text-gray-400">{{ t('plans.socialLinksHint') || 'Показываются в подвале публичной страницы записи' }}</p>
              <div v-if="!socialLinksList.length" class="text-xs text-gray-400 py-1">{{ t('plans.noSocialLinks') || 'Пока не добавлено' }}</div>
              <div v-for="(link, i) in socialLinksList" :key="i" class="flex items-center gap-2">
                <USelectMenu v-model="link.name" :options="socialPlatformOptions" value-attribute="value" option-attribute="label"
                             size="sm" class="w-40 flex-shrink-0" :popper="{ strategy: 'fixed' }" />
                <UInput v-model="link.link" size="sm" class="flex-1" placeholder="https://instagram.com/..." />
                <UButton size="2xs" variant="ghost" color="red" icon="lucide:trash-2" @click="removeSocialLink(i)" />
              </div>
            </div>

            <div class="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-4">
              <h3 class="text-sm font-semibold text-gray-900 dark:text-white">SEO</h3>
              <UFormGroup :label="t('plans.seoTitle') || 'Заголовок вкладки'">
                <UInput v-model="settings.seoTitle" size="lg" />
              </UFormGroup>
              <UFormGroup :label="t('plans.seoDescription') || 'Описание для поисковиков'">
                <UTextarea v-model="settings.seoDescription" :rows="2" autoresize />
              </UFormGroup>
            </div>

            <div class="sticky bottom-0 -mx-1 px-1 py-3 bg-white/80 dark:bg-gray-900/80 backdrop-blur flex justify-end">
              <UButton size="lg" :loading="saving" @click="saveSettings">{{ t('common.save') || 'Сохранить' }}</UButton>
            </div>
          </template>

          <!-- ================= RULES ================= -->
          <template v-else-if="activeTab === 'rules' && settings">
            <div class="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-3">
              <div class="flex items-center justify-between gap-4 rounded-xl border border-gray-200 dark:border-gray-800 p-3.5">
                <div class="min-w-0">
                  <div class="text-sm font-medium text-gray-900 dark:text-white">{{ t('plans.autoConfirm') || 'Автоподтверждение записей' }}</div>
                  <p class="text-xs text-gray-400 mt-0.5">{{ t('plans.autoConfirmHelp') || 'Новые онлайн-записи сразу становятся подтверждёнными, без ручного подтверждения' }}</p>
                </div>
                <UToggle v-model="settings.autoConfirmBookings" class="flex-shrink-0" />
              </div>
            </div>

            <div class="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <UFormGroup :label="t('plans.minLead') || 'Минимальный запас до записи'" :help="t('plans.minLeadHint') || 'за сколько минут можно записаться'">
                  <UInput v-model.number="settings.minLeadTimeMinutes" type="number" min="0" size="lg">
                    <template #trailing><span class="text-xs text-gray-400">мин</span></template>
                  </UInput>
                </UFormGroup>
                <UFormGroup :label="t('plans.maxAdvance') || 'Максимум вперёд'" :help="t('plans.maxAdvanceHint') || 'на сколько дней вперёд открыта запись'">
                  <UInput v-model.number="settings.maxAdvanceDays" type="number" min="1" size="lg">
                    <template #trailing><span class="text-xs text-gray-400">дн</span></template>
                  </UInput>
                </UFormGroup>
                <UFormGroup :label="t('plans.cancelWindow') || 'Окно отмены'" :help="t('plans.cancelWindowHint') || 'за сколько часов клиент может отменить сам'">
                  <UInput v-model.number="settings.cancellationWindowHours" type="number" min="0" size="lg">
                    <template #trailing><span class="text-xs text-gray-400">ч</span></template>
                  </UInput>
                </UFormGroup>
                <UFormGroup :label="t('plans.defaultBuffer') || 'Буфер между записями по умолчанию'">
                  <UInput v-model.number="settings.defaultBufferMinutes" type="number" min="0" step="5" size="lg">
                    <template #trailing><span class="text-xs text-gray-400">мин</span></template>
                  </UInput>
                </UFormGroup>
              </div>
            </div>

            <div class="sticky bottom-0 -mx-1 px-1 py-3 bg-white/80 dark:bg-gray-900/80 backdrop-blur flex justify-end">
              <UButton size="lg" :loading="saving" @click="saveSettings">{{ t('common.save') || 'Сохранить' }}</UButton>
            </div>
          </template>

          <!-- ================= LOCATIONS ================= -->
          <template v-else-if="activeTab === 'locations'">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('plans.locations') || 'Точки' }}</h3>
              <UButton size="xs" icon="lucide:plus" @click="openLoc()">{{ t('plans.addLocation') || 'Добавить точку' }}</UButton>
            </div>
            <div class="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
              <div v-for="l in locations" :key="l.id" class="p-3.5 flex items-center gap-3">
                <UIcon name="lucide:map-pin" class="w-4 h-4 text-gray-400 flex-shrink-0" />
                <div class="flex-1 min-w-0">
                  <div class="font-medium text-gray-900 dark:text-white truncate">
                    {{ l.name }}
                    <UBadge v-if="l.isPrimary" color="primary" variant="subtle" size="xs" class="ml-1">{{ t('plans.primaryShort') || 'осн.' }}</UBadge>
                    <UBadge v-if="!l.isActive" color="gray" variant="subtle" size="xs" class="ml-1">{{ t('common.inactive') || 'выкл' }}</UBadge>
                  </div>
                  <div class="text-xs text-gray-500 truncate">{{ l.address || '—' }} · {{ l.timezone }} · /{{ l.slug }}</div>
                </div>
                <UButton size="xs" variant="soft" color="gray" icon="lucide:clock" @click="openLoc(l)">{{ t('plans.workingHours') || 'Часы' }}</UButton>
              </div>
              <p v-if="!locations.length" class="p-4 text-sm text-gray-500">{{ t('plans.noLocations') || 'Точек пока нет' }}</p>
            </div>
          </template>

          <!-- ================= PUBLIC PAGE ================= -->
          <template v-else-if="activeTab === 'public'">
            <div class="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-4">
              <div>
                <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('plans.publicLink') || 'Ссылка на страницу записи' }}</h3>
                <p class="text-xs text-gray-400 mt-0.5">{{ t('plans.publicLinkHint') || 'Отправляйте её клиентам или разместите в соцсетях' }}</p>
              </div>
              <div class="rounded-lg border border-gray-200 dark:border-gray-800 p-2.5 flex items-center gap-2 bg-gray-50 dark:bg-gray-800/40">
                <code class="flex-1 text-xs truncate text-gray-600 dark:text-gray-300">{{ publicBase }}</code>
                <UButton size="2xs" variant="soft" color="gray" icon="lucide:copy" @click="copy(publicBase)" />
                <UButton size="2xs" variant="soft" color="gray" icon="lucide:external-link" :to="publicBase" target="_blank" />
              </div>
            </div>

            <div class="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-3">
              <div>
                <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('plans.utmLinks') || 'Ссылки с метками' }}</h3>
                <p class="text-xs text-gray-400 mt-0.5">{{ t('plans.utmLinksHint') || 'Отдельная ссылка на канал — видно, откуда пришёл клиент' }}</p>
              </div>
              <div class="flex items-center gap-2">
                <UInput v-model="newLinkLabel" size="sm" class="flex-1"
                        :placeholder="t('plans.linkLabel') || 'Метка (Instagram, Google…)'" @keydown.enter="addLink" />
                <UButton size="sm" variant="soft" color="gray" icon="lucide:plus" @click="addLink">{{ t('common.add') || 'Добавить' }}</UButton>
              </div>
              <div v-for="sl in shareLinks" :key="sl.id"
                   class="rounded-lg border border-gray-200 dark:border-gray-800 p-2.5 flex items-center gap-2">
                <span class="text-sm font-medium text-gray-800 dark:text-gray-100">{{ sl.label }}</span>
                <code class="flex-1 text-xs text-gray-500 truncate">?t={{ sl.sourceTag }}</code>
                <UButton size="2xs" variant="ghost" color="gray" icon="lucide:copy" @click="copy(`${publicBase}?t=${sl.sourceTag}`)" />
                <UButton size="2xs" variant="ghost" color="red" icon="lucide:trash-2" @click="delLink(sl.id)" />
              </div>
              <p v-if="!shareLinks.length" class="text-sm text-gray-400">{{ t('plans.noUtmLinks') || 'Меток пока нет' }}</p>
            </div>
          </template>
        </div>
      </div>
    </template>

    <!-- location modal -->
    <UModal v-model="locModal" :ui="{ width: 'sm:max-w-lg' }">
      <UCard :ui="{ body: { padding: 'p-4 sm:p-5' } }">
        <template #header>
          <h3 class="text-base font-semibold">{{ locEditing ? (t('plans.editLocation') || 'Точка') : (t('plans.addLocation') || 'Новая точка') }}</h3>
        </template>
        <div class="space-y-3.5">
          <UFormGroup :label="t('plans.locationName') || 'Название'" required>
            <UInput v-model="locForm.name" autofocus />
          </UFormGroup>
          <UFormGroup :label="t('plans.address') || 'Адрес'">
            <UInput v-model="locForm.address" />
          </UFormGroup>
          <div class="grid grid-cols-2 gap-3">
            <UFormGroup :label="t('plans.clientPhone') || 'Телефон'">
              <PhoneInput v-model="locForm.phone" />
            </UFormGroup>
            <UFormGroup :label="t('plans.timezone') || 'Часовой пояс'">
              <USelectMenu v-model="locForm.timezone" :options="TZ_OPTIONS" searchable :popper="{ strategy: 'fixed' }" />
            </UFormGroup>
          </div>
          <UFormGroup :label="t('plans.primaryLocation') || 'Основная точка'">
            <UToggle v-model="locForm.isPrimary" />
          </UFormGroup>
          <UFormGroup :label="t('plans.workingHours') || 'Часы работы'">
            <div class="flex flex-col gap-1.5">
              <div v-for="h in locHours" :key="h.dayOfWeek" class="flex items-center gap-2 text-sm">
                <span class="w-8 text-gray-500">{{ DAYS[h.dayOfWeek] }}</span>
                <UToggle :model-value="!h.isDayOff" size="sm" @update:model-value="(v: boolean) => h.isDayOff = !v" />
                <template v-if="!h.isDayOff">
                  <UInput v-model="h.startTime" type="time" size="xs" class="w-28" />
                  <span class="text-gray-400">–</span>
                  <UInput v-model="h.endTime" type="time" size="xs" class="w-28" />
                </template>
                <span v-else class="text-xs text-gray-400">{{ t('plans.dayOff') || 'выходной' }}</span>
              </div>
            </div>
          </UFormGroup>
        </div>
        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton variant="ghost" color="gray" @click="locModal = false">{{ t('common.cancel') || 'Отмена' }}</UButton>
            <UButton :loading="locSaving" @click="saveLoc">{{ t('common.save') || 'Сохранить' }}</UButton>
          </div>
        </template>
      </UCard>
    </UModal>

    <!-- master (staff) create/edit modal -->
    <UModal v-model="mstModal" :ui="{ width: 'sm:max-w-lg' }">
      <UCard :ui="{ body: { padding: 'p-4 sm:p-5' } }">
        <template #header>
          <h3 class="text-base font-semibold">{{ mstEditing ? (t('plans.editMaster') || 'Сотрудник') : (t('plans.addMaster') || 'Новый сотрудник') }}</h3>
        </template>
        <div class="space-y-3.5">
          <div class="flex gap-4">
            <PlansImageUpload v-model="mstForm.photoUrl" :ns-slug="nsSlug" :label="t('plans.photo') || 'Фото'" />
            <div class="flex-1 min-w-0 space-y-3.5">
              <UFormGroup :label="t('plans.masterName') || 'Имя'" required>
                <UInput v-model="mstForm.name" size="lg" autofocus @keyup.enter="saveMst" />
              </UFormGroup>
              <UFormGroup :label="t('plans.clientPhone') || 'Телефон'">
                <PhoneInput v-model="mstForm.phone" size="lg" />
              </UFormGroup>
            </div>
          </div>
          <UFormGroup :label="t('plans.location') || 'Точка'" required>
            <USelectMenu v-model="mstForm.locationId" :options="locationOptions" value-attribute="value" option-attribute="label" :popper="{ strategy: 'fixed' }" />
          </UFormGroup>
          <UFormGroup :label="t('plans.color') || 'Цвет'">
            <ColorSwatch v-model="mstForm.color" size="sm" />
          </UFormGroup>
          <UFormGroup :label="t('plans.bio') || 'Описание'">
            <UInput v-model="mstForm.bio" />
          </UFormGroup>
          <UFormGroup :label="t('plans.performsServices') || 'Оказывает услуги'">
            <div class="flex flex-col gap-1.5 max-h-44 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-800 p-2">
              <UCheckbox
                v-for="s in services" :key="s.id" :label="s.name"
                :model-value="mstServiceIds.includes(s.id)"
                @update:model-value="(v: boolean) => v ? mstServiceIds.push(s.id) : (mstServiceIds = mstServiceIds.filter(x => x !== s.id))"
              />
              <p v-if="!services.length" class="text-xs text-gray-400 px-1">{{ t('plans.noServices') || 'Сначала добавьте услуги в каталоге' }}</p>
            </div>
          </UFormGroup>
        </div>
        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton variant="ghost" color="gray" @click="mstModal = false">{{ t('common.cancel') || 'Отмена' }}</UButton>
            <UButton :loading="mstSaving" @click="saveMst">{{ t('common.save') || 'Сохранить' }}</UButton>
          </div>
        </template>
      </UCard>
    </UModal>

    <!-- master schedule modal -->
    <UModal v-model="mstSchedOpen" :ui="{ width: 'sm:max-w-md' }">
      <UCard v-if="mstSchedMaster" :ui="{ body: { padding: 'p-4 sm:p-5' } }">
        <template #header>
          <h3 class="text-base font-semibold">{{ t('plans.schedule') || 'Расписание' }} — {{ mstSchedMaster.name }}</h3>
        </template>
        <div class="flex flex-col gap-1.5">
          <div v-for="h in mstHours" :key="h.dayOfWeek" class="flex items-center gap-2 text-sm">
            <span class="w-8 text-gray-500">{{ DAYS[h.dayOfWeek] }}</span>
            <UToggle :model-value="!h.isDayOff" size="sm" @update:model-value="(v: boolean) => h.isDayOff = !v" />
            <template v-if="!h.isDayOff">
              <UInput v-model="h.startTime" type="time" size="xs" class="w-28" />
              <span class="text-gray-400">–</span>
              <UInput v-model="h.endTime" type="time" size="xs" class="w-28" />
            </template>
            <span v-else class="text-xs text-gray-400">{{ t('plans.dayOff') || 'выходной' }}</span>
          </div>
        </div>
        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton variant="ghost" color="gray" @click="mstSchedOpen = false">{{ t('common.cancel') || 'Отмена' }}</UButton>
            <UButton :loading="mstSchedSaving" @click="saveMasterSchedule">{{ t('common.save') || 'Сохранить' }}</UButton>
          </div>
        </template>
      </UCard>
    </UModal>
  </div>
</template>
