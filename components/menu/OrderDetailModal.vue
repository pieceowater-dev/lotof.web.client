<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { useMenuToken } from '@/composables/useMenuToken';
import { useContactsToken } from '@/composables/useContactsToken';
import { useConfirm } from '@/composables/useConfirm';
import { logError } from '@/utils/logger';
import { getErrorMessage } from '@/utils/types/errors';
import { formatDisplayPhoneUniversal } from '@/utils/phone';
import { FilterPaginationLengthEnum } from '@gql-hub';
import { telHref, whatsappHref } from '@/utils/phoneLinks';
import { twoGisSearchHref } from '@/utils/geo';
import { smartOrderNumber } from '@/utils/orderNumber';
import { statusBadgeStyle, nextStatuses } from '@/utils/orderStatus';
import OrderHistoryTimeline from '@/components/menu/OrderHistoryTimeline.vue';
import type { MenuOrder } from '@/api/menu/order/list';
import type { MenuOrderItem } from '@/api/menu/order/items';
import type { MenuOrderHistoryEntry } from '@/api/menu/order/history';
import type { MenuOrderMember } from '@/api/menu/order/members';
import type { MenuBranch } from '@/api/menu/branch/list';
import type { MenuItem } from '@/api/menu/menuitem/list';
import type { MenuBadge } from '@/api/menu/badge/list';
import type { MenuCategory } from '@/api/menu/category/list';

const { t } = useI18n();
const { confirm } = useConfirm();
const route = useRoute();
const router = useRouter();
const nsSlug = computed(() => route.params.namespace as string);
const { token: hubToken, user: currentUser, fetchUser } = useAuth();

const props = defineProps<{
  modelValue: boolean;
  order: MenuOrder | null;
  branches?: MenuBranch[];
  sourceTagOptions?: { sourceTag: string; label: string }[];
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
  (e: 'statusChanged', order: MenuOrder): void;
  (e: 'openOrder', orderId: string): void;
}>();

const isOpen = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
});

const statusLabel = (s: string) => ({
  NEW: t('menu.statusNew') || 'New',
  ACCEPTED: t('menu.statusAccepted') || 'Accepted',
  IN_PREPARATION: t('menu.statusInPreparation') || 'Preparing',
  READY: t('menu.statusReady') || 'Ready',
  DELIVERING: t('menu.statusDelivering') || 'On the way',
  COMPLETED: t('menu.statusCompleted') || 'Completed',
  CANCELLED: t('menu.statusCancelled') || 'Cancelled',
}[s] || s);

const roleLabel = (r: string) => ({
  OWNER: t('menu.roleOwner') || 'Owner',
  MANAGER: t('menu.roleManager') || 'Manager',
  COOK: t('menu.roleCook') || 'Cook',
  OPERATOR: t('menu.roleOperator') || 'Operator',
  COURIER: t('menu.roleCourier') || 'Courier',
}[r] || r);

const branchById = computed(() => {
  const map: Record<string, MenuBranch> = {};
  for (const b of props.branches || []) map[b.id] = b;
  return map;
});

// Resolves a sourceTag to the share link's human-readable label instead of
// the raw tag value — same mapping used by the admin list's source filter.
// A tag that doesn't match any current share link (e.g. one that's since
// been deleted) falls back to the raw value rather than disappearing silently.
function sourceTagLabel(tag: string): string {
  return props.sourceTagOptions?.find((s) => s.sourceTag === tag)?.label || tag;
}

const items = ref<MenuOrderItem[]>([]);
const history = ref<MenuOrderHistoryEntry[]>([]);
const members = ref<MenuOrderMember[]>([]);
const loading = ref(false);
const updatingStatus = ref(false);
const isMobileTimelineOpen = ref(false);

// --- Real names for participants (namespace members, hub-resolved) ---
const hubMembers = ref<Array<{ userId: string; username: string; email: string }>>([]);
const memberNameById = computed<Record<string, string>>(() =>
  Object.fromEntries(hubMembers.value.map((m) => [m.userId, m.username || m.email]))
);
function memberDisplayName(userId: string): string {
  return memberNameById.value[userId] || (t('menu.unknownMember') || 'Unknown member');
}
async function loadHubMembers() {
  if (!hubToken.value || !nsSlug.value) return;
  try {
    const { hubNamespaceBySlug } = await import('@/api/hub/namespaces/get');
    const { hubMembersList } = await import('@/api/hub/members/list');
    const namespace = await hubNamespaceBySlug(hubToken.value, nsSlug.value);
    if (!namespace?.id) return;
    const collected: Array<{ userId: string; username: string; email: string }> = [];
    let page = 1;
    let batch: Array<{ userId: string; username: string; email: string }>;
    do {
      batch = await hubMembersList(hubToken.value, namespace.id, page, FilterPaginationLengthEnum.Fifty);
      collected.push(...batch);
      page += 1;
    } while (batch.length >= 50);
    hubMembers.value = collected;
  } catch (e) {
    logError('[OrderDetailModal] loadHubMembers failed', e);
  }
}

// Roles from the menu Staff settings — only members who actually have one
// can be assigned to an order (see menuAuth role checks; someone with no
// staff role couldn't do anything with the order even if assigned).
const staffRoleByUserId = ref<Record<string, string>>({});
async function loadStaffRoles() {
  try {
    const menuToken = await getToken();
    const { menuStaffList } = await import('@/api/menu/staff/list');
    const res = await menuStaffList(menuToken, nsSlug.value);
    staffRoleByUserId.value = Object.fromEntries(res.staff.map((s) => [s.userId, s.role]));
  } catch (e) {
    logError('[OrderDetailModal] loadStaffRoles failed', e);
  }
}

// --- Catalog (for clickable product detail + add existing / quick-create) ---
const catalogItems = ref<MenuItem[]>([]);
const catalogCategories = ref<MenuCategory[]>([]);
const catalogBadges = ref<MenuBadge[]>([]);
const catalogLoaded = ref(false);

async function loadCatalog() {
  try {
    const menuToken = await getToken();
    const [{ menuMenuItemsList }, { menuCategoriesList }, { menuBadgesList }] = await Promise.all([
      import('@/api/menu/menuitem/list'),
      import('@/api/menu/category/list'),
      import('@/api/menu/badge/list'),
    ]);
    const [itemsRes, categoriesRes, badgesRes] = await Promise.all([
      menuMenuItemsList(menuToken, nsSlug.value),
      menuCategoriesList(menuToken, nsSlug.value),
      menuBadgesList(menuToken, nsSlug.value),
    ]);
    catalogItems.value = itemsRes.items.filter((i) => i.isActive);
    catalogCategories.value = categoriesRes.categories.filter((c) => c.isActive);
    catalogBadges.value = badgesRes.badges;
    catalogLoaded.value = true;
  } catch (e) {
    logError('[OrderDetailModal] loadCatalog failed', e);
  }
}
function badgeById(id: string) {
  return catalogBadges.value.find((b) => b.id === id);
}

async function getToken(): Promise<string> {
  const { current } = useMenuToken();
  const menuToken = current();
  if (!menuToken) throw new Error('No menu token');
  return menuToken;
}

async function loadDetails() {
  if (!props.order) return;
  loading.value = true;
  try {
    const menuToken = await getToken();
    const [itemsRes, historyRes, membersRes] = await Promise.all([
      import('@/api/menu/order/items').then((m) => m.menuOrderItems(menuToken, nsSlug.value, props.order!.id)),
      import('@/api/menu/order/history').then((m) => m.menuOrderHistory(menuToken, nsSlug.value, props.order!.id)),
      import('@/api/menu/order/members').then((m) => m.menuOrderMembers(menuToken, nsSlug.value, props.order!.id)),
    ]);
    items.value = itemsRes;
    history.value = historyRes.slice().sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    members.value = membersRes;
  } catch (e) {
    logError('[OrderDetailModal] loadDetails failed', e);
    useToast().add({ title: getErrorMessage(e) || 'Failed to load order details', color: 'red' });
  } finally {
    loading.value = false;
  }
}

// --- Customer order history: this customer's other orders, so staff can
// spot repeat customers / past issues without leaving the detail view.
// Authenticated admin query, so (unlike the storefront's public lookup)
// there's no need to worry about someone looking up a stranger's phone.
const customerOrders = ref<MenuOrder[]>([]);
async function loadCustomerOrders() {
  if (!props.order?.phone) {
    customerOrders.value = [];
    return;
  }
  try {
    const menuToken = await getToken();
    const { menuOrdersList } = await import('@/api/menu/order/list');
    // The backend does a substring match on the raw stored phone, which has
    // no formatting — searching with a formatted number (e.g. "+7 777...")
    // would never match a stored "77777777777".
    const res = await menuOrdersList(menuToken, nsSlug.value, { search: props.order.phone.replace(/\D/g, ''), length: 'TEN' });
    customerOrders.value = res.orders
      .filter((o) => o.id !== props.order!.id && o.phone.replace(/\D/g, '') === props.order!.phone.replace(/\D/g, ''))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (e) {
    logError('[OrderDetailModal] loadCustomerOrders failed', e);
    customerOrders.value = [];
  }
}

// --- lota Contacts integration: view/link/create a client from this order's
// phone. Only relevant when the namespace actually has Contacts installed —
// that check is purely for UX (don't show a feature that would just error);
// the real access control is each service's own auth directives, so menu
// never needs to know Contacts is installed to enforce anything.
const contactsInstalled = ref(false);
const clientProfile = ref<import('@/api/contacts/listClients').ClientRow | null>(null);
const clientCandidate = ref<import('@/api/contacts/listClients').ClientRow | null>(null);
const clientPhoneIdentity = ref<import('@/api/contacts/identities').ClientIdentity | null>(null);
const clientLoading = ref(false);
const linkingClient = ref(false);
const creatingClient = ref(false);

function clientDisplayName(row: import('@/api/contacts/listClients').ClientRow): string {
  if (row.individual) {
    return [row.individual.firstName, row.individual.lastName].filter(Boolean).join(' ') || (t('menu.guestCustomer') || 'Guest');
  }
  if (row.legalEntity) {
    return row.legalEntity.brandName || row.legalEntity.legalName;
  }
  return row.client.shortId || row.client.id;
}

async function getContactsAuth(): Promise<string | null> {
  if (!nsSlug.value) return null;
  const { ensure } = useContactsToken();
  return ensure(nsSlug.value, hubToken.value);
}

async function loadClientIntegration() {
  clientProfile.value = null;
  clientCandidate.value = null;
  clientPhoneIdentity.value = null;
  if (!props.order || !hubToken.value) return;
  try {
    const { hubIsAppInNamespace } = await import('@/api/hub/namespaces/isAppInNamespace');
    contactsInstalled.value = await hubIsAppInNamespace(hubToken.value, nsSlug.value, 'pieceowater.contacts');
  } catch (e) {
    logError('[OrderDetailModal] hubIsAppInNamespace failed', e);
    contactsInstalled.value = false;
  }
  if (!contactsInstalled.value) return;

  clientLoading.value = true;
  try {
    const contactsToken = await getContactsAuth();
    if (!contactsToken) return;

    if (props.order.clientId) {
      const { getClient } = await import('@/api/contacts/getClient');
      clientProfile.value = await getClient(contactsToken, nsSlug.value, props.order.clientId);
      if (clientProfile.value) {
        const { getClientIdentities } = await import('@/api/contacts/identities');
        const res = await getClientIdentities(contactsToken, props.order.clientId, nsSlug.value);
        clientPhoneIdentity.value = res.clientIdentities.rows.find((i) => i.type === 'phone') || null;
      }
    } else if (props.order.phone) {
      const { getClientByIdentity } = await import('@/api/contacts/getClient');
      clientCandidate.value = await getClientByIdentity(contactsToken, nsSlug.value, 'phone', props.order.phone);
    }
  } catch (e) {
    logError('[OrderDetailModal] loadClientIntegration failed', e);
  } finally {
    clientLoading.value = false;
  }
}

// Keeps the linked Contacts client's name/phone in sync when staff edits
// them on the order — best-effort: a sync failure shouldn't undo or block
// the order save itself, since the order update already succeeded.
async function syncClientFromOrderEdit(customerName: string, phone: string) {
  if (!props.order?.clientId || !contactsInstalled.value || !clientProfile.value?.individual) return;
  try {
    const contactsToken = await getContactsAuth();
    if (!contactsToken) return;
    const { firstName, lastName } = splitCustomerName(customerName);
    const { contactsUpdateIndividualClient } = await import('@/api/contacts/mutations');
    // Echo back birthDate/gender — UpdateIndividualClient overwrites the
    // whole individual record, so omitting them would blank them out.
    await contactsUpdateIndividualClient(contactsToken, nsSlug.value, props.order.clientId, {
      firstName,
      lastName,
      middleName: clientProfile.value.individual.middleName,
      birthDate: clientProfile.value.individual.birthDate,
      gender: clientProfile.value.individual.gender,
    });

    const normalizedPhone = phone.replace(/\D/g, '');
    if (clientPhoneIdentity.value && clientPhoneIdentity.value.value.replace(/\D/g, '') !== normalizedPhone) {
      const { updateIdentity } = await import('@/api/contacts/identities');
      await updateIdentity(contactsToken, nsSlug.value, clientPhoneIdentity.value.id, phone);
    }
  } catch (e) {
    logError('[OrderDetailModal] syncClientFromOrderEdit failed', e);
  }
}

async function linkExistingClient() {
  if (!props.order || !clientCandidate.value) return;
  linkingClient.value = true;
  try {
    const menuToken = await getToken();
    const { menuLinkOrderClient } = await import('@/api/menu/order/update');
    const updated = await menuLinkOrderClient(menuToken, nsSlug.value, props.order.id, clientCandidate.value.client.id);
    emit('statusChanged', updated);
    clientProfile.value = clientCandidate.value;
    clientCandidate.value = null;
    useToast().add({ title: t('menu.clientLinked') || 'Client linked', color: 'primary' });
  } catch (e) {
    logError('[OrderDetailModal] linkExistingClient failed', e);
    useToast().add({ title: getErrorMessage(e) || 'Failed to link client', color: 'red' });
  } finally {
    linkingClient.value = false;
  }
}

// Splits "Иван Петров" into first/last for the client record — the closest
// this can get without a dedicated name field on the order itself. A blank
// or single-word name still produces a valid (if minimal) client.
function splitCustomerName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: t('menu.guestCustomer') || 'Guest', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

async function createClientFromOrder() {
  if (!props.order) return;
  creatingClient.value = true;
  try {
    const contactsToken = await getContactsAuth();
    if (!contactsToken) throw new Error('No contacts token');
    const { contactsCreateIndividualClient } = await import('@/api/contacts/mutations');
    const { createIdentity } = await import('@/api/contacts/identities');
    const { firstName, lastName } = splitCustomerName(props.order.customerName || '');
    const created = await contactsCreateIndividualClient(contactsToken, nsSlug.value, {
      individual: { firstName, lastName },
      status: 'ACTIVE',
    });
    await createIdentity(contactsToken, nsSlug.value, created.client.id, 'phone', props.order.phone, true);

    const menuToken = await getToken();
    const { menuLinkOrderClient } = await import('@/api/menu/order/update');
    const updated = await menuLinkOrderClient(menuToken, nsSlug.value, props.order.id, created.client.id);
    emit('statusChanged', updated);
    clientProfile.value = created;
    clientCandidate.value = null;
    useToast().add({ title: t('menu.clientCreated') || 'Client created', color: 'primary' });
  } catch (e) {
    logError('[OrderDetailModal] createClientFromOrder failed', e);
    useToast().add({ title: getErrorMessage(e) || 'Failed to create client', color: 'red' });
  } finally {
    creatingClient.value = false;
  }
}

watch(() => [props.modelValue, props.order?.id], ([open]) => {
  if (open && props.order) {
    loadDetails();
    loadHubMembers();
    loadStaffRoles();
    fetchUser();
    loadCatalog();
    loadCustomerOrders();
    loadClientIntegration();
    // Encode the order's smart date-prefixed number (not its UUID) into the
    // URL so it can be copied/shared and re-opened on a fresh page load —
    // still short, but readable instead of a bare "4". See the matching
    // ?order= lookup-by-number handling in
    // pages/[namespace]/menu/index.vue's openFromQuery().
    const smartNumber = smartOrderNumber(props.order);
    if (route.query.order !== smartNumber) {
      router.replace({ query: { ...route.query, order: smartNumber } });
    }
  }
  if (!open) {
    items.value = [];
    history.value = [];
    members.value = [];
    isAddProductOpen.value = false;
    isQuickAddOpen.value = false;
    isMobileTimelineOpen.value = false;
    isEditingOrder.value = false;
    if (route.query.order) {
      const q = { ...route.query };
      delete q.order;
      router.replace({ query: q });
    }
  }
});

async function changeStatus(status: string) {
  if (!props.order || props.order.status === status) return;
  updatingStatus.value = true;
  try {
    const menuToken = await getToken();
    const { menuUpdateOrderStatus } = await import('@/api/menu/order/updateStatus');
    const updated = await menuUpdateOrderStatus(menuToken, nsSlug.value, props.order.id, status);
    emit('statusChanged', updated);
    await loadDetails();
  } catch (e) {
    logError('[OrderDetailModal] changeStatus failed', e);
    useToast().add({ title: getErrorMessage(e) || 'Failed to update status', color: 'red' });
  } finally {
    updatingStatus.value = false;
  }
}

// --- Participants ---
const newMemberUserId = ref('');
const addingMember = ref(false);

// Only staff (someone with an actual role in Settings → Staff) can be
// assigned — no separate role picker either, since their order role is just
// their staff role (matches what they can actually do). The current user is
// pinned first since self-assigning is the most common case.
const memberOptions = computed(() => {
  const taken = new Set(members.value.map((m) => m.userId));
  const eligible = hubMembers.value.filter((m) => !taken.has(m.userId) && staffRoleByUserId.value[m.userId]);
  const sorted = [...eligible].sort((a, b) => {
    if (a.userId === currentUser.value?.id) return -1;
    if (b.userId === currentUser.value?.id) return 1;
    return 0;
  });
  return sorted.map((m) => ({
    label: `${m.username || m.email || (t('menu.unknownMember') || 'Unknown member')} — ${roleLabel(staffRoleByUserId.value[m.userId])}`,
    value: m.userId,
  }));
});

async function addMember() {
  if (!props.order || !newMemberUserId.value) return;
  const role = staffRoleByUserId.value[newMemberUserId.value];
  if (!role) return;
  addingMember.value = true;
  try {
    const menuToken = await getToken();
    const { menuAddOrderMember } = await import('@/api/menu/order/members');
    const created = await menuAddOrderMember(menuToken, nsSlug.value, props.order.id, newMemberUserId.value, role);
    members.value = [...members.value, created];
    newMemberUserId.value = '';
    useToast().add({ title: t('menu.memberAdded') || 'Member added', color: 'primary' });
  } catch (e) {
    logError('[OrderDetailModal] addMember failed', e);
    useToast().add({ title: getErrorMessage(e) || 'Failed to add member', color: 'red' });
  } finally {
    addingMember.value = false;
  }
}

async function removeMember(m: MenuOrderMember) {
  try {
    const menuToken = await getToken();
    const { menuRemoveOrderMember } = await import('@/api/menu/order/members');
    await menuRemoveOrderMember(menuToken, nsSlug.value, m.id);
    members.value = members.value.filter((x) => x.id !== m.id);
    useToast().add({ title: t('menu.memberRemoved') || 'Member removed', color: 'primary' });
  } catch (e) {
    logError('[OrderDetailModal] removeMember failed', e);
    useToast().add({ title: getErrorMessage(e) || 'Failed to remove member', color: 'red' });
  }
}

// --- Products: add existing / quick-create / detail view ---
const isAddProductOpen = ref(false);
const productSearch = ref('');
const addingProductId = ref<string | null>(null);

const filteredCatalogItems = computed(() => {
  const q = productSearch.value.trim().toLowerCase();
  if (!q) return catalogItems.value;
  return catalogItems.value.filter((i) => i.name.toLowerCase().includes(q));
});

function toggleAddProduct() {
  isAddProductOpen.value = !isAddProductOpen.value;
  if (isAddProductOpen.value && !catalogLoaded.value) loadCatalog();
}

async function addExistingProduct(item: MenuItem, quantity = 1) {
  if (!props.order) return;
  addingProductId.value = item.id;
  try {
    const menuToken = await getToken();
    const { menuAddOrderItem } = await import('@/api/menu/order/addItem');
    const updated = await menuAddOrderItem(menuToken, nsSlug.value, {
      orderId: props.order.id,
      menuItemId: item.id,
      name: item.name,
      priceAtPurchase: item.price,
      quantity,
    });
    emit('statusChanged', updated);
    await loadDetails();
    useToast().add({ title: t('menu.productAdded') || 'Product added', color: 'primary' });
  } catch (e) {
    logError('[OrderDetailModal] addExistingProduct failed', e);
    useToast().add({ title: getErrorMessage(e) || 'Failed to add product', color: 'red' });
  } finally {
    addingProductId.value = null;
  }
}

const updatingItemId = ref<string | null>(null);

async function changeItemQuantity(item: MenuOrderItem, delta: number) {
  if (!props.order) return;
  const nextQty = item.quantity + delta;
  if (nextQty < 1) return;
  updatingItemId.value = item.id;
  try {
    const menuToken = await getToken();
    const { menuUpdateOrderItemQuantity } = await import('@/api/menu/order/updateItemQuantity');
    const updated = await menuUpdateOrderItemQuantity(menuToken, nsSlug.value, item.id, nextQty);
    emit('statusChanged', updated);
    await loadDetails();
  } catch (e) {
    logError('[OrderDetailModal] changeItemQuantity failed', e);
    useToast().add({ title: getErrorMessage(e) || 'Failed to update quantity', color: 'red' });
  } finally {
    updatingItemId.value = null;
  }
}

async function removeItem(item: MenuOrderItem) {
  if (!props.order) return;
  if (!(await confirm({ message: t('menu.confirmRemoveOrderItem') || 'Remove this item from the order?' }))) return;
  updatingItemId.value = item.id;
  try {
    const menuToken = await getToken();
    const { menuRemoveOrderItem } = await import('@/api/menu/order/removeItem');
    const updated = await menuRemoveOrderItem(menuToken, nsSlug.value, item.id);
    emit('statusChanged', updated);
    await loadDetails();
    useToast().add({ title: t('menu.orderItemRemoved') || 'Item removed', color: 'primary' });
  } catch (e) {
    logError('[OrderDetailModal] removeItem failed', e);
    useToast().add({ title: getErrorMessage(e) || 'Failed to remove item', color: 'red' });
  } finally {
    updatingItemId.value = null;
  }
}

const isQuickAddOpen = ref(false);
const quickAddSaving = ref(false);
const quickAddForm = reactive({ name: '', price: '', categoryId: '' });

function toggleQuickAdd() {
  isQuickAddOpen.value = !isQuickAddOpen.value;
  if (isQuickAddOpen.value) {
    quickAddForm.name = productSearch.value.trim();
    quickAddForm.price = '';
    quickAddForm.categoryId = catalogCategories.value[0]?.id || '';
  }
}

const isQuickAddValid = computed(() =>
  quickAddForm.name.trim().length > 0 && Number(quickAddForm.price) > 0 && !!quickAddForm.categoryId
);

async function submitQuickAddProduct() {
  if (!isQuickAddValid.value || quickAddSaving.value) return;
  quickAddSaving.value = true;
  try {
    const menuToken = await getToken();
    const { menuCreateMenuItem } = await import('@/api/menu/menuitem/create');
    const created = await menuCreateMenuItem(menuToken, nsSlug.value, {
      categoryId: quickAddForm.categoryId,
      name: quickAddForm.name.trim(),
      price: Number(quickAddForm.price),
    });
    const newItem = { ...created, badgeIds: [], excludedBranchIds: [] } as MenuItem;
    catalogItems.value = [newItem, ...catalogItems.value];
    isQuickAddOpen.value = false;
    productSearch.value = '';
    await addExistingProduct(newItem);
  } catch (e) {
    logError('[OrderDetailModal] submitQuickAddProduct failed', e);
    useToast().add({ title: getErrorMessage(e) || 'Failed to create product', color: 'red' });
  } finally {
    quickAddSaving.value = false;
  }
}

// --- Product detail dialog (live catalog data, not the purchase-time snapshot) ---
const isProductDetailOpen = ref(false);
const productDetailLoading = ref(false);
const selectedProductDetail = ref<MenuItem | null>(null);
const detailQuantity = ref(1);

async function openProductDetail(orderItem: MenuOrderItem) {
  isProductDetailOpen.value = true;
  productDetailLoading.value = true;
  selectedProductDetail.value = null;
  detailQuantity.value = 1;
  try {
    const menuToken = await getToken();
    const { menuGetMenuItem } = await import('@/api/menu/menuitem/get');
    selectedProductDetail.value = await menuGetMenuItem(menuToken, nsSlug.value, orderItem.menuItemId);
  } catch (e) {
    logError('[OrderDetailModal] openProductDetail failed', e);
    useToast().add({ title: getErrorMessage(e) || 'Failed to load product', color: 'red' });
  } finally {
    productDetailLoading.value = false;
  }
}

async function addFromDetail() {
  if (!selectedProductDetail.value) return;
  await addExistingProduct(selectedProductDetail.value, detailQuantity.value);
  isProductDetailOpen.value = false;
}

// --- Contact card: call / WhatsApp / 2GIS ---
const phoneDisplay = computed(() => formatDisplayPhoneUniversal(props.order?.phone || ''));
const callHref = computed(() => telHref(props.order?.phone));
const waHref = computed(() => whatsappHref(props.order?.phone));
const mapHref = computed(() => {
  if (!props.order) return '';
  if (props.order.type === 'pickup' && props.order.branchId) {
    const b = branchById.value[props.order.branchId];
    return b?.address ? twoGisSearchHref(b.address) : '';
  }
  return props.order.deliveryAddress ? twoGisSearchHref(props.order.deliveryAddress) : '';
});

// --- Editing order/client fields (echoes to UpdateOrder, which also logs a
// same-status OrderHistory row so the change shows up in the timeline) ---
const isEditingOrder = ref(false);
const savingEdit = ref(false);
const editForm = reactive({ customerName: '', phone: '', deliveryAddress: '', comment: '' });

function startEditOrder() {
  if (!props.order) return;
  editForm.customerName = props.order.customerName || '';
  editForm.phone = props.order.phone || '';
  editForm.deliveryAddress = props.order.deliveryAddress || '';
  editForm.comment = props.order.comment || '';
  isEditingOrder.value = true;
}
function cancelEditOrder() {
  isEditingOrder.value = false;
}
const isEditFormValid = computed(() => editForm.phone.replace(/\D/g, '').length >= 10);

async function saveEditOrder() {
  if (!props.order || !isEditFormValid.value) return;
  savingEdit.value = true;
  try {
    const menuToken = await getToken();
    const { menuUpdateOrder } = await import('@/api/menu/order/update');
    const updated = await menuUpdateOrder(menuToken, nsSlug.value, {
      orderId: props.order.id,
      phone: editForm.phone.trim(),
      customerName: editForm.customerName.trim() || undefined,
      deliveryAddress: editForm.deliveryAddress.trim() || undefined,
      comment: editForm.comment.trim() || undefined,
    });
    await syncClientFromOrderEdit(editForm.customerName.trim(), editForm.phone.trim());
    emit('statusChanged', updated);
    isEditingOrder.value = false;
    await loadDetails();
    useToast().add({ title: t('menu.orderUpdated') || 'Order updated', color: 'primary' });
  } catch (e) {
    logError('[OrderDetailModal] saveEditOrder failed', e);
    useToast().add({ title: getErrorMessage(e) || 'Failed to update order', color: 'red' });
  } finally {
    savingEdit.value = false;
  }
}

// --- Share link ---
const shareUrl = computed(() => {
  if (!process.client || !props.order) return '';
  return `${window.location.origin}/${nsSlug.value}/menu?order=${smartOrderNumber(props.order)}`;
});
async function copyShareLink() {
  if (!shareUrl.value) return;
  try {
    await navigator.clipboard.writeText(shareUrl.value);
    useToast().add({ title: t('menu.linkCopied') || 'Link copied', color: 'primary' });
  } catch (e) {
    logError('[OrderDetailModal] copyShareLink failed', e);
  }
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function itemUnitPrice(i: MenuOrderItem): number {
  return i.priceAtPurchase + (i.modifiers || []).reduce((sum, m) => sum + m.priceAtPurchase, 0);
}

const itemsTotal = computed(() => items.value.reduce((sum, i) => sum + itemUnitPrice(i) * i.quantity, 0));
</script>

<template>
  <USlideover v-model="isOpen" :ui="{ width: 'w-screen max-w-full sm:max-w-3xl lg:max-w-5xl' }">
    <UCard v-if="order" class="flex flex-col h-full" :ui="{ ring: '', divide: 'divide-y divide-gray-100 dark:divide-gray-800', body: { base: 'flex-1 overflow-hidden p-0' }, rounded: 'rounded-none' }">
      <template #header>
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-3 min-w-0">
            <div>
              <div class="font-mono font-bold text-lg leading-tight">{{ smartOrderNumber(order) }}</div>
              <div class="text-xs text-gray-400">{{ formatDate(order.createdAt) }}</div>
            </div>
            <UDropdown :items="[nextStatuses(order!.status, order!.type).map((s) => ({ label: statusLabel(s), status: s, click: () => changeStatus(s) }))]">
              <button type="button" class="inline-flex items-center gap-1.5 rounded-full disabled:opacity-50" :disabled="updatingStatus || !nextStatuses(order.status, order.type).length">
                <span
                  class="inline-flex items-center gap-1.5 rounded-full pl-1.5 pr-2.5 py-1 text-white text-xs font-semibold ring-4"
                  :style="{ backgroundColor: statusBadgeStyle(order.status).bg, '--tw-ring-color': statusBadgeStyle(order.status).ring }"
                >
                  <Icon :name="statusBadgeStyle(order.status).icon" class="w-3.5 h-3.5" />
                  {{ statusLabel(order.status) }}
                </span>
                <Icon v-if="nextStatuses(order.status, order.type).length" :name="updatingStatus ? 'lucide:loader-2' : 'lucide:chevron-down'" class="w-3.5 h-3.5 text-gray-400" :class="{ 'animate-spin': updatingStatus }" />
              </button>
              <template #item="{ item }">
                <span class="flex items-center gap-2 w-full">
                  <span class="h-2 w-2 rounded-full flex-shrink-0" :style="{ backgroundColor: statusBadgeStyle(item.status).bg }" />
                  <span class="truncate">{{ item.label }}</span>
                </span>
              </template>
            </UDropdown>
          </div>
          <div class="flex items-center gap-1 flex-shrink-0">
            <UTooltip :text="t('menu.statusHistory') || 'Status history'" class="lg:hidden">
              <UButton icon="lucide:history" size="sm" color="gray" variant="ghost" class="lg:hidden" @click="isMobileTimelineOpen = true" />
            </UTooltip>
            <UTooltip :text="t('menu.copyLink') || 'Copy share link'">
              <UButton icon="lucide:link" size="sm" color="gray" variant="ghost" @click="copyShareLink" />
            </UTooltip>
            <UButton icon="lucide:x" size="sm" color="gray" variant="ghost" @click="isOpen = false" />
          </div>
        </div>
      </template>

      <div v-if="loading" class="flex items-center justify-center py-12">
        <UIcon name="lucide:loader-2" class="w-6 h-6 animate-spin text-gray-400" />
      </div>

      <div v-else class="h-full lg:flex lg:flex-row-reverse">
        <!-- Status history: independently-scrolling side rail, desktop only.
             On mobile it's reached via the header's history button, opening
             as its own overlay instead — see isMobileTimelineOpen below. -->
        <aside class="hidden lg:block lg:w-72 lg:flex-shrink-0 lg:h-full lg:overflow-y-auto border-l border-gray-100 dark:border-gray-800 p-5 bg-gray-50/60 dark:bg-gray-900/40">
          <div class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">{{ t('menu.statusHistory') || 'Status history' }}</div>
          <OrderHistoryTimeline :history="history" :status-label="statusLabel" :member-display-name="memberDisplayName" :format-date="formatDate" />
        </aside>

        <!-- Main content: scrolls independently of the side rail -->
        <div class="flex-1 min-w-0 h-full overflow-y-auto p-4 lg:p-5 space-y-5 pb-8">
          <!-- Contact card -->
          <div class="rounded-xl ring-1 ring-gray-200 dark:ring-gray-800 p-4 space-y-3">
            <div class="flex items-center justify-between">
              <div class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{{ t('menu.contactInfo') || 'Contact info' }}</div>
              <div class="flex items-center gap-3">
                <button v-if="!isEditingOrder" type="button" class="text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 inline-flex items-center gap-1" @click="startEditOrder">
                  <Icon name="lucide:pencil" class="w-3 h-3" />
                  {{ t('common.edit') || 'Edit' }}
                </button>
              </div>
            </div>

            <template v-if="!isEditingOrder">
              <div class="flex items-center gap-3">
                <span class="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-sm font-semibold text-gray-600 dark:text-gray-300 flex-shrink-0">
                  {{ (order.customerName || order.phone || '?').slice(0, 1).toUpperCase() }}
                </span>
                <div class="min-w-0">
                  <NuxtLink
                    v-if="order.clientId"
                    :to="`/${nsSlug}/contacts/${order.clientId}`"
                    class="group text-sm font-semibold text-gray-900 dark:text-white hover:text-primary-600 dark:hover:text-primary-400 transition-colors inline-flex items-center gap-1 truncate"
                  >
                    <span class="truncate">{{ order.customerName || (t('menu.guestCustomer') || 'Guest') }}</span>
                    <Icon name="lucide:arrow-up-right" class="w-3 h-3 flex-shrink-0 text-gray-400 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors" />
                  </NuxtLink>
                  <div v-else class="text-sm font-semibold text-gray-900 dark:text-white truncate">{{ order.customerName || (t('menu.guestCustomer') || 'Guest') }}</div>
                  <div class="text-sm text-gray-500 dark:text-gray-400 tabular-nums">{{ phoneDisplay }}</div>
                </div>
              </div>
              <div class="flex gap-2 pt-1">
                <UButton :to="callHref" icon="lucide:phone" size="sm" color="primary" variant="soft" class="flex-1 justify-center">
                  {{ t('menu.call') || 'Call' }}
                </UButton>
                <UButton :to="waHref" target="_blank" icon="lucide:message-circle" size="sm" color="emerald" variant="soft" class="flex-1 justify-center">
                  WhatsApp
                </UButton>
              </div>
            </template>
            <div v-else class="space-y-2.5">
              <UFormGroup :label="t('menu.name') || 'Name'">
                <UInput v-model="editForm.customerName" size="sm" />
              </UFormGroup>
              <UFormGroup :label="t('menu.phone') || 'Phone'" required :error="!isEditFormValid">
                <UInput
                  :model-value="editForm.phone"
                  type="tel"
                  inputmode="tel"
                  pattern="[0-9+()\s-]*"
                  size="sm"
                  @update:model-value="(v: string) => (editForm.phone = v.replace(/[^\d+()\s-]/g, ''))"
                />
              </UFormGroup>
            </div>
          </div>

          <!-- lota Contacts integration: link an existing match found by
               phone, or create one from this order. Once a client is
               already linked, the name in Contact Details above is the
               link to their profile — no need to duplicate it here. -->
          <div v-if="!isEditingOrder && contactsInstalled && !clientProfile" class="rounded-xl ring-1 ring-gray-200 dark:ring-gray-800 p-4 space-y-2.5">
            <div class="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              <Icon name="lucide:contact" class="w-3.5 h-3.5" />
              {{ t('menu.contactsClient') || 'Client' }}
            </div>

            <div v-if="clientLoading" class="flex items-center gap-2 text-sm text-gray-400">
              <Icon name="lucide:loader-2" class="w-3.5 h-3.5 animate-spin" />
              {{ t('app.loading') || 'Loading...' }}
            </div>

            <div v-else-if="clientCandidate" class="flex items-center justify-between gap-2">
              <span class="text-sm text-gray-600 dark:text-gray-300 truncate">
                {{ t('menu.clientMatchFound') || 'Match found' }}: {{ clientDisplayName(clientCandidate) }}
              </span>
              <UButton size="xs" color="primary" variant="soft" :loading="linkingClient" @click="linkExistingClient">
                {{ t('menu.linkClient') || 'Link' }}
              </UButton>
            </div>

            <UButton
              v-else
              size="xs"
              color="gray"
              variant="soft"
              icon="lucide:user-plus"
              :loading="creatingClient"
              @click="createClientFromOrder"
            >
              {{ t('menu.createClientFromOrder') || 'Create client from this order' }}
            </UButton>
          </div>

          <!-- Delivery / pickup card -->
          <div class="rounded-xl ring-1 ring-gray-200 dark:ring-gray-800 p-4 space-y-2.5">
            <div class="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              <Icon :name="order.type === 'pickup' ? 'lucide:store' : 'lucide:truck'" class="w-3.5 h-3.5" />
              {{ order.type === 'pickup' ? (t('menu.pickup') || 'Pickup') : (t('menu.delivery') || 'Delivery') }}
            </div>

            <template v-if="!isEditingOrder">
              <div class="flex items-start justify-between gap-2">
                <div v-if="order.type === 'pickup' && order.branchId" class="flex items-start gap-2 text-sm min-w-0">
                  <Icon name="lucide:map-pin" class="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <span class="min-w-0">{{ branchById[order.branchId]?.name || '—' }} — {{ branchById[order.branchId]?.address || '' }}</span>
                </div>
                <div v-else class="flex items-start gap-2 text-sm min-w-0">
                  <Icon name="lucide:map-pin" class="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <span class="min-w-0">{{ order.deliveryAddress || '—' }}</span>
                </div>
                <a v-if="mapHref" :href="mapHref" target="_blank" rel="noopener" class="flex-shrink-0 inline-flex items-center gap-1 text-xs font-medium text-primary-600 dark:text-primary-300 hover:underline whitespace-nowrap">
                  2GIS
                  <Icon name="lucide:external-link" class="w-3 h-3" />
                </a>
              </div>
              <div v-if="order.deliveryAt" class="flex items-center gap-2 text-sm">
                <Icon name="lucide:clock" class="w-4 h-4 text-gray-400" />
                {{ t('menu.scheduledFor') || 'Scheduled for' }} {{ formatDate(order.deliveryAt) }}
              </div>
              <div v-if="order.comment" class="flex items-start gap-2 text-sm">
                <Icon name="lucide:message-square" class="w-4 h-4 text-gray-400 mt-0.5" />
                <span class="text-gray-600 dark:text-gray-300">{{ order.comment }}</span>
              </div>
              <div v-if="order.sourceTag" class="flex items-center gap-2 text-xs text-gray-400">
                <Icon name="lucide:tag" class="w-3.5 h-3.5" />
                {{ sourceTagLabel(order.sourceTag) }}
              </div>
            </template>
            <div v-else class="space-y-2.5">
              <UFormGroup v-if="order.type === 'delivery'" :label="t('menu.address') || 'Delivery address'">
                <UInput v-model="editForm.deliveryAddress" size="sm" />
              </UFormGroup>
              <p v-else class="text-xs text-gray-400">{{ branchById[order.branchId || '']?.name }} — {{ t('menu.pickupBranchNotEditable') || 'pickup branch can\'t be changed here' }}</p>
              <UFormGroup :label="t('menu.comment') || 'Comment'">
                <UTextarea v-model="editForm.comment" :rows="2" />
              </UFormGroup>
              <div class="flex justify-end gap-2 pt-1">
                <UButton size="sm" color="gray" variant="ghost" :disabled="savingEdit" @click="cancelEditOrder">
                  {{ t('app.cancel') || 'Cancel' }}
                </UButton>
                <UButton size="sm" color="primary" :loading="savingEdit" :disabled="!isEditFormValid || savingEdit" @click="saveEditOrder">
                  {{ t('app.save') || 'Save' }}
                </UButton>
              </div>
            </div>
          </div>

          <!-- Products -->
          <div>
            <div class="flex items-center justify-between mb-2">
              <div class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{{ t('menu.menuItems') || 'Products' }}</div>
              <button type="button" class="flex items-center gap-1 text-xs font-medium text-primary-600 dark:text-primary-300 hover:text-primary-700 dark:hover:text-primary-200" @click="toggleAddProduct">
                <Icon :name="isAddProductOpen ? 'lucide:x' : 'lucide:plus'" class="w-3.5 h-3.5" />
                {{ isAddProductOpen ? (t('app.cancel') || 'Cancel') : (t('menu.addProduct') || 'Add product') }}
              </button>
            </div>

            <!-- Add-product panel -->
            <div v-if="isAddProductOpen" class="mb-3 rounded-xl border border-primary-200 dark:border-primary-800 bg-primary-50/50 dark:bg-primary-950/20 p-3 space-y-2.5">
              <div class="flex items-center justify-between gap-2">
                <UInput v-model="productSearch" size="sm" icon="lucide:search" :placeholder="t('menu.searchProducts') || 'Search products'" class="flex-1" :ui="{ rounded: 'rounded-lg' }" />
                <button type="button" class="flex-shrink-0 flex items-center gap-1 text-xs font-medium text-primary-600 dark:text-primary-300" @click="toggleQuickAdd">
                  <Icon name="lucide:sparkles" class="w-3.5 h-3.5" />
                  {{ t('menu.quickNewProduct') || 'New' }}
                </button>
              </div>

              <div v-if="isQuickAddOpen" class="rounded-lg border border-primary-200 dark:border-primary-800 bg-white dark:bg-gray-900 p-2.5 space-y-2">
                <div class="grid grid-cols-2 gap-2">
                  <UInput v-model="quickAddForm.name" size="sm" :placeholder="t('menu.name') || 'Name'" :ui="{ rounded: 'rounded-lg' }" />
                  <UInput v-model="quickAddForm.price" type="number" size="sm" :placeholder="t('menu.price') || 'Price'" :ui="{ rounded: 'rounded-lg' }" />
                </div>
                <USelectMenu v-model="quickAddForm.categoryId" size="sm" :options="catalogCategories.map((c) => ({ label: c.name, value: c.id }))" value-attribute="value" option-attribute="label" :placeholder="t('menu.selectCategory') || 'Select category'" :ui="{ rounded: 'rounded-lg' }" :popper="{ strategy: 'fixed' }" />
                <UButton block size="sm" color="primary" :label="t('menu.addAndUse') || 'Add & use in order'" :loading="quickAddSaving" :disabled="!isQuickAddValid || quickAddSaving" class="rounded-lg justify-center" @click="submitQuickAddProduct" />
              </div>

              <div v-else class="max-h-40 overflow-y-auto rounded-lg border border-gray-100 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-900">
                <div v-if="!catalogLoaded" class="px-3 py-4 text-center text-sm text-gray-400">{{ t('app.loading') || 'Loading...' }}</div>
                <div v-else-if="!filteredCatalogItems.length" class="px-3 py-4 text-center text-sm text-gray-400">{{ t('menu.noMenuItems') || 'No products' }}</div>
                <button
                  v-for="ci in filteredCatalogItems"
                  :key="ci.id"
                  type="button"
                  class="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors disabled:opacity-50"
                  :disabled="addingProductId === ci.id"
                  @click="addExistingProduct(ci)"
                >
                  <span class="text-sm truncate">{{ ci.name }}</span>
                  <span class="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 tabular-nums flex-shrink-0">
                    {{ ci.price }}
                    <Icon :name="addingProductId === ci.id ? 'lucide:loader-2' : 'lucide:plus-circle'" class="h-4 w-4 text-primary-500" :class="{ 'animate-spin': addingProductId === ci.id }" />
                  </span>
                </button>
              </div>
            </div>

            <div class="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
              <div v-if="!items.length" class="text-sm text-gray-400 text-center py-6">{{ t('menu.noMenuItems') || 'No products' }}</div>
              <table v-else class="w-full text-sm">
                <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
                  <tr v-for="i in items" :key="i.id" class="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                    <td class="px-4 py-2.5">
                      <button type="button" class="text-left hover:text-primary-600 dark:hover:text-primary-300 hover:underline" @click="openProductDetail(i)">
                        {{ i.name }}
                      </button>
                      <div v-if="i.modifiers?.length" class="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5">
                        <span
                          v-for="m in i.modifiers"
                          :key="m.id"
                          class="text-xs text-gray-400 dark:text-gray-500"
                        >
                          + {{ m.name }}<template v-if="m.priceAtPurchase"> ({{ m.priceAtPurchase > 0 ? '+' : '' }}{{ m.priceAtPurchase }})</template>
                        </span>
                      </div>
                    </td>
                    <td class="px-4 py-2.5">
                      <div class="flex items-center justify-center gap-1">
                        <UButton
                          icon="lucide:minus"
                          size="2xs"
                          color="gray"
                          variant="soft"
                          :disabled="updatingItemId === i.id || i.quantity <= 1"
                          @click="changeItemQuantity(i, -1)"
                        />
                        <span class="w-5 text-center tabular-nums">{{ i.quantity }}</span>
                        <UButton
                          icon="lucide:plus"
                          size="2xs"
                          color="gray"
                          variant="soft"
                          :disabled="updatingItemId === i.id"
                          @click="changeItemQuantity(i, 1)"
                        />
                      </div>
                    </td>
                    <td class="px-4 py-2.5 text-right w-28 tabular-nums">{{ itemUnitPrice(i) }} × {{ i.quantity }}</td>
                    <td class="px-4 py-2.5 text-right w-24 font-medium tabular-nums">{{ itemUnitPrice(i) * i.quantity }}</td>
                    <td class="px-2 py-2.5 w-9">
                      <UButton
                        icon="lucide:trash-2"
                        size="2xs"
                        color="red"
                        variant="ghost"
                        :loading="updatingItemId === i.id"
                        @click="removeItem(i)"
                      />
                    </td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr class="border-t border-gray-200 dark:border-gray-800 font-semibold">
                    <td class="px-4 py-2.5" colspan="3">{{ t('menu.total') || 'Total' }}</td>
                    <td class="px-4 py-2.5 text-right tabular-nums">{{ order.totalAmount ?? itemsTotal }}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <!-- Participants -->
          <div>
            <div class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">{{ t('menu.participants') || 'Participants' }}</div>
            <div class="rounded-xl ring-1 ring-gray-200 dark:ring-gray-800 p-4 space-y-3">
              <div v-if="!members.length" class="text-sm text-gray-400">{{ t('menu.noStaffAssigned') || 'No staff assigned yet' }}</div>
              <div v-else class="flex flex-wrap gap-2">
                <div v-for="m in members" :key="m.id" class="group inline-flex items-center gap-1.5 pl-1 pr-1.5 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-xs">
                  <span class="flex h-5 w-5 items-center justify-center rounded-full bg-white dark:bg-gray-900 text-[9px] font-semibold uppercase text-gray-600 dark:text-gray-300">
                    {{ memberDisplayName(m.userId).slice(0, 2) }}
                  </span>
                  <span class="font-medium">{{ memberDisplayName(m.userId) }}</span>
                  <span class="text-gray-400">·</span>
                  <span>{{ roleLabel(m.role) }}</span>
                  <button type="button" class="w-4 h-4 rounded-full flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700" @click="removeMember(m)">
                    <Icon name="lucide:x" class="w-2.5 h-2.5" />
                  </button>
                </div>
              </div>
              <div class="flex gap-2 pt-1">
                <USelectMenu
                  v-model="newMemberUserId"
                  :options="memberOptions"
                  value-attribute="value"
                  option-attribute="label"
                  searchable
                  :placeholder="t('menu.selectMember') || 'Select a member'"
                  size="sm"
                  class="flex-1"
                  :popper="{ strategy: 'fixed' }"
                />
                <UButton size="sm" icon="lucide:plus" :loading="addingMember" :disabled="!newMemberUserId || addingMember" @click="addMember" />
              </div>
            </div>
          </div>

          <!-- Customer order history: other orders from this same phone —
               click a number to switch this modal to that order. -->
          <div v-if="!isEditingOrder && customerOrders.length">
            <div class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1.5">
              <Icon name="lucide:history" class="w-3.5 h-3.5" />
              {{ t('menu.customerHistory') || "Customer's other orders" }}
            </div>
            <div class="rounded-xl ring-1 ring-gray-200 dark:ring-gray-800 p-4 space-y-1.5">
              <div v-for="co in customerOrders" :key="co.id" class="flex items-center justify-between gap-2 text-sm">
                <div class="flex items-center gap-2 min-w-0">
                  <button
                    type="button"
                    class="font-mono tabular-nums text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 hover:underline transition-colors"
                    @click="emit('openOrder', co.id)"
                  >
                    {{ smartOrderNumber(co) }}
                  </button>
                  <span
                    class="inline-flex items-center gap-1 rounded-full pl-1.5 pr-2 py-0.5 text-white text-[10px] font-semibold flex-shrink-0"
                    :style="{ backgroundColor: statusBadgeStyle(co.status).bg }"
                  >
                    {{ statusLabel(co.status) }}
                  </span>
                </div>
                <div class="flex items-center gap-2 flex-shrink-0 text-gray-400">
                  <span class="tabular-nums">{{ formatDate(co.createdAt) }}</span>
                  <span class="font-semibold text-gray-700 dark:text-gray-300 tabular-nums">{{ co.totalAmount.toLocaleString() }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </UCard>
  </USlideover>

  <!-- Mobile-only: status history opens as its own overlay instead of
       stacking inline (which used to push the rest of the order below the
       fold on small screens). -->
  <USlideover v-model="isMobileTimelineOpen" side="right">
    <UCard v-if="order" class="flex flex-col h-full" :ui="{ ring: '', divide: 'divide-y divide-gray-100 dark:divide-gray-800', body: { base: 'flex-1 overflow-y-auto' }, rounded: 'rounded-none' }">
      <template #header>
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-semibold">{{ t('menu.statusHistory') || 'Status history' }}</h3>
          <UButton icon="lucide:x" size="sm" color="gray" variant="ghost" @click="isMobileTimelineOpen = false" />
        </div>
      </template>
      <OrderHistoryTimeline :history="history" :status-label="statusLabel" :member-display-name="memberDisplayName" :format-date="formatDate" />
    </UCard>
  </USlideover>

  <!-- Product detail dialog: live catalog data (image/description/badges),
       not just the order's purchase-time name+price snapshot. -->
  <UModal v-model="isProductDetailOpen">
    <UCard :ui="{ ring: '', divide: 'divide-y divide-gray-100 dark:divide-gray-800' }">
      <template #header>
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-semibold">{{ selectedProductDetail?.name || (t('menu.product') || 'Product') }}</h3>
          <UButton icon="lucide:x" size="sm" color="gray" variant="ghost" @click="isProductDetailOpen = false" />
        </div>
      </template>

      <div v-if="productDetailLoading" class="flex items-center justify-center py-12">
        <UIcon name="lucide:loader-2" class="w-6 h-6 animate-spin text-gray-400" />
      </div>
      <div v-else-if="selectedProductDetail" class="space-y-4">
        <div class="w-full aspect-video rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
          <img v-if="selectedProductDetail.imageUrl" :src="selectedProductDetail.imageUrl" :alt="selectedProductDetail.imageAlt || selectedProductDetail.name" class="w-full h-full object-cover">
          <Icon v-else name="lucide:package" class="w-8 h-8 text-gray-300 dark:text-gray-700" />
        </div>
        <div v-if="selectedProductDetail.badgeIds.length" class="flex flex-wrap gap-1.5">
          <span
            v-for="bid in selectedProductDetail.badgeIds"
            :key="bid"
            class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium"
            :style="badgeById(bid) ? { backgroundColor: badgeById(bid)!.bgColor, color: badgeById(bid)!.textColor } : {}"
          >
            <span v-if="badgeById(bid)?.icon">{{ badgeById(bid)?.icon }}</span>{{ badgeById(bid)?.text }}
          </span>
        </div>
        <p v-if="selectedProductDetail.description" class="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{{ selectedProductDetail.description }}</p>
        <div class="text-lg font-bold text-gray-900 dark:text-white">{{ selectedProductDetail.price }}</div>
      </div>

      <template v-if="selectedProductDetail" #footer>
        <div class="flex items-center gap-3">
          <div class="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-full p-1 flex-shrink-0">
            <UButton icon="lucide:minus" size="2xs" color="gray" variant="ghost" square :disabled="detailQuantity <= 1" @click="detailQuantity = Math.max(1, detailQuantity - 1)" />
            <span class="w-6 text-center text-sm font-bold tabular-nums">{{ detailQuantity }}</span>
            <UButton icon="lucide:plus" size="2xs" color="gray" variant="ghost" square @click="detailQuantity++" />
          </div>
          <UButton color="primary" block class="flex-1" :loading="addingProductId === selectedProductDetail.id" @click="addFromDetail">
            {{ t('menu.addToOrder') || 'Add to order' }}
          </UButton>
        </div>
      </template>
    </UCard>
  </UModal>
</template>
