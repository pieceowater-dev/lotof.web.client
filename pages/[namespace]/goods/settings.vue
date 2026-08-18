<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { useGoodsToken } from '@/composables/useGoodsToken';
import { useGoodsStaffRole, type GoodsStaffRole } from '@/composables/useGoodsStaffRole';
import { useNamespace } from '@/composables/useNamespace';
import { logError } from '@/utils/logger';
import { getErrorMessage } from '@/utils/types/errors';
import type { GoodsStaff } from '@/api/goods/staff';
import type { GoodsWarehouse, GoodsWarehouseType } from '@/api/goods/warehouse';
import type { GoodsSettings } from '@/api/goods/settings';

const { t } = useI18n();
const route = useRoute();
const nsSlug = computed(() => route.params.namespace as string);
const { titleBySlug } = useNamespace();
const { role: staffRole, isOwnerOrManager } = useGoodsStaffRole();

useHead(() => ({
  title: titleBySlug(nsSlug.value) ? `${t('goods.settings')} — ${titleBySlug(nsSlug.value)}` : t('goods.settings'),
}));

// Defense in depth: every mutation here is @goodsAuth(roles: [OWNER, MANAGER])
// server-side already, so a non-owner/manager who lands here directly
// (e.g. bookmarked URL) can't do anything anyway -- bounce back to the
// register instead of showing a page full of actions that will just fail.
watch(staffRole, (r) => {
  if (r && !isOwnerOrManager.value) navigateTo(`/${nsSlug.value}/goods/register`);
}, { immediate: true });

async function getToken(): Promise<string> {
  const { ensure, current } = useGoodsToken();
  const existing = current();
  if (existing) return existing;
  const { token: hubToken } = useAuth();
  if (!hubToken.value) throw new Error('No hub token');
  const token = await ensure(nsSlug.value, hubToken.value);
  if (!token) throw new Error('No goods token');
  return token;
}

const activeTab = ref<'staff' | 'warehouses' | 'general'>('staff');

// --- Staff ---
const staff = ref<GoodsStaff[]>([]);
const loadingStaff = ref(false);
const staffForm = reactive({ userId: '', role: 'CASHIER' as GoodsStaffRole });
const savingStaff = ref(false);
const ROLE_OPTIONS: GoodsStaffRole[] = ['OWNER', 'MANAGER', 'CASHIER', 'STOCKKEEPER', 'VIEWER'];

async function loadStaff() {
  loadingStaff.value = true;
  try {
    const goodsToken = await getToken();
    const { goodsListStaff } = await import('@/api/goods/staff');
    const { staff: s } = await goodsListStaff(goodsToken, nsSlug.value);
    staff.value = s;
  } catch (e) {
    logError('[goods/settings] loadStaff failed', e);
  } finally {
    loadingStaff.value = false;
  }
}

async function addStaff() {
  if (!staffForm.userId.trim()) return;
  savingStaff.value = true;
  try {
    const goodsToken = await getToken();
    const { goodsCreateStaff } = await import('@/api/goods/staff');
    await goodsCreateStaff(goodsToken, nsSlug.value, staffForm.userId.trim(), staffForm.role);
    staffForm.userId = '';
    await loadStaff();
  } catch (e) {
    logError('[goods/settings] addStaff failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to add staff', color: 'red' });
  } finally {
    savingStaff.value = false;
  }
}

async function updateRole(member: GoodsStaff, role: GoodsStaffRole) {
  try {
    const goodsToken = await getToken();
    const { goodsUpdateStaffRole } = await import('@/api/goods/staff');
    await goodsUpdateStaffRole(goodsToken, nsSlug.value, member.id, role);
    await loadStaff();
  } catch (e) {
    logError('[goods/settings] updateRole failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to update role', color: 'red' });
  }
}

async function removeStaff(member: GoodsStaff) {
  try {
    const goodsToken = await getToken();
    const { goodsDeleteStaff } = await import('@/api/goods/staff');
    await goodsDeleteStaff(goodsToken, nsSlug.value, member.id);
    await loadStaff();
  } catch (e) {
    logError('[goods/settings] removeStaff failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to remove staff', color: 'red' });
  }
}

// --- Warehouses ---
const warehouses = ref<GoodsWarehouse[]>([]);
const loadingWarehouses = ref(false);
const warehouseForm = reactive({ name: '', address: '', type: 'BOTH' as GoodsWarehouseType });
const savingWarehouse = ref(false);

async function loadWarehouses() {
  loadingWarehouses.value = true;
  try {
    const goodsToken = await getToken();
    const { goodsListWarehouses } = await import('@/api/goods/warehouse');
    const { warehouses: w } = await goodsListWarehouses(goodsToken, nsSlug.value);
    warehouses.value = w;
  } catch (e) {
    logError('[goods/settings] loadWarehouses failed', e);
  } finally {
    loadingWarehouses.value = false;
  }
}

async function addWarehouse() {
  if (!warehouseForm.name.trim() || !warehouseForm.address.trim()) return;
  savingWarehouse.value = true;
  try {
    const goodsToken = await getToken();
    const { goodsCreateWarehouse } = await import('@/api/goods/warehouse');
    await goodsCreateWarehouse(goodsToken, nsSlug.value, {
      name: warehouseForm.name.trim(), address: warehouseForm.address.trim(), type: warehouseForm.type,
    });
    warehouseForm.name = '';
    warehouseForm.address = '';
    await loadWarehouses();
  } catch (e) {
    logError('[goods/settings] addWarehouse failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to add warehouse', color: 'red' });
  } finally {
    savingWarehouse.value = false;
  }
}

// --- General settings ---
const settings = ref<GoodsSettings | null>(null);
const loadingSettings = ref(false);
const savingSettings = ref(false);

async function loadSettings() {
  loadingSettings.value = true;
  try {
    const goodsToken = await getToken();
    const { goodsGetSettings } = await import('@/api/goods/settings');
    settings.value = await goodsGetSettings(goodsToken, nsSlug.value);
  } catch (e) {
    logError('[goods/settings] loadSettings failed', e);
  } finally {
    loadingSettings.value = false;
  }
}

async function saveSettings() {
  if (!settings.value) return;
  savingSettings.value = true;
  try {
    const goodsToken = await getToken();
    const { goodsUpdateSettings } = await import('@/api/goods/settings');
    settings.value = await goodsUpdateSettings(goodsToken, nsSlug.value, settings.value);
    useToast().add({ title: t('common.saved'), color: 'green' });
  } catch (e) {
    logError('[goods/settings] saveSettings failed', e);
    useToast().add({ title: getErrorMessage(e, t) || 'Failed to save settings', color: 'red' });
  } finally {
    savingSettings.value = false;
  }
}

onMounted(() => {
  loadStaff();
  loadWarehouses();
  loadSettings();
});
</script>

<template>
  <div class="max-w-3xl mx-auto px-4 py-6 space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-bold text-gray-900 dark:text-white">{{ t('goods.settings') }}</h1>
      <UButton color="gray" variant="soft" icon="lucide:arrow-left" :to="`/${nsSlug}/goods`">{{ t('goods.warehouse') }}</UButton>
    </div>

    <div class="flex gap-2 border-b border-gray-200 dark:border-gray-800">
      <button
        v-for="tab in (['staff', 'warehouses', 'general'] as const)"
        :key="tab"
        type="button"
        class="px-3 py-2 text-sm font-medium border-b-2 -mb-px"
        :class="activeTab === tab ? 'border-primary-500 text-primary-600 dark:text-primary-400' : 'border-transparent text-gray-500 dark:text-gray-400'"
        @click="activeTab = tab"
      >
        {{ tab === 'staff' ? t('goods.staff') : tab === 'warehouses' ? t('goods.warehouse') : t('goods.generalSettings') }}
      </button>
    </div>

    <!-- Staff -->
    <div v-if="activeTab === 'staff'" class="space-y-4">
      <div class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
        <div v-for="m in staff" :key="m.id" class="flex items-center justify-between px-4 py-2.5 text-sm">
          <span class="font-medium text-gray-900 dark:text-white truncate">{{ m.userId }}</span>
          <div class="flex items-center gap-2">
            <USelectMenu
              :model-value="m.role"
              :options="ROLE_OPTIONS"
              size="xs"
              class="w-32"
              :popper="{ strategy: 'fixed' }"
              @update:model-value="(v: GoodsStaffRole) => updateRole(m, v)"
            />
            <UButton color="red" variant="ghost" icon="lucide:trash-2" size="2xs" @click="removeStaff(m)" />
          </div>
        </div>
        <div v-if="!loadingStaff && !staff.length" class="px-4 py-8 text-center text-sm text-gray-400">—</div>
      </div>

      <div class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-3">
        <div class="flex gap-2">
          <UInput v-model="staffForm.userId" class="flex-1" :placeholder="t('goods.userId')" @keyup.enter="addStaff" />
          <USelectMenu v-model="staffForm.role" :options="ROLE_OPTIONS" class="w-36" :popper="{ strategy: 'fixed' }" />
          <UButton color="primary" icon="lucide:plus" :loading="savingStaff" @click="addStaff">{{ t('goods.addStaff') }}</UButton>
        </div>
      </div>
    </div>

    <!-- Warehouses -->
    <div v-else-if="activeTab === 'warehouses'" class="space-y-4">
      <div class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
        <div v-for="w in warehouses" :key="w.id" class="flex items-center justify-between px-4 py-2.5 text-sm">
          <div>
            <div class="font-medium text-gray-900 dark:text-white">{{ w.name }}</div>
            <div class="text-gray-400">{{ w.address }}</div>
          </div>
          <UBadge color="gray" variant="soft">{{ w.type }}</UBadge>
        </div>
      </div>

      <div class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-3">
        <UFormGroup :label="t('goods.warehouseName')">
          <UInput v-model="warehouseForm.name" @keyup.enter="addWarehouse" />
        </UFormGroup>
        <UFormGroup :label="t('goods.warehouseAddress')">
          <UInput v-model="warehouseForm.address" @keyup.enter="addWarehouse" />
        </UFormGroup>
        <UFormGroup :label="t('goods.warehouseType')">
          <USelectMenu
            v-model="warehouseForm.type"
            :options="[
              { label: t('goods.warehouseTypeBoth'), value: 'BOTH' },
              { label: t('goods.warehouseTypeShop'), value: 'SHOP' },
              { label: t('goods.warehouseTypeStorage'), value: 'STORAGE' },
            ]"
            value-attribute="value"
            option-attribute="label"
            :popper="{ strategy: 'fixed' }"
          />
        </UFormGroup>
        <UButton color="primary" icon="lucide:plus" :loading="savingWarehouse" @click="addWarehouse">{{ t('goods.createWarehouse') }}</UButton>
      </div>
    </div>

    <!-- General -->
    <div v-else-if="settings" class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-3">
      <UFormGroup :label="t('goods.currency')">
        <UInput v-model="settings.currency" class="max-w-[140px]" />
      </UFormGroup>
      <UFormGroup :label="t('goods.maxCashierDiscount')">
        <UInput v-model.number="settings.maxCashierDiscountPercent" type="number" min="0" max="100" class="max-w-[140px]" />
      </UFormGroup>
      <UFormGroup :label="t('goods.receiptFooter')">
        <UTextarea v-model="settings.receiptFooterText" :rows="2" />
      </UFormGroup>
      <UButton color="primary" :loading="savingSettings" @click="saveSettings">{{ t('common.save') }}</UButton>
    </div>
  </div>
</template>
