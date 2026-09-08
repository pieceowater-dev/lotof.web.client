<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { usePlansAuth } from '@/composables/usePlansAuth';
import { usePlansStaffRole } from '@/composables/usePlansStaffRole';
import { useNamespace } from '@/composables/useNamespace';
import { getErrorMessage } from '@/utils/types/errors';
import { logError } from '@/utils/logger';
import { plansApi, type PlansLocation, type PlansSettings, type PlansShareLink, type PlansMaster } from '@/api/plans/ops';

const { t } = useI18n();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);
const { titleBySlug } = useNamespace();
const toast = useToast();
const { getToken } = usePlansAuth();
const { isOwnerOrManager, role } = usePlansStaffRole();

useHead(() => ({ title: `${t('plans.settings')} — ${titleBySlug(nsSlug.value) || t('app.plans')}` }));
watch(role, (r) => { if (r && !isOwnerOrManager.value) navigateTo(`/${nsSlug.value}/plans`); }, { immediate: true });

const loading = ref(true);
const settings = ref<PlansSettings | null>(null);
const locations = ref<PlansLocation[]>([]);
const shareLinks = ref<PlansShareLink[]>([]);
const masters = ref<PlansMaster[]>([]);
const publicBase = computed(() => `${typeof window !== 'undefined' ? window.location.origin : ''}/to/${nsSlug.value}/plans`);

const DAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

async function loadAll() {
  loading.value = true;
  try {
    const [s, l, sl, m] = await Promise.all([
      plansApi.settings(nsSlug.value),
      plansApi.locations(nsSlug.value, true),
      plansApi.shareLinks(nsSlug.value),
      plansApi.masters(nsSlug.value, true),
    ]);
    settings.value = s; locations.value = l; shareLinks.value = sl; masters.value = m;
  } catch (e) {
    logError('[plans/settings] load', e);
    toast.add({ title: t('common.error'), description: getErrorMessage(e, t), color: 'red' });
  } finally { loading.value = false; }
}

// --- brand settings ---
async function saveSettings() {
  if (!settings.value) return;
  try {
    const s = settings.value;
    settings.value = await plansApi.upsertSettings(nsSlug.value, {
      name: s.name, logoUrl: s.logoUrl, primaryColor: s.primaryColor, secondaryColor: s.secondaryColor,
      welcomeMessage: s.welcomeMessage, socialLinks: s.socialLinks, seoTitle: s.seoTitle, seoDescription: s.seoDescription,
      currency: s.currency, autoConfirmBookings: s.autoConfirmBookings, minLeadTimeMinutes: s.minLeadTimeMinutes,
      maxAdvanceDays: s.maxAdvanceDays, cancellationWindowHours: s.cancellationWindowHours, defaultBufferMinutes: s.defaultBufferMinutes,
      reminderFirstHoursBefore: s.reminderFirstHoursBefore, reminderSecondHoursBefore: s.reminderSecondHoursBefore ?? null,
    });
    toast.add({ title: t('common.saved') || 'Сохранено', color: 'emerald' });
  } catch (e) { toast.add({ title: t('common.error'), description: getErrorMessage(e, t), color: 'red' }); }
}

// --- location modal + working hours ---
const locModal = ref(false);
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
      if (h.length) locHours.value = defaultHours().map(d => { const f = h.find(x => x.dayOfWeek === d.dayOfWeek); return f ? { dayOfWeek: f.dayOfWeek, startTime: f.startTime, endTime: f.endTime, isDayOff: f.isDayOff } : d; });
    } catch {}
  }
}
async function saveLoc() {
  if (!locForm.name) { toast.add({ title: t('common.error'), description: t('plans.fillRequired'), color: 'red' }); return; }
  try {
    let id = locEditing.value?.id;
    if (locEditing.value) {
      await plansApi.updateLocation(nsSlug.value, { id, isActive: locEditing.value.isActive, lat: locEditing.value.lat, lng: locEditing.value.lng, categoryTags: locEditing.value.categoryTags, ...locForm });
    } else {
      const created = await plansApi.createLocation(nsSlug.value, { ...locForm });
      id = created.id;
    }
    if (id) await plansApi.setLocationWorkingHours(nsSlug.value, id, locHours.value);
    locModal.value = false; await loadAll();
  } catch (e) { toast.add({ title: t('common.error'), description: getErrorMessage(e, t), color: 'red' }); }
}

// --- master schedule (opened via ?master=) ---
const mstSchedMaster = ref<PlansMaster | null>(null);
const mstHours = ref<{ dayOfWeek: number; startTime: string; endTime: string; isDayOff: boolean }[]>([]);
async function openMasterSchedule(id: string) {
  const m = masters.value.find(x => x.id === id);
  if (!m) return;
  mstSchedMaster.value = m;
  mstHours.value = defaultHours();
  try {
    const h = await plansApi.masterWorkingHours(nsSlug.value, id);
    if (h.length) mstHours.value = defaultHours().map(d => { const f = h.find(x => x.dayOfWeek === d.dayOfWeek); return f ? { dayOfWeek: f.dayOfWeek, startTime: f.startTime, endTime: f.endTime, isDayOff: f.isDayOff } : d; });
  } catch {}
}
async function saveMasterSchedule() {
  if (!mstSchedMaster.value) return;
  try {
    await plansApi.setMasterWorkingHours(nsSlug.value, mstSchedMaster.value.id, mstHours.value);
    toast.add({ title: t('common.saved') || 'Сохранено', color: 'emerald' });
    mstSchedMaster.value = null;
  } catch (e) { toast.add({ title: t('common.error'), description: getErrorMessage(e, t), color: 'red' }); }
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
  await loadAll();
  const m = route.query.master as string;
  if (m) await openMasterSchedule(m);
});
</script>

<template>
  <div class="max-w-3xl mx-auto px-3 sm:px-4 py-4 flex flex-col gap-6">
    <div class="flex items-center gap-3">
      <NuxtLink :to="`/${nsSlug}/plans`" class="text-gray-400 hover:text-gray-600"><Icon name="lucide:arrow-left" class="w-5 h-5" /></NuxtLink>
      <h1 class="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">{{ t('plans.settings') }}</h1>
    </div>

    <div v-if="loading" class="py-16 flex justify-center"><UIcon name="i-heroicons-arrow-path" class="w-7 h-7 animate-spin text-primary-500" /></div>

    <template v-else>
      <!-- Locations -->
      <section class="flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <h2 class="font-semibold text-gray-900 dark:text-white">{{ t('plans.locations') || 'Точки' }}</h2>
          <UButton size="xs" icon="lucide:plus" @click="openLoc()">{{ t('common.add') || 'Добавить' }}</UButton>
        </div>
        <div v-for="l in locations" :key="l.id" class="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 flex items-center gap-3">
          <div class="flex-1 min-w-0">
            <div class="font-medium text-gray-900 dark:text-white truncate">{{ l.name }} <span v-if="l.isPrimary" class="text-xs text-primary-600">· осн.</span></div>
            <div class="text-xs text-gray-500 truncate">{{ l.address }} · {{ l.timezone }} · /{{ l.slug }}</div>
          </div>
          <UButton size="2xs" variant="ghost" icon="lucide:pencil" @click="openLoc(l)" />
        </div>
      </section>

      <!-- Public booking page + share links -->
      <section class="flex flex-col gap-2">
        <h2 class="font-semibold text-gray-900 dark:text-white">{{ t('plans.publicPage') || 'Публичная страница записи' }}</h2>
        <div class="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 flex items-center gap-2">
          <code class="flex-1 text-xs truncate">{{ publicBase }}</code>
          <UButton size="2xs" variant="soft" icon="lucide:copy" @click="copy(publicBase)" />
          <a :href="publicBase" target="_blank"><UButton size="2xs" variant="soft" icon="lucide:external-link" /></a>
        </div>
        <div class="flex items-center gap-2">
          <input v-model="newLinkLabel" :placeholder="t('plans.linkLabel') || 'Метка (Instagram, Google…)'" class="flex-1 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm" @keydown.enter="addLink" />
          <UButton size="xs" variant="soft" @click="addLink">{{ t('common.add') || 'Добавить' }}</UButton>
        </div>
        <div v-for="sl in shareLinks" :key="sl.id" class="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-2.5 flex items-center gap-2">
          <div class="text-sm font-medium">{{ sl.label }}</div>
          <code class="flex-1 text-xs text-gray-500 truncate">{{ publicBase }}?t={{ sl.sourceTag }}</code>
          <UButton size="2xs" variant="ghost" icon="lucide:copy" @click="copy(`${publicBase}?t=${sl.sourceTag}`)" />
          <UButton size="2xs" variant="ghost" color="red" icon="lucide:trash-2" @click="delLink(sl.id)" />
        </div>
      </section>

      <!-- Brand + booking behaviour -->
      <section v-if="settings" class="flex flex-col gap-3">
        <h2 class="font-semibold text-gray-900 dark:text-white">{{ t('plans.brandAndRules') || 'Оформление и правила записи' }}</h2>
        <input v-model="settings.name" :placeholder="t('plans.brandName') || 'Название для страницы записи'" class="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm" />
        <textarea v-model="settings.welcomeMessage" :placeholder="t('plans.welcomeMessage') || 'Приветственный текст'" rows="2" class="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm" />
        <div class="grid grid-cols-2 gap-2">
          <label class="text-xs text-gray-500">{{ t('plans.primaryColor') || 'Цвет' }}<input type="color" v-model="settings.primaryColor" class="w-full h-9 rounded mt-1" /></label>
          <label class="text-xs text-gray-500">{{ t('plans.currency') || 'Валюта' }}<input v-model="settings.currency" class="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1.5 text-sm mt-1" /></label>
        </div>
        <label class="flex items-center gap-2 text-sm"><input type="checkbox" v-model="settings.autoConfirmBookings" /> {{ t('plans.autoConfirm') || 'Подтверждать записи автоматически' }}</label>
        <div class="grid grid-cols-2 gap-2">
          <label class="text-xs text-gray-500">{{ t('plans.minLead') || 'Мин. запас, мин' }}<input type="number" v-model.number="settings.minLeadTimeMinutes" class="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1.5 text-sm mt-1" /></label>
          <label class="text-xs text-gray-500">{{ t('plans.maxAdvance') || 'Макс. вперёд, дней' }}<input type="number" v-model.number="settings.maxAdvanceDays" class="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1.5 text-sm mt-1" /></label>
          <label class="text-xs text-gray-500">{{ t('plans.cancelWindow') || 'Окно отмены, ч' }}<input type="number" v-model.number="settings.cancellationWindowHours" class="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1.5 text-sm mt-1" /></label>
        </div>
        <div class="flex justify-end"><UButton @click="saveSettings">{{ t('common.save') || 'Сохранить' }}</UButton></div>
      </section>
    </template>

    <!-- location modal -->
    <UModal v-model="locModal">
      <div class="p-5 flex flex-col gap-3">
        <h3 class="text-base font-semibold">{{ locEditing ? (t('plans.editLocation') || 'Точка') : (t('plans.addLocation') || 'Точка') }}</h3>
        <input v-model="locForm.name" :placeholder="t('plans.locationName') || 'Название'" class="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm" />
        <input v-model="locForm.address" :placeholder="t('plans.address') || 'Адрес'" class="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm" />
        <div class="grid grid-cols-2 gap-2">
          <input v-model="locForm.phone" :placeholder="t('plans.clientPhone') || 'Телефон'" class="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm" />
          <input v-model="locForm.timezone" placeholder="Asia/Almaty" class="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm" />
        </div>
        <label class="flex items-center gap-2 text-sm"><input type="checkbox" v-model="locForm.isPrimary" /> {{ t('plans.primaryLocation') || 'Основная точка' }}</label>
        <div class="text-xs font-medium text-gray-500">{{ t('plans.workingHours') || 'Часы работы' }}</div>
        <div v-for="h in locHours" :key="h.dayOfWeek" class="flex items-center gap-2 text-sm">
          <span class="w-8">{{ DAYS[h.dayOfWeek] }}</span>
          <label class="flex items-center gap-1"><input type="checkbox" :checked="!h.isDayOff" @change="h.isDayOff = !($event.target as HTMLInputElement).checked" /> {{ h.isDayOff ? (t('plans.dayOff') || 'выходной') : '' }}</label>
          <template v-if="!h.isDayOff">
            <input type="time" v-model="h.startTime" class="rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1" />
            <span>–</span>
            <input type="time" v-model="h.endTime" class="rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1" />
          </template>
        </div>
        <div class="flex justify-end gap-2">
          <UButton variant="ghost" color="gray" @click="locModal = false">{{ t('common.cancel') || 'Отмена' }}</UButton>
          <UButton @click="saveLoc">{{ t('common.save') || 'Сохранить' }}</UButton>
        </div>
      </div>
    </UModal>

    <!-- master schedule modal -->
    <UModal v-model="mstSchedMaster">
      <div v-if="mstSchedMaster" class="p-5 flex flex-col gap-3">
        <h3 class="text-base font-semibold">{{ t('plans.schedule') || 'Расписание' }} — {{ mstSchedMaster.name }}</h3>
        <div v-for="h in mstHours" :key="h.dayOfWeek" class="flex items-center gap-2 text-sm">
          <span class="w-8">{{ DAYS[h.dayOfWeek] }}</span>
          <label class="flex items-center gap-1"><input type="checkbox" :checked="!h.isDayOff" @change="h.isDayOff = !($event.target as HTMLInputElement).checked" /> {{ h.isDayOff ? (t('plans.dayOff') || 'выходной') : '' }}</label>
          <template v-if="!h.isDayOff">
            <input type="time" v-model="h.startTime" class="rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1" />
            <span>–</span>
            <input type="time" v-model="h.endTime" class="rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1" />
          </template>
        </div>
        <div class="flex justify-end gap-2">
          <UButton variant="ghost" color="gray" @click="mstSchedMaster = null">{{ t('common.cancel') || 'Отмена' }}</UButton>
          <UButton @click="saveMasterSchedule">{{ t('common.save') || 'Сохранить' }}</UButton>
        </div>
      </div>
    </UModal>
  </div>
</template>
