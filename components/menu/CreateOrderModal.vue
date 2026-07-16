<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { useMenuToken } from '@/composables/useMenuToken';
import { logError } from '@/utils/logger';
import { getErrorMessage } from '@/utils/types/errors';
import type { MenuBranch } from '@/api/menu/branch/list';
import type { MenuItem } from '@/api/menu/menuitem/list';
import type { MenuCategory } from '@/api/menu/category/list';

const { t } = useI18n();

const props = defineProps<{
  modelValue: boolean;
  nsSlug: string;
  branches: MenuBranch[];
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

type CartLine = { menuItemId: string; name: string; price: number; quantity: number };

const form = reactive({
  type: 'delivery' as 'pickup' | 'delivery',
  branchId: '',
  phone: '',
  customerName: '',
  deliveryAddress: '',
  comment: '',
});

// Same phone sanitize/validate rules as the Contacts app's client-create form.
function sanitizePhoneInput(value: string): string {
  return value.replace(/[^\d+()\s-]/g, '');
}
function updatePhoneValue(value: string) {
  form.phone = sanitizePhoneInput(value);
}
const isPhoneValid = computed(() => {
  const digits = form.phone.replace(/\D/g, '');
  return digits.length >= 10;
});

const cart = ref<CartLine[]>([]);
const itemSearch = ref('');
const items = ref<MenuItem[]>([]);
const itemsLoading = ref(false);
const itemsLoaded = ref(false);
const categories = ref<MenuCategory[]>([]);

const branchOptions = computed(() => props.branches.map((b) => ({ label: b.name, value: b.id })));
const categoryOptions = computed(() => categories.value.map((c) => ({ label: c.name, value: c.id })));

async function loadItems() {
  if (itemsLoaded.value || itemsLoading.value) return;
  itemsLoading.value = true;
  try {
    const { current } = useMenuToken();
    const menuToken = current();
    if (!menuToken) return;
    const [{ menuMenuItemsList }, { menuCategoriesList }] = await Promise.all([
      import('@/api/menu/menuitem/list'),
      import('@/api/menu/category/list'),
    ]);
    const [itemsRes, categoriesRes] = await Promise.all([
      menuMenuItemsList(menuToken, props.nsSlug),
      menuCategoriesList(menuToken, props.nsSlug),
    ]);
    items.value = itemsRes.items.filter((i) => i.isActive);
    categories.value = categoriesRes.categories.filter((c) => c.isActive);
    itemsLoaded.value = true;
  } catch (e) {
    logError('[CreateOrderModal] loadItems failed', e);
  } finally {
    itemsLoading.value = false;
  }
}

const filteredItems = computed(() => {
  const q = itemSearch.value.trim().toLowerCase();
  if (!q) return items.value;
  return items.value.filter((i) => i.name.toLowerCase().includes(q));
});

function addToCart(item: MenuItem) {
  const existing = cart.value.find((l) => l.menuItemId === item.id);
  if (existing) existing.quantity += 1;
  else cart.value.push({ menuItemId: item.id, name: item.name, price: item.price, quantity: 1 });
}

function changeQuantity(line: CartLine, delta: number) {
  line.quantity += delta;
  if (line.quantity <= 0) cart.value = cart.value.filter((l) => l.menuItemId !== line.menuItemId);
}

const cartTotal = computed(() => cart.value.reduce((sum, l) => sum + l.quantity * l.price, 0));
const cartCount = computed(() => cart.value.reduce((sum, l) => sum + l.quantity, 0));

// --- Quick "new item" creation, inline ---
const isQuickAddOpen = ref(false);
const quickAddSaving = ref(false);
const quickAddForm = reactive({ name: '', price: '', categoryId: '' });

function toggleQuickAdd() {
  isQuickAddOpen.value = !isQuickAddOpen.value;
  if (isQuickAddOpen.value) {
    quickAddForm.name = itemSearch.value.trim();
    quickAddForm.price = '';
    quickAddForm.categoryId = categories.value[0]?.id || '';
  }
}

const isQuickAddValid = computed(() =>
  quickAddForm.name.trim().length > 0 && Number(quickAddForm.price) > 0 && !!quickAddForm.categoryId
);

async function submitQuickAdd() {
  if (!isQuickAddValid.value || quickAddSaving.value) return;
  quickAddSaving.value = true;
  try {
    const { current } = useMenuToken();
    const menuToken = current();
    if (!menuToken) return;
    const { menuCreateMenuItem } = await import('@/api/menu/menuitem/create');
    const created = await menuCreateMenuItem(menuToken, props.nsSlug, {
      categoryId: quickAddForm.categoryId,
      name: quickAddForm.name.trim(),
      price: Number(quickAddForm.price),
    });
    items.value = [{ ...created, badgeIds: [], excludedBranchIds: [] } as MenuItem, ...items.value];
    addToCart(created as MenuItem);
    isQuickAddOpen.value = false;
    itemSearch.value = '';
  } catch (e) {
    logError('[CreateOrderModal] submitQuickAdd failed', e);
    useToast().add({ title: getErrorMessage(e) || 'Failed to create item', color: 'red' });
  } finally {
    quickAddSaving.value = false;
  }
}

watch(() => props.modelValue, (open) => {
  if (!open) return;
  loadItems();
  form.type = 'delivery';
  form.branchId = '';
  form.phone = '';
  form.customerName = '';
  form.deliveryAddress = '';
  form.comment = '';
  cart.value = [];
  itemSearch.value = '';
  isQuickAddOpen.value = false;
}, { immediate: true });

const isFormValid = computed(() => {
  if (!isPhoneValid.value) return false;
  if (form.type === 'delivery' && !form.deliveryAddress.trim()) return false;
  if (form.type === 'pickup' && !form.branchId) return false;
  return cart.value.length > 0;
});

function handleClose() {
  isOpen.value = false;
}

function handleSubmit() {
  if (!isFormValid.value) return;
  emit('submit', {
    branchId: form.branchId || undefined,
    phone: form.phone.trim(),
    customerName: form.customerName.trim() || undefined,
    type: form.type,
    deliveryAddress: form.type === 'delivery' ? form.deliveryAddress.trim() : undefined,
    comment: form.comment.trim() || undefined,
    sourceTag: 'manual',
    totalAmount: cartTotal.value,
    items: cart.value.map((l) => ({
      menuItemId: l.menuItemId,
      name: l.name,
      priceAtPurchase: l.price,
      quantity: l.quantity,
    })),
  });
}
</script>

<template>
  <UModal v-model="isOpen" :ui="{ width: 'sm:max-w-xl' }" @close="handleClose">
    <UCard :ui="{ ring: '', divide: 'divide-y divide-gray-100 dark:divide-gray-800', body: { padding: 'p-0 sm:p-0' } }">
      <template #header>
        <div class="flex items-center gap-2.5">
          <span class="flex h-8 w-8 items-center justify-center rounded-xl bg-primary-100 dark:bg-primary-900/40">
            <Icon name="lucide:receipt" class="h-4 w-4 text-primary-600 dark:text-primary-300" />
          </span>
          <h3 class="text-lg font-semibold">
            {{ t('menu.createOrder') || 'Create order' }}
          </h3>
        </div>
      </template>

      <div class="max-h-[72vh] overflow-y-auto px-5 py-4 space-y-5">
        <!-- Fulfilment type -->
        <div class="flex gap-2">
          <button
            class="flex-1 flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all duration-200"
            :class="form.type === 'pickup'
              ? 'border-primary-300 bg-primary-50 text-primary-700 shadow-sm dark:border-primary-700 dark:bg-primary-950/30 dark:text-primary-300'
              : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400'"
            @click="form.type = 'pickup'"
          >
            <Icon name="lucide:store" class="h-4 w-4" />
            {{ t('menu.pickup') || 'Pickup' }}
          </button>
          <button
            class="flex-1 flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all duration-200"
            :class="form.type === 'delivery'
              ? 'border-primary-300 bg-primary-50 text-primary-700 shadow-sm dark:border-primary-700 dark:bg-primary-950/30 dark:text-primary-300'
              : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400'"
            @click="form.type = 'delivery'"
          >
            <Icon name="lucide:truck" class="h-4 w-4" />
            {{ t('menu.delivery') || 'Delivery' }}
          </button>
        </div>

        <!-- Contact section -->
        <div class="rounded-xl bg-gray-50 dark:bg-gray-800/40 p-3.5 space-y-3">
          <div class="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            <Icon name="lucide:user-round" class="h-3.5 w-3.5" />
            {{ t('menu.contactInfo') || 'Contact details' }}
          </div>

          <div class="grid grid-cols-2 gap-3">
            <UFormGroup
              :label="t('menu.phone') || 'Phone'"
              required
              :help="!isPhoneValid && form.phone ? (t('contacts.invalidPhone') || 'Invalid phone format') : ''"
              :error="!!(form.phone && !isPhoneValid)"
            >
              <UInput
                :model-value="form.phone"
                type="tel"
                inputmode="tel"
                pattern="[0-9+()\s-]*"
                icon="lucide:phone"
                :placeholder="t('contacts.enterPhone') || '+7 700 123 45 67'"
                :ui="{ rounded: 'rounded-xl' }"
                @update:model-value="updatePhoneValue"
              />
            </UFormGroup>
            <UFormGroup :label="t('menu.name') || 'Name'">
              <UInput v-model="form.customerName" icon="lucide:user" :ui="{ rounded: 'rounded-xl' }" />
            </UFormGroup>
          </div>

          <UFormGroup v-if="form.type === 'delivery'" :label="t('menu.address') || 'Address'" required>
            <UInput v-model="form.deliveryAddress" icon="lucide:home" :ui="{ rounded: 'rounded-xl' }" />
          </UFormGroup>

          <UFormGroup :label="t('menu.branch') || 'Branch'" :required="form.type === 'pickup'">
            <USelectMenu
              v-model="form.branchId"
              icon="lucide:map-pin"
              :options="branchOptions"
              value-attribute="value"
              option-attribute="label"
              :placeholder="t('menu.chooseBranch') || 'Choose a branch'"
              :ui="{ rounded: 'rounded-xl' }"
            />
          </UFormGroup>
        </div>

        <!-- Items section -->
        <div>
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              <Icon name="lucide:shopping-bag" class="h-3.5 w-3.5" />
              {{ t('menu.menuItems') || 'Items' }}
              <span v-if="cartCount" class="text-primary-600 dark:text-primary-300 normal-case font-semibold">({{ cartCount }})</span>
            </div>
            <button
              class="flex items-center gap-1 text-xs font-medium text-primary-600 dark:text-primary-300 hover:text-primary-700 dark:hover:text-primary-200"
              @click="toggleQuickAdd"
            >
              <Icon :name="isQuickAddOpen ? 'lucide:x' : 'lucide:sparkles'" class="h-3.5 w-3.5" />
              {{ isQuickAddOpen ? (t('app.cancel') || 'Cancel') : (t('menu.quickNewItem') || 'New item') }}
            </button>
          </div>

          <!-- Quick add item inline form -->
          <div
            v-if="isQuickAddOpen"
            class="mb-3 rounded-xl border border-primary-200 dark:border-primary-800 bg-primary-50/50 dark:bg-primary-950/20 p-3 space-y-2.5"
          >
            <div class="grid grid-cols-2 gap-2">
              <UInput v-model="quickAddForm.name" size="sm" :placeholder="t('menu.name') || 'Name'" :ui="{ rounded: 'rounded-lg' }" />
              <UInput v-model="quickAddForm.price" type="number" size="sm" :placeholder="t('menu.price') || 'Price'" :ui="{ rounded: 'rounded-lg' }" />
            </div>
            <USelectMenu
              v-model="quickAddForm.categoryId"
              size="sm"
              :options="categoryOptions"
              value-attribute="value"
              option-attribute="label"
              :placeholder="t('menu.selectCategory') || 'Select category'"
              :ui="{ rounded: 'rounded-lg' }"
            />
            <UButton
              block
              size="sm"
              color="primary"
              :label="t('menu.addAndUse') || 'Add & use in order'"
              :loading="quickAddSaving"
              :disabled="!isQuickAddValid || quickAddSaving"
              class="rounded-lg justify-center"
              @click="submitQuickAdd"
            />
          </div>

          <UInput
            v-model="itemSearch"
            icon="lucide:search"
            :placeholder="t('menu.searchItems') || 'Search items'"
            size="sm"
            class="mb-2"
            :ui="{ rounded: 'rounded-lg' }"
          />
          <div class="max-h-36 overflow-y-auto rounded-xl border border-gray-100 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
            <div v-if="itemsLoading" class="px-3 py-4 text-center text-sm text-gray-400">
              {{ t('app.loading') || 'Loading...' }}
            </div>
            <div v-else-if="filteredItems.length === 0" class="px-3 py-4 text-center text-sm text-gray-400">
              {{ t('menu.noMenuItems') || 'No items' }}
            </div>
            <button
              v-for="item in filteredItems"
              :key="item.id"
              class="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
              @click="addToCart(item)"
            >
              <span class="text-sm">{{ item.name }}</span>
              <span class="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 tabular-nums">
                {{ item.price }}
                <Icon name="lucide:plus-circle" class="h-4 w-4 text-primary-500 flex-shrink-0" />
              </span>
            </button>
          </div>

          <div v-if="cart.length" class="mt-3 rounded-xl bg-gray-50 dark:bg-gray-800/40 divide-y divide-gray-200/70 dark:divide-gray-700/50">
            <div
              v-for="line in cart"
              :key="line.menuItemId"
              class="flex items-center justify-between gap-2 px-3 py-2"
            >
              <span class="text-sm flex-1 truncate">{{ line.name }}</span>
              <div class="flex items-center gap-1.5">
                <UButton icon="lucide:minus" size="2xs" color="gray" variant="soft" square class="rounded-lg" @click="changeQuantity(line, -1)" />
                <span class="w-5 text-center text-sm tabular-nums">{{ line.quantity }}</span>
                <UButton icon="lucide:plus" size="2xs" color="gray" variant="soft" square class="rounded-lg" @click="changeQuantity(line, 1)" />
              </div>
              <span class="text-sm w-16 text-right tabular-nums font-medium">{{ line.price * line.quantity }}</span>
            </div>
          </div>
        </div>

        <UFormGroup :label="t('menu.comment') || 'Comment'">
          <UTextarea v-model="form.comment" :rows="2" :ui="{ rounded: 'rounded-xl' }" />
        </UFormGroup>
      </div>

      <template #footer>
        <div class="flex items-center justify-between gap-3">
          <div>
            <span class="block text-xs text-gray-500 dark:text-gray-400">{{ t('menu.total') || 'Total' }}</span>
            <span class="block text-xl font-bold tabular-nums">{{ cartTotal }}</span>
          </div>
          <div class="flex gap-2">
            <UButton color="gray" variant="ghost" :label="t('app.cancel')" @click="handleClose" />
            <UButton
              color="primary"
              icon="lucide:check"
              :label="saving ? (t('app.loading') || 'Loading...') : (t('menu.createOrder') || 'Create order')"
              :loading="saving"
              :disabled="!isFormValid || saving"
              class="rounded-xl px-4"
              @click="handleSubmit"
            />
          </div>
        </div>
      </template>
    </UCard>
  </UModal>
</template>
