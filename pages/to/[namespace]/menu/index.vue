<script lang="ts" setup>
import { useI18n } from '@/composables/useI18n';
import { logError } from '@/utils/logger';
import { getErrorMessage } from '@/utils/types/errors';
import { getPublicStorefront, getPublicMenuItems, getPublicModifierGroups, getPublicModifierOptions, submitPublicOrder, getMyOrders, getPublicOrderStatus, getPublicStopList } from '@/api/menu/public/storefront';
import type { PublicModifierGroup, PublicModifierOption, MyOrderSummary } from '@/api/menu/public/storefront';
import { getContrastTextColor } from '@/utils/color';
import { parseSocialLinks, socialIcon, socialLabel } from '@/utils/social';
import { telHref, whatsappHref } from '@/utils/phoneLinks';
import { formatDisplayPhoneUniversal } from '@/utils/phone';
import { twoGisSearchHref, osmEmbedSrc } from '@/utils/geo';
import { formatMoney } from '@/utils/currency';
import { smartOrderNumber, parseSmartOrderNumber } from '@/utils/orderNumber';
import { withRetry } from '@/utils/retry';
import { parseWorkingHours, isOpenNow, nextOpenLabel } from '@/utils/workingHours';
import ItemCard from '@/components/menu/storefront/ItemCard.vue';
import type { MenuItem } from '@/api/menu/menuitem/list';
import type { MenuPromoBanner } from '@/api/menu/promobanner/list';

definePageMeta({ layout: false });

const { t, locale, setLocale, available: availableLocales } = useI18n();
const LOCALE_LABELS: Record<string, string> = { ru: 'РУ', kk: 'ҚАЗ', en: 'EN' };
const route = useRoute();
const router = useRouter();
const nsSlug = computed(() => route.params.namespace as string);
const branchParam = computed(() => (route.query.b as string) || '');
const sourceTag = computed(() => (route.query.t as string) || '');

// Cart + branch selection survive a page reload/return visit, scoped per
// tenant so switching storefronts never leaks one tenant's cart into
// another's. The cart itself is additionally scoped per branch — different
// branches (cities) keep independent carts, since switching branch can
// change which products are even available (see excludedBranchIds below).
const cartStorageKey = computed(() => `lota-menu-cart-${nsSlug.value}-${selectedBranchId.value || 'default'}`);
const branchStorageKey = computed(() => `lota-menu-branch-${nsSlug.value}`);
const contactStorageKey = computed(() => `lota-menu-contact-${nsSlug.value}`);
const lastOrderStorageKey = computed(() => `lota-menu-last-order-${nsSlug.value}`);

// Server-rendered so the per-tenant title/description/OG tags in useHead()
// below are actually crawlable, not just visible after client hydration.
const { data, pending: loading, error: fetchError } = await useAsyncData(
  `storefront-${nsSlug.value}`,
  () => withRetry(async () => {
    const storefront = await getPublicStorefront(nsSlug.value);
    const [entries, modifierGroups] = await Promise.all([
      Promise.all(storefront.categories.map(async (c) => [c.id, await getPublicMenuItems(nsSlug.value, c.id)] as const)),
      getPublicModifierGroups(nsSlug.value),
    ]);
    return { storefront, itemsByCategory: Object.fromEntries(entries) as Record<string, MenuItem[]>, modifierGroups };
  })
);

const error = computed(() => fetchError.value ? (getErrorMessage(fetchError.value) || 'Failed to load storefront') : null);

// --- Item modifiers (size, add-ons, ...) ---
// modifierGroups is small and fetched once for the whole tenant up front;
// options are fetched lazily per group the first time an item that uses it
// is opened, then cached — most storefronts only ever touch a handful of
// groups regardless of catalog size.
const modifierOptionsByGroup = ref<Record<string, PublicModifierOption[]>>({});
const modifierOptionsLoading = ref<Set<string>>(new Set());

async function ensureModifierOptionsLoaded(groupIds: string[]) {
  const toLoad = groupIds.filter((id) => !modifierOptionsByGroup.value[id] && !modifierOptionsLoading.value.has(id));
  if (!toLoad.length) return;
  toLoad.forEach((id) => modifierOptionsLoading.value.add(id));
  try {
    const results = await Promise.all(toLoad.map((id) => getPublicModifierOptions(nsSlug.value, id)));
    toLoad.forEach((id, idx) => { modifierOptionsByGroup.value[id] = results[idx]; });
  } catch (e) {
    logError('[shared/menu] ensureModifierOptionsLoaded failed', e);
  } finally {
    toLoad.forEach((id) => modifierOptionsLoading.value.delete(id));
  }
}

function modifierGroupById(id: string): PublicModifierGroup | undefined {
  return data.value?.modifierGroups.find((g) => g.id === id);
}

// selectedItem's modifier groups, in isRequired-first order so the choices
// a customer must make before adding to cart appear above the optional ones.
const selectedItemModifierGroups = computed(() => {
  if (!selectedItem.value) return [];
  return selectedItem.value.modifierGroupIds
    .map((id) => modifierGroupById(id))
    .filter((g): g is PublicModifierGroup => !!g)
    .sort((a, b) => Number(b.isRequired) - Number(a.isRequired));
});

// groupId -> selected option ids. Reset every time the sheet opens for a
// (possibly different) item.
const selectedModifiers = reactive<Record<string, string[]>>({});

function toggleModifierOption(group: PublicModifierGroup, optionId: string) {
  const current = selectedModifiers[group.id] || [];
  if (group.type === 'multi') {
    if (current.includes(optionId)) {
      selectedModifiers[group.id] = current.filter((id) => id !== optionId);
    } else if (!group.maxSelect || current.length < group.maxSelect) {
      selectedModifiers[group.id] = [...current, optionId];
    }
  } else {
    // single-choice group: mutually exclusive — picking one clears any other,
    // and clicking the already-selected option clears it (unless required).
    if (current.includes(optionId)) {
      selectedModifiers[group.id] = group.isRequired ? current : [];
    } else {
      selectedModifiers[group.id] = [optionId];
    }
  }
}

const isModifierSelectionValid = computed(() => {
  for (const group of selectedItemModifierGroups.value) {
    const count = (selectedModifiers[group.id] || []).length;
    const min = group.isRequired ? Math.max(group.minSelect || 1, 1) : (group.minSelect || 0);
    if (count < min) return false;
    if (group.maxSelect && count > group.maxSelect) return false;
  }
  return true;
});

const selectedModifierLines = computed(() => {
  const lines: { modifierOptionId: string; name: string; price: number }[] = [];
  for (const group of selectedItemModifierGroups.value) {
    const options = modifierOptionsByGroup.value[group.id] || [];
    for (const optionId of selectedModifiers[group.id] || []) {
      const opt = options.find((o) => o.id === optionId);
      if (opt) lines.push({ modifierOptionId: opt.id, name: opt.name, price: opt.price });
    }
  }
  return lines;
});

const modifierUnitPriceTotal = computed(() => selectedModifierLines.value.reduce((sum, m) => sum + m.price, 0));

// --- Item detail sheet ---
const selectedItem = ref<MenuItem | null>(null);
const isItemSheetOpen = ref(false);
const sheetQuantity = ref(1);
function openItemDetail(item: MenuItem) {
  selectedItem.value = item;
  sheetQuantity.value = 1;
  for (const key of Object.keys(selectedModifiers)) delete selectedModifiers[key];
  isItemSheetOpen.value = true;
  if (item.modifierGroupIds.length) ensureModifierOptionsLoaded(item.modifierGroupIds);
  // Encode the open product into the URL so the sheet can be shared/reopened
  // directly — see the matching ?item= lookup in the data watcher above.
  if (route.query.item !== item.id) {
    router.replace({ query: { ...route.query, item: item.id } });
  }
}
function closeItemDetail() {
  isItemSheetOpen.value = false;
  if (route.query.item) {
    const q = { ...route.query };
    delete q.item;
    router.replace({ query: q });
  }
}

const selectedBranchId = ref<string>('');
const isDescriptionExpanded = ref(false);
const activeCategoryId = ref<string>('');

const visibleBranches = computed(() => (data.value?.storefront.branches || []).filter((b) => b.isActive));
const activeBranch = computed(() => visibleBranches.value.find((b) => b.id === selectedBranchId.value) || null);
const needsBranchPicker = computed(() => visibleBranches.value.length > 1 && !selectedBranchId.value);

// Closed-now notice: only shown once a branch is picked and it actually has
// hours configured (parseWorkingHours returns null for branches that never
// set any, so those silently skip the notice rather than falsely claiming
// "closed" for every tenant that hasn't touched this feature yet).
const activeBranchHours = computed(() => parseWorkingHours(activeBranch.value?.workingHours));
const isBranchOpenNow = computed(() => {
  if (!activeBranchHours.value) return true;
  return isOpenNow(activeBranchHours.value);
});
const nextOpenText = computed(() => {
  if (!activeBranchHours.value) return '';
  const dayLabels = {
    mon: t('menu.dayMon') || 'Mon', tue: t('menu.dayTue') || 'Tue', wed: t('menu.dayWed') || 'Wed',
    thu: t('menu.dayThu') || 'Thu', fri: t('menu.dayFri') || 'Fri', sat: t('menu.daySat') || 'Sat', sun: t('menu.daySun') || 'Sun',
  };
  const next = nextOpenLabel(activeBranchHours.value, new Date(), dayLabels, t('menu.today') || 'today', t('menu.tomorrow') || 'tomorrow');
  if (!next) return '';
  return `${next.day} ${t('menu.at') || 'at'} ${next.time}`;
});
const primaryColor = computed(() => data.value?.storefront.brandSettings?.primaryColor || '#3b82f6');
// secondaryColor was set in Brand settings but never actually rendered
// anywhere on the storefront. Brand identity (hero band, header, main CTAs)
// stays on primaryColor; secondaryColor gets a clear, consistent job as the
// price accent — but only on neutral/white backgrounds, never on top of a
// primaryColor-filled surface, since an arbitrary tenant-chosen secondary
// color has no guaranteed contrast against an arbitrary primary color.
const secondaryColor = computed(() => data.value?.storefront.brandSettings?.secondaryColor || primaryColor.value);
// Tenants can pick an arbitrarily light primaryColor (pale yellow, white,
// pastel pink...) — white text would be unreadable on top of that, so pick
// whichever of black/white text actually has usable contrast against it.
const onPrimaryText = computed(() => getContrastTextColor(primaryColor.value));

// Brand-level contact info isn't its own field — the primary (or first)
// branch's phone stands in for "call the business", since that's the number
// that's actually staffed, and social links live on brand settings already.
const brandPhone = computed(() => {
  const branches = data.value?.storefront.branches || [];
  return (branches.find((b) => b.isPrimary) || branches[0])?.phone || '';
});
const brandSocialLinks = computed(() => parseSocialLinks(data.value?.storefront.brandSettings?.socialLinks));

watch(data, (d) => {
  if (!d) return;
  const active = visibleBranches.value;
  const storedBranchId = process.client ? localStorage.getItem(branchStorageKey.value) : null;
  // ?b= accepts either the short slug ("almaty") or the raw branch UUID —
  // slug is what new share links use, UUID keeps any already-shared link
  // working. selectedBranchId itself always ends up holding the real id,
  // since every other comparison on this page (excludedBranchIds, etc.)
  // matches against it.
  const byParam = branchParam.value
    ? active.find((b) => b.slug === branchParam.value || b.id === branchParam.value)
    : undefined;
  if (byParam) {
    selectedBranchId.value = byParam.id;
  } else if (storedBranchId && active.some((b) => b.id === storedBranchId)) {
    selectedBranchId.value = storedBranchId;
  } else if (active.length === 1) {
    selectedBranchId.value = active[0].id;
  }
  if (d.storefront.categories.length && !activeCategoryId.value) {
    activeCategoryId.value = d.storefront.categories[0].id;
  }
  // Deep-link support: ?item=<id> auto-opens that product's detail sheet,
  // so a shared/bookmarked product link resolves to something on load.
  const itemId = route.query.item as string | undefined;
  if (itemId && !selectedItem.value) {
    for (const items of Object.values(d.itemsByCategory)) {
      const found = items.find((i) => i.id === itemId);
      if (found) {
        openItemDetail(found);
        break;
      }
    }
  }
}, { immediate: true });

watch(selectedBranchId, (id) => {
  if (!process.client) return;
  if (id) localStorage.setItem(branchStorageKey.value, id);
  else localStorage.removeItem(branchStorageKey.value);
});

// Stop list — items temporarily unavailable at the selected branch (out of
// stock today), unlike excludedBranchIds which is permanent. Re-fetched
// whenever the branch changes since it's branch-scoped.
const stoppedItemIds = ref<Set<string>>(new Set());
watch(selectedBranchId, async (id) => {
  if (!id) { stoppedItemIds.value = new Set(); return; }
  try {
    const ids = await getPublicStopList(nsSlug.value, id);
    stoppedItemIds.value = new Set(ids);
  } catch (e) {
    logError('[shared/menu] getPublicStopList failed', e);
  }
}, { immediate: true });

const visibleItemsByCategory = computed(() => {
  const result: Record<string, MenuItem[]> = {};
  const byCategory = data.value?.itemsByCategory || {};
  for (const [catId, items] of Object.entries(byCategory)) {
    result[catId] = selectedBranchId.value
      ? items.filter((i) => !i.excludedBranchIds.includes(selectedBranchId.value) && !stoppedItemIds.value.has(i.id))
      : items;
  }
  return result;
});

function badgeById(id: string) {
  return data.value?.storefront.badges.find((b) => b.id === id);
}

// --- Menu search (flattens all visible categories, client-side) ---
const searchQuery = ref('');
const isSearching = computed(() => searchQuery.value.trim().length > 0);
const searchResults = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return [];
  const seen = new Set<string>();
  const results: MenuItem[] = [];
  for (const items of Object.values(visibleItemsByCategory.value)) {
    for (const item of items) {
      if (!seen.has(item.id) && item.name.toLowerCase().includes(q)) {
        seen.add(item.id);
        results.push(item);
      }
    }
  }
  return results;
});

// --- Scroll-spy category nav ---
const scrollContainerRef = ref<HTMLElement | null>(null);
const categoryRefs = ref<Record<string, HTMLElement>>({});
const navRefs = ref<Record<string, HTMLElement>>({});
function setCategoryRef(id: string, el: any) {
  if (el) categoryRefs.value[id] = el as HTMLElement;
}
function setNavRef(id: string, el: any) {
  if (el) navRefs.value[id] = el as HTMLElement;
}

// The page scrolls via its own inner container (see the h-screen comment on
// the root div below), not `window` — window.scrollTo() was a silent no-op.
// scrollIntoView() sidesteps having to identify that container by ref/math
// at all: the browser walks up to whichever ancestor is actually scrollable
// and respects the section's `scroll-mt-*` class for sticky-header
// clearance automatically.
function scrollToCategory(id: string) {
  suppressSpy = true;
  activeCategoryId.value = id;
  const el = categoryRefs.value[id];
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  // Only the explicit click brings its own nav pill into view — doing this
  // on every activeCategoryId change (including the ones scroll-spy makes
  // continuously while the page scrolls) fired a competing horizontal
  // smooth-scroll animation on top of the user's own vertical scroll,
  // which is what actually made scrolling feel choppy/interrupted.
  //
  // The pill row sits in a `position: sticky` header, and calling
  // scrollIntoView() on the button itself (even with inline/horizontal
  // intent) makes the browser also walk up to the page's own vertical
  // scroll container and "correct" its scrollTop against the button's
  // pre-sticky layout position — fighting the scroll above and, in
  // practice, cancelling it back to (or near) 0. Scrolling the pill row's
  // own scrollLeft directly sidesteps the vertical container entirely.
  const btn = navRefs.value[id];
  if (btn?.parentElement) {
    const container = btn.parentElement;
    const target = btn.offsetLeft - (container.clientWidth - btn.clientWidth) / 2;
    container.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
  }
  window.setTimeout(() => { suppressSpy = false; }, 700);
}

let suppressSpy = false;
let observer: IntersectionObserver | null = null;

onMounted(() => {
  restoreContact();
  nextTick(() => {
    observer = new IntersectionObserver((entries) => {
      if (suppressSpy) return;
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const id = (entry.target as HTMLElement).dataset.categoryId;
          if (id) activeCategoryId.value = id;
        }
      }
    }, { rootMargin: '-120px 0px -65% 0px', threshold: 0 });
    Object.values(categoryRefs.value).forEach((el) => observer?.observe(el));
  });
});
onBeforeUnmount(() => observer?.disconnect());

// --- Promo banner sheet: tapping a banner opens it full-width from the
// bottom with an explicit "go to link" action, instead of navigating away
// immediately — targetUrl is a free-form URL, which can just as well be one
// of this storefront's own ?item= product deep links as an external one. ---
const selectedBanner = ref<MenuPromoBanner | null>(null);
const isBannerSheetOpen = ref(false);
function openBanner(b: MenuPromoBanner) {
  selectedBanner.value = b;
  isBannerSheetOpen.value = true;
}
function followBannerLink() {
  const url = selectedBanner.value?.targetUrl;
  if (!url) return;
  isBannerSheetOpen.value = false;
  if (url.startsWith('/')) router.push(url);
  else window.open(url, '_blank', 'noopener');
}

// --- "My order" lookup: a customer types the order number they were shown
// at checkout + the phone it was placed under, and — if it matches — a new
// tab opens with the read-only status page. The number+phone pair is the
// whole ownership check (no OTP), same trust model as checkout itself.
const isMyOrderSheetOpen = ref(false);
const myOrderNumberInput = ref('');
const myOrderPhoneInput = ref('');
const myOrderLookupError = ref('');
const myOrderLookupLoading = ref(false);

// Pre-fill from the last order placed on this device, so returning to check
// on it is a single tap instead of having to remember/retype the number.
function openMyOrderSheet() {
  myOrderNumberInput.value = '';
  myOrderPhoneInput.value = '';
  myOrderLookupError.value = '';
  if (process.client) {
    try {
      const raw = localStorage.getItem(lastOrderStorageKey.value);
      if (raw) {
        const saved = JSON.parse(raw);
        if (typeof saved.number === 'number' && typeof saved.createdAt === 'string') {
          myOrderNumberInput.value = smartOrderNumber(saved);
        }
        if (typeof saved.phone === 'string') myOrderPhoneInput.value = saved.phone;
      }
    } catch (e) {
      logError('[shared/menu] restoreLastOrder failed', e);
    }
  }
  isMyOrderSheetOpen.value = true;
}

// The whole lookup key lives in one path segment: "YYMMDD-NNN-PHONEDIGITS"
// (the smart order number, itself already dash-separated, plus the digits-
// only phone). The order-status page splits it back apart on "-".
function orderStatusHref(smartNumber: string, phone: string): string {
  return `/to/${nsSlug.value}/menu/${smartNumber}-${phone.replace(/\D/g, '')}`;
}

async function submitMyOrderLookup() {
  myOrderLookupError.value = '';
  const parsed = parseSmartOrderNumber(myOrderNumberInput.value);
  if (!parsed) {
    myOrderLookupError.value = t('menu.myOrderInvalidNumber') || 'Enter the order number exactly as shown, e.g. 260718-003';
    return;
  }
  if (myOrderPhoneInput.value.replace(/\D/g, '').length < 10) {
    myOrderLookupError.value = t('menu.myOrderInvalidPhone') || 'Enter the phone the order was placed under';
    return;
  }

  myOrderLookupLoading.value = true;
  try {
    const found = await getPublicOrderStatus(
      nsSlug.value,
      parsed.number,
      myOrderPhoneInput.value.replace(/\D/g, ''),
      parsed.createdFrom,
      parsed.createdTo
    );
    if (!found) {
      myOrderLookupError.value = t('menu.myOrderNotFound') || "Couldn't find an order with that number and phone";
      return;
    }
    isMyOrderSheetOpen.value = false;
    window.open(orderStatusHref(smartOrderNumber(found), myOrderPhoneInput.value), '_blank', 'noopener');
  } catch (e) {
    logError('[shared/menu] submitMyOrderLookup failed', e);
    myOrderLookupError.value = getErrorMessage(e) || (t('menu.myOrderNotFound') || "Couldn't find an order with that number and phone");
  } finally {
    myOrderLookupLoading.value = false;
  }
}

// --- Cart ---
type CartLineModifier = { modifierOptionId: string; name: string; price: number };
type CartLine = { menuItemId: string; name: string; price: number; quantity: number; imageUrl?: string | null; modifiers?: CartLineModifier[] };
const cart = ref<CartLine[]>([]);
const isCartOpen = ref(false);
const isCheckoutOpen = ref(false);
const submitting = ref(false);
const orderResult = ref<{ number: number; createdAt: string } | null>(null);

// Two lines are "the same" only if they're the same item AND the same exact
// modifier selection — a Latte with oat milk and a Latte with no milk are
// different purchasable things and must not silently merge quantities.
function modifiersKey(mods?: CartLineModifier[]): string {
  return (mods || []).map((m) => m.modifierOptionId).sort().join(',');
}

function lineUnitPrice(line: CartLine): number {
  return line.price + (line.modifiers || []).reduce((sum, m) => sum + m.price, 0);
}

function addToCartQty(item: MenuItem, qty: number, modifiers?: CartLineModifier[]) {
  const key = modifiersKey(modifiers);
  const existing = cart.value.find((l) => l.menuItemId === item.id && modifiersKey(l.modifiers) === key);
  if (existing) {
    existing.quantity += qty;
  } else {
    cart.value.push({ menuItemId: item.id, name: item.name, price: item.price, quantity: qty, imageUrl: item.imageUrl, modifiers });
  }
}

function addToCart(item: MenuItem) {
  addToCartQty(item, 1);
}

function cartQuantityFor(itemId: string): number {
  return cart.value.filter((l) => l.menuItemId === itemId).reduce((sum, l) => sum + l.quantity, 0);
}

function decrementItem(item: MenuItem) {
  const line = cart.value.find((l) => l.menuItemId === item.id);
  if (line) changeQuantity(line, -1);
}

function changeQuantity(line: CartLine, delta: number) {
  line.quantity += delta;
  if (line.quantity <= 0) {
    const key = modifiersKey(line.modifiers);
    cart.value = cart.value.filter((l) => !(l.menuItemId === line.menuItemId && modifiersKey(l.modifiers) === key));
  }
}

const cartCount = computed(() => cart.value.reduce((sum, l) => sum + l.quantity, 0));
const cartTotal = computed(() => cart.value.reduce((sum, l) => sum + l.quantity * lineUnitPrice(l), 0));

// Reload the cart whenever the branch-scoped storage key changes (branch
// switched) — swaps in that branch's own saved cart instead of carrying the
// previous branch's items over. `immediate: true` also performs the
// initial load once selectedBranchId has resolved (see the data watcher
// above), rather than racing it.
let restoringCart = false;
watch(cartStorageKey, (key) => {
  if (!process.client) return;
  restoringCart = true;
  try {
    const stored = localStorage.getItem(key);
    cart.value = stored ? JSON.parse(stored) : [];
  } catch (e) {
    logError('[shared/menu] failed to restore cart from localStorage', e);
    cart.value = [];
  } finally {
    restoringCart = false;
  }
}, { immediate: true });

watch(cart, (c) => {
  if (!process.client || restoringCart) return;
  localStorage.setItem(cartStorageKey.value, JSON.stringify(c));
}, { deep: true });

function openCheckout() {
  isCartOpen.value = false;
  isCheckoutOpen.value = true;
}

// --- Checkout form ---
const checkoutForm = reactive({
  customerName: '',
  phone: '',
  type: 'delivery' as 'pickup' | 'delivery',
  deliveryAddress: '',
  comment: '',
  scheduled: false,
  scheduledDate: '', // "YYYY-MM-DD"
  scheduledTime: '', // "HH:MM", start of a 1h window
});

// A local Date built from scheduledDate/scheduledTime, or null if either is
// missing/invalid — used both for the ISO value sent to the backend and for
// the human-readable "11:00–12:00" confirmation text.
const scheduledDateTime = computed<Date | null>(() => {
  if (!checkoutForm.scheduled || !checkoutForm.scheduledDate || !checkoutForm.scheduledTime) return null;
  const d = new Date(`${checkoutForm.scheduledDate}T${checkoutForm.scheduledTime}:00`);
  return Number.isNaN(d.getTime()) ? null : d;
});
const scheduledWindowLabel = computed(() => {
  const start = scheduledDateTime.value;
  if (!start) return '';
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const fmt = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${fmt(start)}–${fmt(end)}`;
});
const todayDateInputValue = computed(() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
});

// Contact details (name + phone only — not address/comment, those are
// per-order) survive across visits so a returning customer doesn't have to
// retype them. Scoped per namespace like the cart, so one storefront never
// pre-fills another's contact field with a name typed elsewhere.
function restoreContact() {
  if (!process.client) return;
  try {
    const raw = localStorage.getItem(contactStorageKey.value);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (typeof saved.customerName === 'string') checkoutForm.customerName = saved.customerName;
    if (typeof saved.phone === 'string') checkoutForm.phone = saved.phone;
  } catch (e) {
    logError('[shared/menu] restoreContact failed', e);
  }
}
watch([() => checkoutForm.customerName, () => checkoutForm.phone], ([customerName, phone]) => {
  if (!process.client) return;
  if (!customerName && !phone) return;
  localStorage.setItem(contactStorageKey.value, JSON.stringify({ customerName, phone }));
});

function sanitizePhoneInput(value: string): string {
  return value.replace(/[^\d+()\s-]/g, '');
}
function updatePhoneValue(value: string) {
  checkoutForm.phone = sanitizePhoneInput(value);
}
const isPhoneValid = computed(() => checkoutForm.phone.replace(/\D/g, '').length >= 10);

// "Previous orders" — fetched from the backend (myOrders query), matched by
// the phone currently in the form. Debounced so it doesn't fire a request on
// every keystroke while typing the number.
const myPastOrders = ref<MyOrderSummary[]>([]);
// The backend already caps this list (10 rows) so a heavy repeat customer
// never floods the response — this just keeps the collapsed view short.
const MY_PAST_ORDERS_COLLAPSED_COUNT = 3;
const myPastOrdersExpanded = ref(false);
const visiblePastOrders = computed(() => (
  myPastOrdersExpanded.value ? myPastOrders.value : myPastOrders.value.slice(0, MY_PAST_ORDERS_COLLAPSED_COUNT)
));
let myOrdersDebounce: ReturnType<typeof setTimeout> | null = null;
watch(() => checkoutForm.phone, (phone) => {
  if (myOrdersDebounce) clearTimeout(myOrdersDebounce);
  if (!isPhoneValid.value) {
    myPastOrders.value = [];
    return;
  }
  myOrdersDebounce = setTimeout(async () => {
    try {
      // Stored phone numbers have no "+"/spacing (see submitOrder), and the
      // backend does a substring match — normalize to digits-only or a
      // number typed with formatting (e.g. "+7 778...") would never match.
      myPastOrders.value = await getMyOrders(nsSlug.value, phone.replace(/\D/g, ''));
      myPastOrdersExpanded.value = false;
    } catch (e) {
      logError('[shared/menu] getMyOrders failed', e);
      myPastOrders.value = [];
    }
  }, 500);
});

const isCheckoutValid = computed(() => {
  if (!isPhoneValid.value) return false;
  if (checkoutForm.type === 'delivery' && !checkoutForm.deliveryAddress.trim()) return false;
  if (checkoutForm.type === 'pickup' && !selectedBranchId.value) return false;
  if (checkoutForm.scheduled && !scheduledDateTime.value) return false;
  return cart.value.length > 0;
});

async function submitOrder() {
  if (!isCheckoutValid.value) return;
  submitting.value = true;
  try {
    const result = await submitPublicOrder(nsSlug.value, {
      branchId: selectedBranchId.value || undefined,
      phone: checkoutForm.phone.trim(),
      customerName: checkoutForm.customerName.trim() || undefined,
      type: checkoutForm.type,
      deliveryAddress: checkoutForm.type === 'delivery' ? checkoutForm.deliveryAddress.trim() : undefined,
      deliveryAt: scheduledDateTime.value ? scheduledDateTime.value.toISOString() : undefined,
      comment: checkoutForm.comment.trim() || undefined,
      sourceTag: sourceTag.value || undefined,
      totalAmount: cartTotal.value,
      items: cart.value.map((l) => ({
        menuItemId: l.menuItemId,
        name: l.name,
        priceAtPurchase: l.price,
        quantity: l.quantity,
        modifiers: (l.modifiers || []).map((m) => ({
          modifierOptionId: m.modifierOptionId,
          name: m.name,
          priceAtPurchase: m.price,
        })),
      })),
    });
    orderResult.value = { number: result.number, createdAt: result.createdAt };
    cart.value = [];
    if (process.client) {
      localStorage.setItem(lastOrderStorageKey.value, JSON.stringify({
        number: result.number,
        createdAt: result.createdAt,
        phone: checkoutForm.phone.trim(),
      }));
    }
  } catch (e) {
    logError('[shared/menu] submitOrder failed', e);
    useToast().add({ title: getErrorMessage(e) || 'Failed to submit order', color: 'red' });
  } finally {
    submitting.value = false;
  }
}

function closeCheckout() {
  isCheckoutOpen.value = false;
  orderResult.value = null;
  // Contact details (name/phone) are intentionally kept so they're still
  // pre-filled next time — only the order-specific fields reset.
  checkoutForm.deliveryAddress = '';
  checkoutForm.comment = '';
}

useHead(() => {
  const brand = data.value?.storefront.brandSettings;
  const title = brand?.seoTitle || brand?.name || 'Menu';
  const description = brand?.seoDescription || brand?.welcomeMessage || '';
  return {
    title,
    meta: [
      { name: 'description', content: description },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      ...(brand?.logoUrl ? [{ property: 'og:image', content: brand.logoUrl }] : []),
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: description },
      ...(brand?.logoUrl ? [{ name: 'twitter:image', content: brand.logoUrl }] : []),
    ],
  };
});
</script>

<template>
  <div
    ref="scrollContainerRef"
    class="h-screen overflow-y-auto bg-gray-50 dark:bg-gray-950"
    :style="{ '--brand-color': primaryColor }"
  >
    <!--
      The global stylesheet sets `html, body { overflow: hidden }` and
      expects every page to scroll via its own inner container (see
      assets/css/global.css). Pages under the default layout get that
      container for free from layouts/default.vue's `h-screen` app-shell;
      this storefront page opts out via `layout: false`, so it has no
      viewport-capped ancestor to inherit — `h-full` alone just grows to
      fit its own content instead of capping at the viewport, which is
      why `h-screen` (not `h-full`) is required here for overflow-y-auto
      to actually produce a scrollbar instead of a no-op.
    -->
    <div v-if="loading" class="flex items-center justify-center min-h-screen">
      <UIcon name="lucide:loader-2" class="w-8 h-8 animate-spin text-gray-400" />
    </div>

    <div v-else-if="error" class="flex items-center justify-center min-h-screen px-4">
      <p class="text-gray-500 dark:text-gray-400 text-center">{{ error }}</p>
    </div>

    <template v-else-if="data">
      <!-- Platform attribution: slim, neutral bar above the brand hero —
           kept visually quiet (small type, muted color) so the tenant's
           own brand below remains the dominant element on the page. -->
      <div class="bg-gray-50 dark:bg-gray-950">
        <div class="max-w-3xl mx-auto px-4 py-1.5 flex items-center justify-between gap-2">
          <div class="flex items-center gap-0.5 flex-shrink-0">
            <button
              v-for="loc in availableLocales"
              :key="loc"
              type="button"
              class="px-1.5 py-0.5 rounded text-[11px] font-medium transition-colors"
              :class="locale === loc ? 'text-gray-700 dark:text-gray-200 bg-gray-200 dark:bg-gray-800' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'"
              @click="setLocale(loc)"
            >
              {{ LOCALE_LABELS[loc] || loc.toUpperCase() }}
            </button>
          </div>
          <a
            href="https://lota.tools"
            target="_blank"
            rel="noopener"
            class="inline-flex items-center gap-1 text-[11px] text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors flex-shrink-0"
          >
            <img src="/assets/logo.png" alt="" class="w-3 h-3">
            {{ t('menu.poweredBy') || 'Powered by' }} <span class="font-semibold">lota</span>
          </a>
        </div>
      </div>

      <!-- Header: brand takes top billing — colored hero band in the
           tenant's own primary color, big elevated logo card. -->
      <div class="relative" :style="{ backgroundColor: primaryColor }">
        <div class="max-w-3xl mx-auto px-4 pt-7 pb-6">
        <div class="flex items-start gap-4">
          <div class="w-20 h-20 rounded-2xl bg-white shadow-lg ring-4 ring-white/30 flex-shrink-0 overflow-hidden flex items-center justify-center">
            <img
              v-if="data.storefront.brandSettings?.logoUrl"
              :src="data.storefront.brandSettings.logoUrl"
              :alt="data.storefront.brandSettings.logoAlt || data.storefront.brandSettings.name"
              class="w-full h-full object-contain p-1.5"
            >
            <Icon v-else name="lucide:store" class="w-8 h-8 text-gray-300" />
          </div>
          <div class="min-w-0 flex-1 pt-1">
            <h1 class="text-2xl font-bold truncate" :style="{ color: onPrimaryText }">
              {{ data.storefront.brandSettings?.name || nsSlug }}
            </h1>
            <p
              v-if="data.storefront.brandSettings?.welcomeMessage"
              class="text-sm mt-0.5 cursor-pointer"
              :class="isDescriptionExpanded ? '' : 'line-clamp-2'"
              :style="{ color: onPrimaryText, opacity: 0.85 }"
              @click="isDescriptionExpanded = !isDescriptionExpanded"
            >
              {{ data.storefront.brandSettings.welcomeMessage }}
            </p>
          </div>
        </div>
        <!-- Address + brand contacts share a row below the name, instead of
             competing with it for width — social icons used to sit next to
             the (already truncating) shop name and squeeze it further on
             narrow screens. -->
        <div v-if="activeBranch || visibleBranches[0] || brandPhone || brandSocialLinks.length" class="mt-3 flex items-center justify-between gap-2 flex-wrap">
          <a
            v-if="activeBranch || visibleBranches[0]"
            :href="twoGisSearchHref((activeBranch || visibleBranches[0]).address)"
            target="_blank"
            rel="noopener"
            class="inline-flex items-center gap-1.5 max-w-full rounded-full bg-white/15 hover:bg-white/25 px-3 py-1.5 text-xs font-medium transition-colors min-w-0"
            :style="{ color: onPrimaryText }"
          >
            <Icon name="lucide:map-pin" class="w-3.5 h-3.5 flex-shrink-0" />
            <span class="truncate">{{ (activeBranch || visibleBranches[0]).address }}</span>
            <Icon name="lucide:external-link" class="w-3 h-3 flex-shrink-0 opacity-70" />
          </a>
          <span
            v-if="activeBranch && activeBranchHours"
            class="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium flex-shrink-0"
            :style="{ color: onPrimaryText }"
          >
            <span class="w-1.5 h-1.5 rounded-full flex-shrink-0" :class="isBranchOpenNow ? 'bg-emerald-400' : 'bg-red-400'" />
            {{ isBranchOpenNow ? (t('menu.openNow') || 'Open now') : (t('menu.closedNow') || 'Closed now') }}
          </span>
          <div v-if="brandPhone || brandSocialLinks.length" class="flex items-center gap-2 flex-shrink-0 ml-auto">
            <a
              v-if="brandPhone"
              :href="telHref(brandPhone)"
              class="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors"
              :style="{ color: onPrimaryText }"
              :aria-label="t('menu.call') || 'Call'"
            >
              <Icon name="lucide:phone" class="w-3.5 h-3.5" />
            </a>
            <a
              v-for="link in brandSocialLinks"
              :key="link.link"
              :href="link.link"
              target="_blank"
              rel="noopener"
              class="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors"
              :style="{ color: onPrimaryText }"
              :aria-label="link.description || socialLabel(link.name)"
            >
              <Icon :name="socialIcon(link.name)" class="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
        </div>
      </div>

      <!-- Closed-now notice: orders are still accepted (see the ASAP/Schedule
           toggle at checkout), just heads-up that nobody's there to start on
           it until the branch reopens. -->
      <div v-if="activeBranch && activeBranchHours && !isBranchOpenNow" class="max-w-3xl mx-auto px-4 pt-4">
        <div class="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 px-4 py-3 flex items-start gap-2.5">
          <Icon name="lucide:moon" class="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div class="text-sm text-amber-800 dark:text-amber-300">
            <span class="font-medium">{{ t('menu.closedNowNotice') || "We're closed right now." }}</span>
            {{ ' ' }}
            <span v-if="nextOpenText">{{ t('menu.closedNowNoticeDetail') || 'Your order will be prepared when we open' }} {{ nextOpenText }}.</span>
          </div>
        </div>
      </div>

      <!-- Promo banners -->
      <div v-if="data.storefront.promoBanners.length" class="max-w-3xl mx-auto px-4 pt-4 flex gap-3 overflow-x-auto">
        <button
          v-for="b in data.storefront.promoBanners"
          :key="b.id"
          type="button"
          class="flex-shrink-0 w-64 h-28 rounded-xl overflow-hidden relative block text-left shadow-md"
          @click="openBanner(b)"
        >
          <img :src="b.imageUrl" :alt="b.imageAlt || b.title" class="w-full h-full object-cover">
          <div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-3">
            <span class="text-white text-sm font-semibold">{{ b.title }}</span>
          </div>
        </button>
      </div>

      <!-- Branch picker -->
      <div v-if="needsBranchPicker" class="max-w-3xl mx-auto px-4 py-6">
        <h2 class="text-lg font-semibold mb-3 text-gray-900 dark:text-white">
          {{ t('menu.chooseBranch') || 'Choose a branch' }}
        </h2>
        <div class="grid gap-2">
          <button
            v-for="b in visibleBranches"
            :key="b.id"
            class="text-left rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm hover:shadow-md hover:border-primary-400 transition-all"
            @click="selectedBranchId = b.id"
          >
            <div class="font-medium text-gray-900 dark:text-white">{{ b.name }}</div>
            <div class="text-sm text-gray-500 dark:text-gray-400">{{ b.address }}</div>
          </button>
        </div>
      </div>

      <!-- Catalog: search + sticky anchor nav + continuous scroll sections -->
      <template v-else>
        <div class="sticky top-0 z-20 bg-gray-50/95 dark:bg-gray-950/95 backdrop-blur border-b border-gray-200 dark:border-gray-800 shadow-sm">
          <div v-if="activeBranch && visibleBranches.length > 1" class="max-w-3xl mx-auto px-4 pt-2 flex justify-start">
            <button
              type="button"
              class="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-full px-3 py-1"
              @click="selectedBranchId = ''"
            >
              <Icon name="lucide:map-pin" class="w-3 h-3" />
              {{ activeBranch.name }}
              <Icon name="lucide:chevron-down" class="w-3 h-3 text-gray-400" />
            </button>
          </div>
          <div class="max-w-3xl mx-auto px-4 pt-2.5 pb-2 flex items-center gap-2">
            <div class="relative flex-1 min-w-0">
              <Icon name="lucide:search" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                v-model="searchQuery"
                type="search"
                :placeholder="t('menu.searchMenu') || 'Search menu'"
                class="w-full pl-9 pr-8 py-2 text-sm rounded-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-400"
              >
              <button
                v-if="searchQuery"
                type="button"
                class="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                @click="searchQuery = ''"
              >
                <Icon name="lucide:x" class="w-4 h-4" />
              </button>
            </div>
            <button
              type="button"
              class="flex-shrink-0 h-9 px-3 rounded-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-200"
              @click="openMyOrderSheet"
            >
              <Icon name="lucide:receipt-text" class="w-4 h-4" />
              {{ t('menu.myOrder') || 'My order' }}
            </button>
          </div>

          <div v-if="!isSearching" class="max-w-3xl mx-auto px-4 pb-2 flex gap-2 overflow-x-auto">
            <button
              v-for="c in data.storefront.categories"
              :key="c.id"
              :ref="(el) => setNavRef(c.id, el)"
              class="flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-all shadow-sm"
              :class="activeCategoryId !== c.id ? 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-800' : 'shadow-md'"
              :style="activeCategoryId === c.id ? { backgroundColor: primaryColor, color: onPrimaryText } : {}"
              @click="scrollToCategory(c.id)"
            >
              {{ c.name }}
            </button>
          </div>
        </div>

        <!-- Search results -->
        <div v-if="isSearching" class="max-w-3xl mx-auto px-4 py-4 pb-2">
          <h2 class="text-base font-semibold text-gray-900 dark:text-white mb-3">
            {{ t('menu.searchResults') || 'Search results' }}
          </h2>
          <div v-if="searchResults.length" class="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-6">
            <ItemCard
              v-for="item in searchResults"
              :key="item.id"
              :item="item"
              :badges="data.storefront.badges"
              :currency="data.storefront.brandSettings?.currencyCode"
              :primary-color="primaryColor"
              :secondary-color="secondaryColor"
              :quantity="cartQuantityFor(item.id)"
              @open="openItemDetail(item)"
              @add="addToCart(item)"
              @increment="addToCart(item)"
              @decrement="decrementItem(item)"
            />
          </div>
          <div v-else class="text-center py-12">
            <Icon name="lucide:search-x" class="w-8 h-8 text-gray-300 dark:text-gray-700 mx-auto mb-2" />
            <p class="text-gray-500 dark:text-gray-400 text-sm font-medium">{{ t('menu.noSearchResults') || 'Nothing found' }}</p>
            <p class="text-gray-400 dark:text-gray-500 text-xs mt-1">{{ t('menu.noSearchResultsDesc') || 'Try a different search term.' }}</p>
          </div>
        </div>

        <!-- Category sections -->
        <div v-else class="max-w-3xl mx-auto px-4 py-4 pb-2 space-y-8">
          <section
            v-for="c in data.storefront.categories"
            :key="c.id"
            :ref="(el) => setCategoryRef(c.id, el)"
            :data-category-id="c.id"
            class="scroll-mt-28 border-t border-gray-200 dark:border-gray-800 pt-6 first:border-t-0 first:pt-0"
          >
            <h2 class="text-base font-semibold text-gray-900 dark:text-white mb-3">{{ c.name }}</h2>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-6">
              <ItemCard
                v-for="item in visibleItemsByCategory[c.id] || []"
                :key="item.id"
                :item="item"
                :badges="data.storefront.badges"
                :currency="data.storefront.brandSettings?.currencyCode"
                :primary-color="primaryColor"
                :secondary-color="secondaryColor"
                :quantity="cartQuantityFor(item.id)"
                @open="openItemDetail(item)"
                @add="addToCart(item)"
                @increment="addToCart(item)"
                @decrement="decrementItem(item)"
              />
            </div>
            <div v-if="!(visibleItemsByCategory[c.id] || []).length" class="text-center py-6 text-gray-400 text-sm">
              {{ t('menu.noMenuItems') || 'No items yet' }}
            </div>
          </section>
        </div>

        <!-- Floating cart bar -->
        <div
          v-if="cartCount > 0"
          class="fixed bottom-0 left-0 right-0 z-30 pt-8 pb-4 px-4 bg-gradient-to-t from-gray-50 dark:from-gray-950 via-gray-50/95 dark:via-gray-950/95 to-transparent pointer-events-none"
        >
          <div class="max-w-3xl mx-auto pointer-events-auto">
            <button
              type="button"
              class="w-full flex items-center justify-between gap-3 rounded-2xl shadow-lg px-4 py-3.5 transition-transform active:scale-[0.98]"
              :style="{ backgroundColor: primaryColor, color: onPrimaryText }"
              @click="isCartOpen = true"
            >
              <span class="flex items-center gap-2 font-semibold text-sm">
                <Icon name="lucide:shopping-bag" class="w-4 h-4" />
                {{ t('menu.viewCart') || 'View cart' }} · {{ cartCount }}
              </span>
              <span class="font-bold tabular-nums">{{ formatMoney(cartTotal, data.storefront.brandSettings?.currencyCode) }}</span>
            </button>
          </div>
        </div>
      </template>

      <!-- My order tracking: a proper, hard-to-miss block at the bottom of
           the menu, not just a small button — the top-bar/search-bar
           shortcuts are easy to miss on a long scroll. -->
      <div class="max-w-3xl mx-auto px-4 pt-8">
        <button
          type="button"
          class="w-full flex items-center gap-3 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm px-4 py-4 text-left hover:border-gray-300 dark:hover:border-gray-700 transition-colors"
          @click="openMyOrderSheet"
        >
          <span
            class="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
            :style="{ backgroundColor: `${primaryColor}`, color: secondaryColor }"
          >
            <Icon name="lucide:receipt-text" class="w-5 h-5" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block text-sm font-semibold text-gray-900 dark:text-white">{{ t('menu.myOrder') || 'My order' }}</span>
            <span class="block text-xs text-gray-500 dark:text-gray-400 truncate">{{ t('menu.myOrderBlockHint') || 'Check your order status and details' }}</span>
          </span>
          <Icon name="lucide:chevron-right" class="w-4 h-4 text-gray-400 flex-shrink-0" />
        </button>
      </div>

      <!-- Footer: company/contact info instead of a bare spacer. -->
      <footer class="mt-10 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div class="max-w-3xl mx-auto px-4 py-6 space-y-3">
          <div class="font-semibold text-gray-900 dark:text-white">{{ data.storefront.brandSettings?.name || nsSlug }}</div>
          <div v-if="activeBranch || visibleBranches[0]" class="flex items-start gap-2 text-sm text-gray-500 dark:text-gray-400">
            <Icon name="lucide:map-pin" class="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{{ (activeBranch || visibleBranches[0]).address }}</span>
          </div>
          <div class="flex flex-wrap gap-2 pt-1">
            <a
              v-if="activeBranch || visibleBranches[0]"
              :href="twoGisSearchHref((activeBranch || visibleBranches[0]).address)"
              target="_blank"
              rel="noopener"
              class="inline-flex items-center gap-1.5 text-xs font-semibold rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 px-3 py-1.5 transition-colors"
            >
              <Icon name="lucide:map" class="w-3.5 h-3.5" />
              {{ t('menu.openIn2gis') || 'Open in 2GIS' }}
            </a>
            <a
              v-if="brandPhone"
              :href="telHref(brandPhone)"
              class="inline-flex items-center gap-1.5 text-xs font-semibold rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 px-3 py-1.5 transition-colors"
            >
              <Icon name="lucide:phone" class="w-3.5 h-3.5" />
              {{ formatDisplayPhoneUniversal(brandPhone) }}
            </a>
          </div>
          <div v-if="brandSocialLinks.length" class="flex items-center gap-2 pt-1">
            <a
              v-for="link in brandSocialLinks"
              :key="link.link"
              :href="link.link"
              target="_blank"
              rel="noopener"
              class="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              :aria-label="link.description || socialLabel(link.name)"
            >
              <Icon :name="socialIcon(link.name)" class="w-4 h-4" />
            </a>
          </div>
          <div class="flex items-center justify-between pt-2">
            <a
              href="https://lota.tools"
              target="_blank"
              rel="noopener"
              class="inline-flex items-center gap-1 text-[11px] text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <img src="/assets/logo.png" alt="" class="w-3 h-3">
              {{ t('menu.poweredByFooter') || 'Powered by lota' }}
            </a>
            <div class="flex items-center gap-0.5">
              <button
                v-for="loc in availableLocales"
                :key="loc"
                type="button"
                class="px-1.5 py-0.5 rounded text-[11px] font-medium transition-colors"
                :class="locale === loc ? 'text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'"
                @click="setLocale(loc)"
              >
                {{ LOCALE_LABELS[loc] || loc.toUpperCase() }}
              </button>
            </div>
          </div>
        </div>
      </footer>
      <!-- Clearance so the footer never sits under the fixed cart bar — only
           actually needed while that bar is showing, otherwise it was just
           dead empty space below the footer on every page load. -->
      <div v-if="cartCount > 0" class="pb-24" />
    </template>

    <!-- Item detail sheet -->
    <USlideover
      v-model="isItemSheetOpen"
      side="bottom"
      :ui="{ wrapper: 'sm:justify-center', base: 'sm:max-w-lg sm:mx-auto', height: 'max-h-[92vh]', rounded: 'rounded-t-2xl sm:rounded-2xl sm:mb-6' }"
      @update:model-value="(v: boolean) => { if (!v) closeItemDetail(); }"
    >
      <UCard v-if="selectedItem" :ui="{ ring: '', divide: 'divide-y divide-gray-100 dark:divide-gray-800', body: { base: 'flex-1 overflow-y-auto' } }" class="flex flex-col h-full">
        <template #header>
          <div class="flex items-center gap-3">
            <div class="min-w-0 flex-1">
              <p class="text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
                {{ t('menu.itemDetails') || 'Menu item' }}
              </p>
              <h2 class="text-base font-semibold text-gray-900 dark:text-white truncate">{{ selectedItem.name }}</h2>
            </div>
            <UButton icon="lucide:x" size="sm" color="gray" variant="ghost" class="flex-shrink-0" @click="closeItemDetail" />
          </div>
        </template>

        <div class="space-y-4">
          <div class="w-full aspect-video rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <img
              v-if="selectedItem.imageUrl"
              :src="selectedItem.imageUrl"
              :alt="selectedItem.imageAlt || selectedItem.name"
              class="w-full h-full object-cover"
            >
            <Icon v-else name="lucide:package" class="w-8 h-8 text-gray-300 dark:text-gray-700" />
          </div>
          <div class="text-xl font-bold" :style="{ color: secondaryColor }">
            {{ formatMoney(selectedItem.price, data?.storefront.brandSettings?.currencyCode) }}
          </div>
          <div v-if="selectedItem.badgeIds.length" class="flex flex-wrap gap-1.5">
            <span
              v-for="bid in selectedItem.badgeIds"
              :key="bid"
              class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium"
              :style="badgeById(bid) ? { backgroundColor: badgeById(bid)!.bgColor, color: badgeById(bid)!.textColor } : {}"
            >
              <span v-if="badgeById(bid)?.icon">{{ badgeById(bid)?.icon }}</span>{{ badgeById(bid)?.text }}
            </span>
          </div>
          <p v-if="selectedItem.description" class="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
            {{ selectedItem.description }}
          </p>

          <div v-for="group in selectedItemModifierGroups" :key="group.id" class="pt-3 border-t border-gray-100 dark:border-gray-800">
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm font-semibold text-gray-900 dark:text-white">{{ group.name }}</span>
              <span
                class="text-[11px] font-medium px-1.5 py-0.5 rounded-full"
                :class="group.isRequired
                  ? 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'"
              >
                {{ group.isRequired
                  ? (t('menu.modifierRequired') || 'Required')
                  : (t('menu.modifierOptional') || 'Optional') }}
              </span>
            </div>
            <div v-if="!modifierOptionsByGroup[group.id]" class="flex items-center justify-center py-3">
              <UIcon name="lucide:loader-2" class="w-4 h-4 animate-spin text-gray-400" />
            </div>
            <div v-else class="space-y-1.5">
              <label
                v-for="opt in modifierOptionsByGroup[group.id]"
                :key="opt.id"
                class="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors"
                :class="(selectedModifiers[group.id] || []).includes(opt.id)
                  ? 'border-primary-400 bg-primary-50 dark:bg-primary-950/30'
                  : 'border-gray-200 dark:border-gray-800'"
                @click="toggleModifierOption(group, opt.id)"
              >
                <span class="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
                  <span
                    class="w-4 h-4 flex-shrink-0 flex items-center justify-center border-2"
                    :class="[
                      group.type === 'multi' ? 'rounded-[4px]' : 'rounded-full',
                      (selectedModifiers[group.id] || []).includes(opt.id) ? 'border-primary-500' : 'border-gray-300 dark:border-gray-700',
                    ]"
                    :style="(selectedModifiers[group.id] || []).includes(opt.id) ? { backgroundColor: primaryColor, borderColor: primaryColor } : {}"
                  >
                    <Icon v-if="(selectedModifiers[group.id] || []).includes(opt.id)" name="lucide:check" class="w-2.5 h-2.5 text-white" />
                  </span>
                  {{ opt.name }}
                </span>
                <span v-if="opt.price" class="text-xs text-gray-500 dark:text-gray-400 tabular-nums flex-shrink-0">+{{ formatMoney(opt.price, data?.storefront.brandSettings?.currencyCode) }}</span>
              </label>
            </div>
          </div>
        </div>

        <template #footer>
          <div class="flex flex-col gap-2">
            <p v-if="!isModifierSelectionValid" class="text-xs text-red-500 text-center">
              {{ t('menu.modifierSelectionRequired') || 'Please complete the required options above.' }}
            </p>
            <div class="flex items-center gap-3">
              <div class="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-full p-1 flex-shrink-0">
                <button
                  type="button"
                  class="w-9 h-9 rounded-full flex items-center justify-center text-white active:scale-90 transition-transform disabled:opacity-40"
                  :style="{ backgroundColor: primaryColor, color: onPrimaryText }"
                  :disabled="sheetQuantity <= 1"
                  @click="sheetQuantity = Math.max(1, sheetQuantity - 1)"
                >
                  <Icon name="lucide:minus" class="w-4 h-4" />
                </button>
                <span class="w-6 text-center text-sm font-bold tabular-nums">{{ sheetQuantity }}</span>
                <button
                  type="button"
                  class="w-9 h-9 rounded-full flex items-center justify-center text-white active:scale-90 transition-transform"
                  :style="{ backgroundColor: primaryColor, color: onPrimaryText }"
                  @click="sheetQuantity++"
                >
                  <Icon name="lucide:plus" class="w-4 h-4" />
                </button>
              </div>
              <UButton
                block
                :disabled="!isModifierSelectionValid"
                :style="{ backgroundColor: primaryColor, color: onPrimaryText }"
                class="border-0 flex-1"
                @click="addToCartQty(selectedItem, sheetQuantity, selectedModifierLines); closeItemDetail()"
              >
                {{ t('menu.addToCart') || 'Add to cart' }} · {{ formatMoney((selectedItem.price + modifierUnitPriceTotal) * sheetQuantity, data?.storefront.brandSettings?.currencyCode) }}
              </UButton>
            </div>
          </div>
        </template>
      </UCard>
    </USlideover>

    <!-- Banner sheet: full-width from the bottom, explicit "go to link" action -->
    <!-- "My order" lookup sheet -->
    <USlideover v-model="isMyOrderSheetOpen" side="bottom" :ui="{ wrapper: 'sm:justify-center', base: 'sm:max-w-lg sm:mx-auto', height: 'max-h-[85vh]', rounded: 'rounded-t-2xl sm:rounded-2xl sm:mb-6' }">
      <UCard :ui="{ ring: '', divide: 'divide-y divide-gray-100 dark:divide-gray-800', body: { base: 'flex-1 overflow-y-auto' } }" class="flex flex-col h-full">
        <template #header>
          <div class="mx-auto w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-700 mb-2" />
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold">{{ t('menu.myOrder') || 'My order' }}</h3>
            <UButton icon="lucide:x" size="sm" color="gray" variant="ghost" @click="isMyOrderSheetOpen = false" />
          </div>
        </template>
        <div class="space-y-4">
          <p class="text-sm text-gray-500 dark:text-gray-400">
            {{ t('menu.myOrderHint') || 'Enter your order number (shown at checkout) and the phone it was placed under.' }}
          </p>
          <UFormGroup :label="t('menu.orderNumber') || 'Order number'" required>
            <UInput v-model="myOrderNumberInput" placeholder="260718-003" size="lg" @keyup.enter="submitMyOrderLookup" />
          </UFormGroup>
          <UFormGroup :label="t('menu.phone') || 'Phone'" required>
            <UInput
              :model-value="myOrderPhoneInput"
              type="tel"
              inputmode="tel"
              autocomplete="tel"
              pattern="[0-9+()\s-]*"
              size="lg"
              :placeholder="t('contacts.enterPhone') || '+7 700 123 45 67'"
              @update:model-value="(v: string) => (myOrderPhoneInput = v.replace(/[^\d+()\s-]/g, ''))"
              @keyup.enter="submitMyOrderLookup"
            />
          </UFormGroup>
          <p v-if="myOrderLookupError" class="text-sm text-red-600 dark:text-red-400">{{ myOrderLookupError }}</p>
        </div>
        <template #footer>
          <UButton
            block
            :style="{ backgroundColor: primaryColor, color: onPrimaryText }"
            class="border-0"
            :loading="myOrderLookupLoading"
            @click="submitMyOrderLookup"
          >
            {{ t('menu.myOrderSubmit') || 'Find my order' }}
          </UButton>
        </template>
      </UCard>
    </USlideover>

    <USlideover v-model="isBannerSheetOpen" side="bottom" :ui="{ wrapper: 'sm:justify-center', base: 'sm:max-w-lg sm:mx-auto', height: 'max-h-[85vh]', rounded: 'rounded-t-2xl sm:rounded-2xl sm:mb-6' }">
      <UCard v-if="selectedBanner" :ui="{ ring: '', divide: 'divide-y divide-gray-100 dark:divide-gray-800', body: { base: 'flex-1 overflow-y-auto' } }" class="flex flex-col h-full">
        <template #header>
          <div class="mx-auto w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-700 mb-2" />
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold">{{ selectedBanner.title }}</h3>
            <UButton icon="lucide:x" size="sm" color="gray" variant="ghost" @click="isBannerSheetOpen = false" />
          </div>
        </template>
        <div class="space-y-4">
          <img :src="selectedBanner.imageUrl" :alt="selectedBanner.imageAlt || selectedBanner.title" class="w-full aspect-video object-cover rounded-xl">
          <p v-if="selectedBanner.description" class="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
            {{ selectedBanner.description }}
          </p>
        </div>
        <template v-if="selectedBanner.targetUrl" #footer>
          <UButton block :style="{ backgroundColor: primaryColor, color: onPrimaryText }" class="border-0" icon="lucide:arrow-right" @click="followBannerLink">
            {{ t('menu.viewMore') || 'View more' }}
          </UButton>
        </template>
      </UCard>
    </USlideover>

    <!-- Cart sheet -->
    <USlideover v-model="isCartOpen" side="bottom" :ui="{ wrapper: 'sm:justify-center', base: 'sm:max-w-lg sm:mx-auto', height: 'max-h-[85vh]', rounded: 'rounded-t-2xl sm:rounded-2xl sm:mb-6' }">
      <UCard :ui="{ ring: '', divide: 'divide-y divide-gray-100 dark:divide-gray-800', body: { base: 'flex-1 overflow-y-auto' } }" class="flex flex-col h-full">
        <template #header>
          <div class="mx-auto w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-700 mb-2" />
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold">{{ t('menu.cart') || 'Cart' }}</h3>
            <UButton icon="lucide:x" size="sm" color="gray" variant="ghost" @click="isCartOpen = false" />
          </div>
        </template>
        <div v-if="cart.length" class="space-y-4">
          <div v-for="line in cart" :key="`${line.menuItemId}::${modifiersKey(line.modifiers)}`" class="flex items-center gap-3">
            <img v-if="line.imageUrl" :src="line.imageUrl" class="w-14 h-14 rounded-xl object-cover flex-shrink-0">
            <div v-else class="w-14 h-14 rounded-xl bg-gray-100 dark:bg-gray-800 flex-shrink-0 flex items-center justify-center">
              <Icon name="lucide:package" class="w-5 h-5 text-gray-300 dark:text-gray-700" />
            </div>
            <div class="min-w-0 flex-1">
              <div class="text-sm font-medium truncate">{{ line.name }}</div>
              <div v-if="line.modifiers?.length" class="text-xs text-gray-400 dark:text-gray-500 truncate">
                {{ line.modifiers.map((m) => m.name).join(', ') }}
              </div>
              <div class="text-xs" :style="{ color: secondaryColor }">{{ formatMoney(lineUnitPrice(line), data?.storefront.brandSettings?.currencyCode) }}</div>
            </div>
            <div class="flex items-center gap-1 bg-gray-50 dark:bg-gray-800 rounded-full p-1 flex-shrink-0">
              <button
                type="button"
                class="w-7 h-7 rounded-full flex items-center justify-center text-white active:scale-90 transition-transform"
                :style="{ backgroundColor: primaryColor, color: onPrimaryText }"
                @click="changeQuantity(line, -1)"
              >
                <Icon name="lucide:minus" class="w-3.5 h-3.5" />
              </button>
              <span class="w-6 text-center text-sm font-semibold tabular-nums">{{ line.quantity }}</span>
              <button
                type="button"
                class="w-7 h-7 rounded-full flex items-center justify-center text-white active:scale-90 transition-transform"
                :style="{ backgroundColor: primaryColor, color: onPrimaryText }"
                @click="changeQuantity(line, 1)"
              >
                <Icon name="lucide:plus" class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
        <div v-else class="text-center py-10">
          <Icon name="lucide:shopping-bag" class="w-9 h-9 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
          <p class="text-gray-700 dark:text-gray-300 text-sm font-medium">{{ t('menu.emptyCartTitle') || 'Your cart is empty' }}</p>
          <p class="text-gray-400 dark:text-gray-500 text-xs mt-1">{{ t('menu.emptyCartDesc') || 'Add something tasty from the menu.' }}</p>
          <UButton size="sm" :style="{ backgroundColor: primaryColor, color: onPrimaryText }" class="mt-4 border-0" @click="isCartOpen = false">
            {{ t('menu.browseMenu') || 'Browse menu' }}
          </UButton>
        </div>
        <template v-if="cart.length" #footer>
          <div class="flex items-center justify-between">
            <span class="font-semibold" :style="{ color: secondaryColor }">{{ formatMoney(cartTotal, data?.storefront.brandSettings?.currencyCode) }}</span>
            <UButton :style="{ backgroundColor: primaryColor, color: onPrimaryText }" class="border-0" @click="openCheckout">
              {{ t('menu.checkout') || 'Checkout' }}
            </UButton>
          </div>
        </template>
      </UCard>
    </USlideover>

    <!-- Checkout sheet -->
    <USlideover v-model="isCheckoutOpen" side="bottom" :ui="{ wrapper: 'sm:justify-center', base: 'sm:max-w-lg sm:mx-auto', height: 'max-h-[92vh]', rounded: 'rounded-t-2xl sm:rounded-2xl sm:mb-6' }" @update:model-value="(v: boolean) => { if (!v) closeCheckout(); }">
      <UCard :ui="{ ring: '', divide: 'divide-y divide-gray-100 dark:divide-gray-800', body: { base: 'flex-1 overflow-y-auto' } }" class="flex flex-col h-full">
        <template #header>
          <div class="mx-auto w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-700 mb-2" />
          <div class="flex items-center justify-between">
            <h3 v-if="orderResult" class="text-lg font-semibold">{{ t('menu.orderNumber') || 'Order' }} {{ smartOrderNumber(orderResult) }}</h3>
            <h3 v-else class="text-lg font-semibold">{{ t('menu.yourDetails') || 'Your details' }}</h3>
            <UButton icon="lucide:x" size="sm" color="gray" variant="ghost" @click="closeCheckout" />
          </div>
        </template>

        <div v-if="orderResult" class="text-center py-10">
          <div class="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center mx-auto mb-4">
            <Icon name="lucide:check" class="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('menu.orderReceived') || 'Order received!' }}</p>
          <p class="text-sm mt-1" :style="{ color: secondaryColor }">{{ t('menu.yourOrder') || 'Your order' }} {{ smartOrderNumber(orderResult) }}</p>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">{{ t('menu.orderReceivedDesc') || "We'll be in touch shortly to confirm the details." }}</p>

          <a
            :href="orderStatusHref(smartOrderNumber(orderResult), checkoutForm.phone)"
            target="_blank"
            rel="noopener"
            class="mt-6 flex items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-sm font-bold border-2 shadow-lg active:scale-[0.98] transition-transform"
            :style="{ backgroundColor: primaryColor, color: secondaryColor, borderColor: secondaryColor }"
          >
            <Icon name="lucide:receipt-text" class="w-4 h-4" />
            {{ t('menu.viewOrder') || 'View order' }}
            <Icon name="lucide:arrow-right" class="w-4 h-4" />
          </a>
        </div>

        <div v-else class="space-y-4">
          <div class="rounded-xl bg-gray-50 dark:bg-gray-800/60 p-3">
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {{ t('menu.orderSummary') || 'Order summary' }}
              </span>
              <button type="button" class="text-xs font-medium" :style="{ color: primaryColor }" @click="isCheckoutOpen = false; isCartOpen = true">
                {{ t('menu.editCart') || 'Edit' }}
              </button>
            </div>
            <div class="space-y-1 text-sm">
              <div v-for="line in cart" :key="`${line.menuItemId}::${modifiersKey(line.modifiers)}`" class="flex justify-between gap-2">
                <span class="text-gray-600 dark:text-gray-300 truncate">
                  {{ line.quantity }}× {{ line.name }}
                  <span v-if="line.modifiers?.length" class="text-gray-400 dark:text-gray-500">({{ line.modifiers.map((m) => m.name).join(', ') }})</span>
                </span>
                <span class="font-medium tabular-nums flex-shrink-0" :style="{ color: secondaryColor }">{{ formatMoney(line.quantity * lineUnitPrice(line), data?.storefront.brandSettings?.currencyCode) }}</span>
              </div>
            </div>
            <div class="flex justify-between pt-2 mt-2 border-t border-gray-200 dark:border-gray-700 text-sm font-semibold">
              <span>{{ t('menu.total') || 'Total' }}</span>
              <span class="tabular-nums" :style="{ color: secondaryColor }">{{ formatMoney(cartTotal, data?.storefront.brandSettings?.currencyCode) }}</span>
            </div>
          </div>

          <UFormGroup :label="t('menu.phone') || 'Phone'" required :error="!!(checkoutForm.phone && !isPhoneValid)">
            <UInput
              :model-value="checkoutForm.phone"
              type="tel"
              inputmode="tel"
              autocomplete="tel"
              pattern="[0-9+()\s-]*"
              size="lg"
              :placeholder="t('contacts.enterPhone') || '+7 700 123 45 67'"
              @update:model-value="updatePhoneValue"
            />
          </UFormGroup>

          <div v-if="myPastOrders.length" class="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 space-y-2">
            <span class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {{ t('menu.previousOrders') || 'Previous orders' }}
            </span>
            <div class="space-y-1.5">
              <div v-for="o in visiblePastOrders" :key="o.id" class="flex items-center justify-between text-sm">
                <span class="text-gray-600 dark:text-gray-300 truncate">
                  <span class="font-mono tabular-nums">{{ smartOrderNumber(o) }}</span>
                </span>
                <span class="font-medium tabular-nums flex-shrink-0" :style="{ color: secondaryColor }">
                  {{ formatMoney(o.totalAmount, data?.storefront.brandSettings?.currencyCode) }}
                </span>
              </div>
            </div>
            <button
              v-if="myPastOrders.length > MY_PAST_ORDERS_COLLAPSED_COUNT"
              type="button"
              class="text-xs font-medium pt-0.5"
              :style="{ color: secondaryColor }"
              @click="myPastOrdersExpanded = !myPastOrdersExpanded"
            >
              {{ myPastOrdersExpanded
                ? (t('menu.showLess') || 'Show less')
                : (t('menu.showMoreOrders', { count: myPastOrders.length - MY_PAST_ORDERS_COLLAPSED_COUNT }) || `Show ${myPastOrders.length - MY_PAST_ORDERS_COLLAPSED_COUNT} more`) }}
            </button>
          </div>

          <UFormGroup :label="t('menu.yourName') || 'Your name'">
            <UInput v-model="checkoutForm.customerName" autocomplete="name" size="lg" />
          </UFormGroup>
          <div class="flex gap-2">
            <UButton
              size="sm"
              :variant="checkoutForm.type === 'delivery' ? 'solid' : 'soft'"
              color="gray"
              @click="checkoutForm.type = 'delivery'"
            >
              {{ t('menu.delivery') || 'Delivery' }}
            </UButton>
            <UButton
              size="sm"
              :variant="checkoutForm.type === 'pickup' ? 'solid' : 'soft'"
              color="gray"
              @click="checkoutForm.type = 'pickup'"
            >
              {{ t('menu.pickup') || 'Pickup' }}
            </UButton>
          </div>
          <template v-if="checkoutForm.type === 'delivery'">
            <UFormGroup :label="t('menu.address') || 'Delivery address'" required>
              <UInput v-model="checkoutForm.deliveryAddress" autocomplete="street-address" size="lg" />
            </UFormGroup>
            <p class="text-xs text-gray-400 -mt-2">{{ t('menu.deliveryFeeNote') || 'Delivery fee is calculated separately and not included in the order total.' }}</p>
          </template>
          <UFormGroup v-else-if="activeBranch" :label="t('menu.pickupFrom') || 'Pickup from'">
            <div class="text-sm text-gray-600 dark:text-gray-400 mb-2">{{ activeBranch.name }} — {{ activeBranch.address }}</div>
            <div v-if="activeBranch.lat && activeBranch.lng" class="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 h-40 mb-2">
              <iframe :src="osmEmbedSrc(activeBranch.lat, activeBranch.lng)" class="w-full h-full border-0" loading="lazy" title="Branch location" />
            </div>
            <UButton size="sm" color="gray" variant="soft" icon="lucide:map" :to="twoGisSearchHref(activeBranch.address)" target="_blank">
              {{ t('menu.openIn2gis') || 'Open in 2GIS' }}
            </UButton>
          </UFormGroup>
          <UFormGroup :label="t('menu.when') || 'When'">
            <div class="flex gap-2">
              <UButton size="sm" :variant="!checkoutForm.scheduled ? 'solid' : 'soft'" color="gray" @click="checkoutForm.scheduled = false">
                {{ t('menu.asap') || 'As soon as possible' }}
              </UButton>
              <UButton size="sm" :variant="checkoutForm.scheduled ? 'solid' : 'soft'" color="gray" @click="checkoutForm.scheduled = true">
                {{ t('menu.scheduleForLater') || 'Schedule for later' }}
              </UButton>
            </div>
            <div v-if="checkoutForm.scheduled" class="mt-2 space-y-2">
              <div class="flex gap-2">
                <UInput v-model="checkoutForm.scheduledDate" type="date" :min="todayDateInputValue" size="lg" class="flex-1" />
                <UInput v-model="checkoutForm.scheduledTime" type="time" size="lg" class="flex-1" />
              </div>
              <p v-if="scheduledWindowLabel" class="text-xs text-gray-500 dark:text-gray-400">
                {{ t('menu.scheduledWindowHint') || 'We\'ll aim to have it ready between' }} {{ scheduledWindowLabel }}
              </p>
            </div>
          </UFormGroup>
          <UFormGroup :label="t('menu.comment') || 'Comment'">
            <UTextarea v-model="checkoutForm.comment" :rows="2" />
          </UFormGroup>
        </div>

        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton v-if="!orderResult" color="gray" variant="ghost" @click="closeCheckout">
              {{ t('app.cancel') }}
            </UButton>
            <UButton
              v-if="!orderResult"
              :style="{ backgroundColor: primaryColor, color: onPrimaryText }"
              class="border-0"
              :loading="submitting"
              :disabled="!isCheckoutValid || submitting"
              @click="submitOrder"
            >
              {{ t('menu.placeOrder') || 'Place order' }}
            </UButton>
            <UButton v-else color="gray" variant="ghost" @click="closeCheckout">
              {{ t('menu.orderConfirmClose') || 'Great!' }}
            </UButton>
          </div>
        </template>
      </UCard>
    </USlideover>
  </div>
</template>
