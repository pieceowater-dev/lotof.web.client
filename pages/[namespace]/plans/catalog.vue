<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { usePlansAuth } from '@/composables/usePlansAuth';
import { usePlansStaffRole } from '@/composables/usePlansStaffRole';
import { useNamespace } from '@/composables/useNamespace';
import { useConfirm } from '@/composables/useConfirm';
import { getErrorMessage } from '@/utils/types/errors';
import { logError } from '@/utils/logger';
import PlansNavTabs from '@/components/plans/PlansNavTabs.vue';
import PhoneInput from '@/components/ui/PhoneInput.vue';
import ColorSwatch from '@/components/ui/ColorSwatch.vue';
import { plansApi, type PlansService, type PlansMaster, type ServiceCategory, type PlansLocation } from '@/api/plans/ops';

const { t } = useI18n();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);
const { titleBySlug } = useNamespace();
const toast = useToast();
const { confirm } = useConfirm();
const { getToken } = usePlansAuth();
const { canManageCatalog } = usePlansStaffRole();

useHead(() => ({ title: `${t('plans.catalog')} — ${titleBySlug(nsSlug.value) || t('app.plans')}` }));

const tab = ref<'services' | 'masters'>('services');
const booting = ref(true);
const categories = ref<ServiceCategory[]>([]);
const services = ref<PlansService[]>([]);
const masters = ref<PlansMaster[]>([]);
const locations = ref<PlansLocation[]>([]);

const catName = (id?: string | null) => id ? (categories.value.find(c => c.id === id)?.name || '') : '';
const locName = (id?: string | null) => id ? (locations.value.find(l => l.id === id)?.name || '') : '';
const categoryOptions = computed(() => [
  { label: t('plans.noCategory') || 'Без категории', value: '' },
  ...categories.value.map(c => ({ label: c.name, value: c.id })),
]);
const locationOptions = computed(() => locations.value.map(l => ({ label: l.name, value: l.id })));

async function loadAll() {
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
  }
}

// --- category quick-add ---
const newCat = ref('');
async function addCat() {
  if (!newCat.value.trim()) return;
  try {
    await plansApi.createCategory(nsSlug.value, { name: newCat.value.trim(), sortOrder: categories.value.length });
    newCat.value = ''; await loadAll();
  } catch (e) { toast.add({ title: t('common.error'), description: getErrorMessage(e, t), color: 'red' }); }
}
async function delCat(c: ServiceCategory) {
  if (!await confirm({ message: t('plans.confirmDeleteCategory') || `Удалить категорию «${c.name}»?`, color: 'red' })) return;
  try { await plansApi.deleteCategory(nsSlug.value, c.id); await loadAll(); }
  catch (e) { toast.add({ title: t('common.error'), description: getErrorMessage(e, t), color: 'red' }); }
}

// --- service modal ---
const svcModal = ref(false);
const svcSaving = ref(false);
const svcEditing = ref<PlansService | null>(null);
const svcForm = reactive({ name: '', categoryId: '', durationMinutes: 30, bufferAfterMinutes: 0, price: 0, requiresMaster: false, color: '#7c3aed', description: '' });
// masters allowed to perform this service; empty = anyone
const svcMasterIds = ref<string[]>([]);
async function openSvc(s?: PlansService) {
  svcEditing.value = s || null;
  Object.assign(svcForm, s
    ? { name: s.name, categoryId: s.categoryId || '', durationMinutes: s.durationMinutes, bufferAfterMinutes: s.bufferAfterMinutes, price: s.price, requiresMaster: s.requiresMaster, color: s.color || '#7c3aed', description: s.description }
    : { name: '', categoryId: '', durationMinutes: 30, bufferAfterMinutes: 0, price: 0, requiresMaster: false, color: '#7c3aed', description: '' });
  svcMasterIds.value = [];
  svcModal.value = true;
  if (s) {
    try { svcMasterIds.value = (await plansApi.serviceMasters(nsSlug.value, s.id)).map(x => x.masterId); }
    catch { /* leave empty */ }
  }
}
async function saveSvc() {
  if (!svcForm.name.trim() || svcForm.durationMinutes <= 0) {
    toast.add({ title: t('common.error'), description: t('plans.fillRequired'), color: 'red' }); return;
  }
  svcSaving.value = true;
  try {
    const input: any = { ...svcForm, name: svcForm.name.trim(), categoryId: svcForm.categoryId || null };
    let serviceId = svcEditing.value?.id;
    if (svcEditing.value) {
      await plansApi.updateService(nsSlug.value, {
        id: svcEditing.value.id, isActive: svcEditing.value.isActive, sortOrder: svcEditing.value.sortOrder,
        imageUrl: svcEditing.value.imageUrl, ...input,
      });
    } else {
      const created = await plansApi.createService(nsSlug.value, input);
      serviceId = created.id;
    }
    if (serviceId) {
      await plansApi.setServiceMasters(nsSlug.value, serviceId, svcMasterIds.value.map(masterId => ({ masterId })));
    }
    svcModal.value = false; await loadAll();
  } catch (e) { toast.add({ title: t('common.error'), description: getErrorMessage(e, t), color: 'red' }); }
  finally { svcSaving.value = false; }
}
async function toggleSvcActive(s: PlansService) {
  try {
    await plansApi.updateService(nsSlug.value, {
      id: s.id, name: s.name, description: s.description, categoryId: s.categoryId || null,
      durationMinutes: s.durationMinutes, bufferAfterMinutes: s.bufferAfterMinutes, price: s.price,
      requiresMaster: s.requiresMaster, color: s.color, imageUrl: s.imageUrl, sortOrder: s.sortOrder,
      isActive: !s.isActive,
    });
    await loadAll();
  } catch (e) { toast.add({ title: t('common.error'), description: getErrorMessage(e, t), color: 'red' }); }
}
async function delSvc(s: PlansService) {
  if (!await confirm({ message: t('plans.confirmDeleteService') || `Удалить услугу «${s.name}»?`, color: 'red' })) return;
  try { await plansApi.deleteService(nsSlug.value, s.id); await loadAll(); }
  catch (e) { toast.add({ title: t('common.error'), description: getErrorMessage(e, t), color: 'red' }); }
}

// --- master modal ---
const mstModal = ref(false);
const mstSaving = ref(false);
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
  if (!mstForm.name.trim() || !mstForm.locationId) {
    toast.add({ title: t('common.error'), description: t('plans.fillRequired'), color: 'red' }); return;
  }
  mstSaving.value = true;
  try {
    let id = mstEditing.value?.id;
    if (mstEditing.value) {
      await plansApi.updateMaster(nsSlug.value, {
        id, isActive: mstEditing.value.isActive, sortOrder: mstEditing.value.sortOrder, photoUrl: mstEditing.value.photoUrl,
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
  if (!await confirm({ message: t('plans.confirmDeleteMaster') || `Удалить мастера «${m.name}»?`, color: 'red' })) return;
  try { await plansApi.deleteMaster(nsSlug.value, m.id); await loadAll(); }
  catch (e) { toast.add({ title: t('common.error'), description: getErrorMessage(e, t), color: 'red' }); }
}

onMounted(async () => {
  try { await getToken(nsSlug.value); await loadAll(); }
  catch (e) { toast.add({ title: t('common.error'), description: getErrorMessage(e, t), color: 'red' }); }
  finally { booting.value = false; }
});
</script>

<template>
  <div class="p-4 pb-safe-or-4 flex flex-col gap-4">
    <div class="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
      <div class="min-w-0">
        <h1 class="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">{{ t('plans.catalog') }}</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{{ t('plans.catalogSubtitle') || 'Услуги, категории и мастера' }}</p>
      </div>
      <UButton
        v-if="canManageCatalog" icon="lucide:settings" size="xs" color="primary" variant="soft"
        class="self-start sm:self-auto" :to="`/${nsSlug}/plans/settings`"
      >
        {{ t('plans.settings') || 'Настройки' }}
      </UButton>
    </div>
    <PlansNavTabs />

    <div class="flex items-center gap-1 border-b border-gray-200 dark:border-gray-800">
      <button
        class="px-3 py-2.5 text-sm font-medium border-b-2 -mb-px border-primary-500 text-primary-600 dark:text-primary-400"
        @click="tab = 'services'"
      >{{ t('plans.services') || 'Услуги' }}</button>
      <NuxtLink
        :to="`/${nsSlug}/plans/settings?tab=staff`"
        class="px-3 py-2.5 text-sm font-medium border-b-2 -mb-px border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 flex items-center gap-1"
      >{{ t('plans.masters') || 'Мастера' }} <UIcon name="lucide:arrow-up-right" class="w-3.5 h-3.5" /></NuxtLink>
    </div>

    <div v-if="booting" class="py-16 flex justify-center">
      <UIcon name="i-heroicons-arrow-path" class="w-7 h-7 animate-spin text-primary-500" />
    </div>

    <!-- SERVICES -->
    <template v-else-if="tab === 'services'">
      <UCard :ui="{ body: { padding: 'p-3 sm:p-4' } }">
        <div class="flex items-center gap-2 flex-wrap">
          <UInput v-model="newCat" size="xs" :placeholder="t('plans.newCategory') || 'Новая категория'" class="w-48" @keydown.enter="addCat" />
          <UButton size="xs" variant="soft" color="gray" icon="lucide:folder-plus" @click="addCat">{{ t('common.add') || 'Добавить' }}</UButton>
          <div class="flex flex-wrap gap-1.5">
            <UBadge v-for="c in categories" :key="c.id" color="gray" variant="subtle" size="sm" class="gap-1">
              {{ c.name }}
              <button class="opacity-50 hover:opacity-100" @click="delCat(c)"><UIcon name="lucide:x" class="w-3 h-3" /></button>
            </UBadge>
          </div>
        </div>
      </UCard>

      <div class="flex justify-end">
        <UButton v-if="canManageCatalog" size="sm" icon="lucide:plus" @click="openSvc()">{{ t('plans.addService') || 'Услуга' }}</UButton>
      </div>

      <div v-if="!services.length" class="py-10 text-center text-gray-500">{{ t('plans.noServices') || 'Услуг пока нет' }}</div>
      <div v-else class="flex flex-col gap-2">
        <div v-for="s in services" :key="s.id"
             class="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 flex items-center gap-3"
             :class="{ 'opacity-55': !s.isActive }">
          <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" :style="{ background: s.color || '#7c3aed' }" />
          <div class="flex-1 min-w-0">
            <div class="font-medium text-gray-900 dark:text-white truncate">{{ s.name }}</div>
            <div class="text-xs text-gray-500 truncate">
              <span v-if="catName(s.categoryId)">{{ catName(s.categoryId) }} · </span>
              {{ s.durationMinutes }} {{ t('plans.min') || 'мин' }}<span v-if="s.bufferAfterMinutes"> +{{ s.bufferAfterMinutes }}</span>
              <span v-if="s.price"> · {{ s.price }}</span>
              · {{ s.requiresMaster ? (t('plans.needsMaster') || 'нужен мастер') : (t('plans.anyMaster') || 'любой') }}
            </div>
          </div>
          <template v-if="canManageCatalog">
            <UToggle :model-value="s.isActive" size="sm" @update:model-value="toggleSvcActive(s)" />
            <UButton size="2xs" variant="ghost" color="gray" icon="lucide:pencil" @click="openSvc(s)" />
            <UButton size="2xs" variant="ghost" color="red" icon="lucide:trash-2" @click="delSvc(s)" />
          </template>
        </div>
      </div>
    </template>

    <!-- MASTERS -->
    <template v-else>
      <div class="flex justify-end">
        <UButton v-if="canManageCatalog" size="sm" icon="lucide:plus" @click="openMst()">{{ t('plans.addMaster') || 'Мастер' }}</UButton>
      </div>
      <div v-if="!masters.length" class="py-10 text-center text-gray-500">{{ t('plans.noMasters') || 'Мастеров пока нет' }}</div>
      <div v-else class="flex flex-col gap-2">
        <div v-for="m in masters" :key="m.id"
             class="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 flex items-center gap-3"
             :class="{ 'opacity-55': !m.isActive }">
          <span class="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
                :style="{ background: m.color || '#7c3aed' }">{{ m.name.slice(0, 1).toUpperCase() }}</span>
          <div class="flex-1 min-w-0">
            <div class="font-medium text-gray-900 dark:text-white truncate">{{ m.name }}</div>
            <div class="text-xs text-gray-500 truncate">{{ locName(m.locationId) }}<span v-if="m.phone"> · {{ m.phone }}</span></div>
          </div>
          <NuxtLink :to="`/${nsSlug}/plans/settings?master=${m.id}`"
                    class="text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline whitespace-nowrap">
            {{ t('plans.schedule') || 'Расписание' }}
          </NuxtLink>
          <template v-if="canManageCatalog">
            <UToggle :model-value="m.isActive" size="sm" @update:model-value="toggleMstActive(m)" />
            <UButton size="2xs" variant="ghost" color="gray" icon="lucide:pencil" @click="openMst(m)" />
            <UButton size="2xs" variant="ghost" color="red" icon="lucide:trash-2" @click="delMst(m)" />
          </template>
        </div>
      </div>
    </template>

    <!-- service modal -->
    <UModal v-model="svcModal" :ui="{ width: 'sm:max-w-lg' }">
      <UCard :ui="{ body: { padding: 'p-4 sm:p-5' } }">
        <template #header>
          <h3 class="text-base font-semibold">{{ svcEditing ? (t('plans.editService') || 'Услуга') : (t('plans.addService') || 'Новая услуга') }}</h3>
        </template>
        <div class="space-y-3.5">
          <UFormGroup :label="t('plans.serviceName') || 'Название'" required>
            <UInput v-model="svcForm.name" autofocus @keyup.enter="saveSvc" />
          </UFormGroup>
          <UFormGroup :label="t('plans.category') || 'Категория'">
            <USelectMenu v-model="svcForm.categoryId" :options="categoryOptions" value-attribute="value" option-attribute="label" :popper="{ strategy: 'fixed' }" />
          </UFormGroup>
          <div class="grid grid-cols-3 gap-3">
            <UFormGroup :label="t('plans.durationMin') || 'Длит., мин'">
              <UInput v-model.number="svcForm.durationMinutes" type="number" min="5" step="5" />
            </UFormGroup>
            <UFormGroup :label="t('plans.bufferMin') || 'Буфер, мин'">
              <UInput v-model.number="svcForm.bufferAfterMinutes" type="number" min="0" step="5" />
            </UFormGroup>
            <UFormGroup :label="t('plans.price') || 'Цена'">
              <UInput v-model.number="svcForm.price" type="number" min="0" />
            </UFormGroup>
          </div>
          <UFormGroup :label="t('plans.color') || 'Цвет'">
            <ColorSwatch v-model="svcForm.color" size="sm" />
          </UFormGroup>
          <UFormGroup
            :label="t('plans.requiresMaster') || 'Требуется выбор мастера'"
            :help="t('plans.requiresMasterHint') || 'Выключено — запись на ресурс (корт, поле, бокс) или к любому свободному мастеру'"
          >
            <UToggle v-model="svcForm.requiresMaster" />
          </UFormGroup>
          <UFormGroup :label="t('plans.serviceMasters') || 'Кто выполняет'" :hint="t('plans.serviceMastersHint') || 'Пусто — любой мастер'">
            <USelectMenu
              v-model="svcMasterIds" multiple
              :options="masters.map(m => ({ label: m.name, value: m.id }))"
              value-attribute="value" option-attribute="label"
              :placeholder="t('plans.anyMaster') || 'Любой мастер'"
              :popper="{ strategy: 'fixed' }" />
          </UFormGroup>
        </div>
        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton variant="ghost" color="gray" @click="svcModal = false">{{ t('common.cancel') || 'Отмена' }}</UButton>
            <UButton :loading="svcSaving" @click="saveSvc">{{ t('common.save') || 'Сохранить' }}</UButton>
          </div>
        </template>
      </UCard>
    </UModal>

    <!-- master modal -->
    <UModal v-model="mstModal" :ui="{ width: 'sm:max-w-lg' }">
      <UCard :ui="{ body: { padding: 'p-4 sm:p-5' } }">
        <template #header>
          <h3 class="text-base font-semibold">{{ mstEditing ? (t('plans.editMaster') || 'Мастер') : (t('plans.addMaster') || 'Новый мастер') }}</h3>
        </template>
        <div class="space-y-3.5">
          <div class="grid grid-cols-2 gap-3">
            <UFormGroup :label="t('plans.masterName') || 'Имя'" required>
              <UInput v-model="mstForm.name" autofocus @keyup.enter="saveMst" />
            </UFormGroup>
            <UFormGroup :label="t('plans.clientPhone') || 'Телефон'">
              <PhoneInput v-model="mstForm.phone" />
            </UFormGroup>
          </div>
          <UFormGroup :label="t('plans.location') || 'Точка'" required>
            <USelectMenu v-model="mstForm.locationId" :options="locationOptions" value-attribute="value" option-attribute="label" :popper="{ strategy: 'fixed' }" />
          </UFormGroup>
          <UFormGroup :label="t('plans.color') || 'Цвет'">
            <ColorSwatch v-model="mstForm.color" size="sm" />
          </UFormGroup>
          <UFormGroup :label="t('plans.performsServices') || 'Оказывает услуги'">
            <div class="flex flex-col gap-1.5 max-h-44 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-800 p-2">
              <UCheckbox
                v-for="s in services" :key="s.id" :label="s.name"
                :model-value="mstServiceIds.includes(s.id)"
                @update:model-value="(v: boolean) => v ? mstServiceIds.push(s.id) : (mstServiceIds = mstServiceIds.filter(x => x !== s.id))"
              />
              <p v-if="!services.length" class="text-xs text-gray-400 px-1">{{ t('plans.noServices') || 'Сначала добавьте услуги' }}</p>
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
  </div>
</template>
