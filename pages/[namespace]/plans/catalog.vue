<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { usePlansAuth } from '@/composables/usePlansAuth';
import { useNamespace } from '@/composables/useNamespace';
import { getErrorMessage } from '@/utils/types/errors';
import { logError } from '@/utils/logger';
import PlansNavTabs from '@/components/plans/PlansNavTabs.vue';
import { plansApi, type PlansService, type PlansMaster, type ServiceCategory, type PlansLocation } from '@/api/plans/ops';

const { t } = useI18n();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);
const { titleBySlug } = useNamespace();
const toast = useToast();
const { getToken } = usePlansAuth();

useHead(() => ({ title: `${t('plans.catalog')} — ${titleBySlug(nsSlug.value) || t('app.plans')}` }));

const tab = ref<'services' | 'masters'>('services');
const loading = ref(true);
const categories = ref<ServiceCategory[]>([]);
const services = ref<PlansService[]>([]);
const masters = ref<PlansMaster[]>([]);
const locations = ref<PlansLocation[]>([]);
const mastersById = computed(() => Object.fromEntries(masters.value.map(m => [m.id, m])));

async function loadAll() {
  loading.value = true;
  try {
    const [c, s, m, l] = await Promise.all([
      plansApi.categories(nsSlug.value),
      plansApi.services(nsSlug.value, true),
      plansApi.masters(nsSlug.value, true),
      plansApi.locations(nsSlug.value, true),
    ]);
    categories.value = c; services.value = s; masters.value = m; locations.value = l;
  } catch (e) {
    logError('[plans/catalog] load', e);
    toast.add({ title: t('common.error'), description: getErrorMessage(e, t), color: 'red' });
  } finally { loading.value = false; }
}

// --- service modal ---
const svcModal = ref(false);
const svcEditing = ref<PlansService | null>(null);
const svcForm = reactive({ name: '', categoryId: '', durationMinutes: 30, bufferAfterMinutes: 0, price: 0, requiresMaster: true, color: '#7c3aed', description: '' });
function openSvc(s?: PlansService) {
  svcEditing.value = s || null;
  Object.assign(svcForm, s
    ? { name: s.name, categoryId: s.categoryId || '', durationMinutes: s.durationMinutes, bufferAfterMinutes: s.bufferAfterMinutes, price: s.price, requiresMaster: s.requiresMaster, color: s.color || '#7c3aed', description: s.description }
    : { name: '', categoryId: '', durationMinutes: 30, bufferAfterMinutes: 0, price: 0, requiresMaster: true, color: '#7c3aed', description: '' });
  svcModal.value = true;
}
async function saveSvc() {
  if (!svcForm.name || svcForm.durationMinutes <= 0) { toast.add({ title: t('common.error'), description: t('plans.fillRequired'), color: 'red' }); return; }
  try {
    const input: any = { ...svcForm, categoryId: svcForm.categoryId || null };
    if (svcEditing.value) await plansApi.updateService(nsSlug.value, { id: svcEditing.value.id, isActive: svcEditing.value.isActive, sortOrder: svcEditing.value.sortOrder, imageUrl: svcEditing.value.imageUrl, ...input });
    else await plansApi.createService(nsSlug.value, input);
    svcModal.value = false; await loadAll();
  } catch (e) { toast.add({ title: t('common.error'), description: getErrorMessage(e, t), color: 'red' }); }
}
async function delSvc(s: PlansService) {
  if (!confirm(t('plans.confirmDeleteService') || `Удалить услугу «${s.name}»?`)) return;
  try { await plansApi.deleteService(nsSlug.value, s.id); await loadAll(); }
  catch (e) { toast.add({ title: t('common.error'), description: getErrorMessage(e, t), color: 'red' }); }
}

// --- category quick-add ---
const newCat = ref('');
async function addCat() {
  if (!newCat.value.trim()) return;
  try { await plansApi.createCategory(nsSlug.value, { name: newCat.value.trim(), sortOrder: categories.value.length }); newCat.value = ''; await loadAll(); }
  catch (e) { toast.add({ title: t('common.error'), description: getErrorMessage(e, t), color: 'red' }); }
}

// --- master modal ---
const mstModal = ref(false);
const mstEditing = ref<PlansMaster | null>(null);
const mstForm = reactive({ name: '', locationId: '', phone: '', bio: '', color: '#7c3aed' });
const mstServiceIds = ref<string[]>([]);
function openMst(m?: PlansMaster) {
  mstEditing.value = m || null;
  Object.assign(mstForm, m
    ? { name: m.name, locationId: m.locationId, phone: m.phone, bio: m.bio, color: m.color || '#7c3aed' }
    : { name: '', locationId: locations.value.find(l => l.isPrimary)?.id || locations.value[0]?.id || '', phone: '', bio: '', color: '#7c3aed' });
  mstServiceIds.value = [];
  mstModal.value = true;
  if (m) plansApi.masterServices(nsSlug.value, m.id).then(links => { mstServiceIds.value = links.map(l => l.serviceId); }).catch(() => {});
}
async function saveMst() {
  if (!mstForm.name || !mstForm.locationId) { toast.add({ title: t('common.error'), description: t('plans.fillRequired'), color: 'red' }); return; }
  try {
    let id = mstEditing.value?.id;
    if (mstEditing.value) {
      await plansApi.updateMaster(nsSlug.value, { id, isActive: mstEditing.value.isActive, sortOrder: mstEditing.value.sortOrder, photoUrl: mstEditing.value.photoUrl, staffId: mstEditing.value.staffId || null, atraceMemberId: mstEditing.value.atraceMemberId || null, ...mstForm });
    } else {
      const created = await plansApi.createMaster(nsSlug.value, { ...mstForm, seedWorkingHoursFromLocation: true });
      id = created.id;
    }
    if (id) await plansApi.setMasterServices(nsSlug.value, id, mstServiceIds.value.map(serviceId => ({ serviceId })));
    mstModal.value = false; await loadAll();
  } catch (e) { toast.add({ title: t('common.error'), description: getErrorMessage(e, t), color: 'red' }); }
}
async function delMst(m: PlansMaster) {
  if (!confirm(t('plans.confirmDeleteMaster') || `Удалить мастера «${m.name}»?`)) return;
  try { await plansApi.deleteMaster(nsSlug.value, m.id); await loadAll(); }
  catch (e) { toast.add({ title: t('common.error'), description: getErrorMessage(e, t), color: 'red' }); }
}

const catName = (id?: string | null) => id ? (categories.value.find(c => c.id === id)?.name || '') : '';

onMounted(loadAll);
</script>

<template>
  <div class="max-w-4xl mx-auto px-3 sm:px-4 py-4 flex flex-col gap-4">
    <h1 class="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">{{ t('plans.catalog') }}</h1>
    <PlansNavTabs />

    <div class="flex gap-1 border-b border-gray-200 dark:border-gray-800">
      <button
        v-for="x in (['services','masters'] as const)" :key="x"
        class="px-3 py-2 text-sm font-medium border-b-2 -mb-px"
        :class="tab === x ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500'"
        @click="tab = x"
      >{{ x === 'services' ? t('plans.services') : t('plans.masters') }}</button>
    </div>

    <div v-if="loading" class="py-16 flex justify-center"><UIcon name="i-heroicons-arrow-path" class="w-7 h-7 animate-spin text-primary-500" /></div>

    <!-- SERVICES -->
    <template v-else-if="tab === 'services'">
      <div class="flex items-center gap-2 flex-wrap">
        <input v-model="newCat" :placeholder="t('plans.newCategory') || 'Новая категория'" class="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm" @keydown.enter="addCat" />
        <UButton size="xs" variant="soft" icon="lucide:folder-plus" @click="addCat">{{ t('common.add') || 'Добавить' }}</UButton>
        <span class="text-xs text-gray-400">{{ categories.map(c => c.name).join(', ') }}</span>
        <span class="flex-1" />
        <UButton size="sm" icon="lucide:plus" @click="openSvc()">{{ t('plans.addService') || 'Услуга' }}</UButton>
      </div>
      <div v-if="!services.length" class="py-10 text-center text-gray-500">{{ t('plans.noServices') || 'Услуг пока нет' }}</div>
      <div v-else class="flex flex-col gap-2">
        <div v-for="s in services" :key="s.id" class="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 flex items-center gap-3">
          <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" :style="{ background: s.color || '#7c3aed' }" />
          <div class="flex-1 min-w-0">
            <div class="font-medium text-gray-900 dark:text-white truncate">{{ s.name }} <span v-if="!s.isActive" class="text-xs text-gray-400">({{ t('common.inactive') || 'выкл' }})</span></div>
            <div class="text-xs text-gray-500">{{ catName(s.categoryId) }}<span v-if="catName(s.categoryId)"> · </span>{{ s.durationMinutes }} мин<span v-if="s.bufferAfterMinutes"> +{{ s.bufferAfterMinutes }}</span> · {{ s.price }} · {{ s.requiresMaster ? (t('plans.needsMaster') || 'нужен мастер') : (t('plans.anyMaster') || 'любой') }}</div>
          </div>
          <UButton size="2xs" variant="ghost" icon="lucide:pencil" @click="openSvc(s)" />
          <UButton size="2xs" variant="ghost" color="red" icon="lucide:trash-2" @click="delSvc(s)" />
        </div>
      </div>
    </template>

    <!-- MASTERS -->
    <template v-else>
      <div class="flex justify-end">
        <UButton size="sm" icon="lucide:plus" @click="openMst()">{{ t('plans.addMaster') || 'Мастер' }}</UButton>
      </div>
      <div v-if="!masters.length" class="py-10 text-center text-gray-500">{{ t('plans.noMasters') || 'Мастеров пока нет' }}</div>
      <div v-else class="flex flex-col gap-2">
        <div v-for="m in masters" :key="m.id" class="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 flex items-center gap-3">
          <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" :style="{ background: m.color || '#7c3aed' }" />
          <div class="flex-1 min-w-0">
            <div class="font-medium text-gray-900 dark:text-white truncate">{{ m.name }} <span v-if="!m.isActive" class="text-xs text-gray-400">({{ t('common.inactive') || 'выкл' }})</span></div>
            <div class="text-xs text-gray-500">{{ (locations.find(l => l.id === m.locationId)?.name) || '' }}<span v-if="m.phone"> · {{ m.phone }}</span></div>
          </div>
          <NuxtLink :to="`/${nsSlug}/plans/settings?master=${m.id}`" class="text-xs text-primary-600 hover:underline">{{ t('plans.schedule') || 'Расписание' }}</NuxtLink>
          <UButton size="2xs" variant="ghost" icon="lucide:pencil" @click="openMst(m)" />
          <UButton size="2xs" variant="ghost" color="red" icon="lucide:trash-2" @click="delMst(m)" />
        </div>
      </div>
    </template>

    <!-- service modal -->
    <UModal v-model="svcModal">
      <div class="p-5 flex flex-col gap-3">
        <h3 class="text-base font-semibold">{{ svcEditing ? (t('plans.editService') || 'Услуга') : (t('plans.addService') || 'Услуга') }}</h3>
        <input v-model="svcForm.name" :placeholder="t('plans.serviceName') || 'Название'" class="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm" />
        <select v-model="svcForm.categoryId" class="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm">
          <option value="">{{ t('plans.noCategory') || 'Без категории' }}</option>
          <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
        <div class="grid grid-cols-3 gap-2">
          <label class="text-xs text-gray-500">{{ t('plans.durationMin') || 'Длит., мин' }}<input v-model.number="svcForm.durationMinutes" type="number" min="5" class="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1.5 text-sm mt-1" /></label>
          <label class="text-xs text-gray-500">{{ t('plans.bufferMin') || 'Буфер, мин' }}<input v-model.number="svcForm.bufferAfterMinutes" type="number" min="0" class="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1.5 text-sm mt-1" /></label>
          <label class="text-xs text-gray-500">{{ t('plans.price') || 'Цена' }}<input v-model.number="svcForm.price" type="number" min="0" class="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1.5 text-sm mt-1" /></label>
        </div>
        <label class="flex items-center gap-2 text-sm"><input type="checkbox" v-model="svcForm.requiresMaster" /> {{ t('plans.requiresMaster') || 'Требуется выбор мастера' }}</label>
        <div class="flex justify-end gap-2">
          <UButton variant="ghost" color="gray" @click="svcModal = false">{{ t('common.cancel') || 'Отмена' }}</UButton>
          <UButton @click="saveSvc">{{ t('common.save') || 'Сохранить' }}</UButton>
        </div>
      </div>
    </UModal>

    <!-- master modal -->
    <UModal v-model="mstModal">
      <div class="p-5 flex flex-col gap-3">
        <h3 class="text-base font-semibold">{{ mstEditing ? (t('plans.editMaster') || 'Мастер') : (t('plans.addMaster') || 'Мастер') }}</h3>
        <input v-model="mstForm.name" :placeholder="t('plans.masterName') || 'Имя'" class="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm" />
        <select v-model="mstForm.locationId" class="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm">
          <option v-for="l in locations" :key="l.id" :value="l.id">{{ l.name }}</option>
        </select>
        <input v-model="mstForm.phone" :placeholder="t('plans.clientPhone') || 'Телефон'" class="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm" />
        <div>
          <div class="text-xs font-medium text-gray-500 mb-1">{{ t('plans.performsServices') || 'Оказывает услуги' }}</div>
          <div class="flex flex-col gap-1 max-h-40 overflow-y-auto">
            <label v-for="s in services" :key="s.id" class="flex items-center gap-2 text-sm">
              <input type="checkbox" :value="s.id" v-model="mstServiceIds" /> {{ s.name }}
            </label>
          </div>
        </div>
        <div class="flex justify-end gap-2">
          <UButton variant="ghost" color="gray" @click="mstModal = false">{{ t('common.cancel') || 'Отмена' }}</UButton>
          <UButton @click="saveMst">{{ t('common.save') || 'Сохранить' }}</UButton>
        </div>
      </div>
    </UModal>
  </div>
</template>
