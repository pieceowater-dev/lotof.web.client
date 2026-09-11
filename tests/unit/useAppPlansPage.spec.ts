// useAppPlansPage owns the whole plan-picker flow shared by 5 products
// (FRONTEND_AUDIT.md C3 / M1) -- a regression here breaks all 5 at once, so
// this is the highest-leverage composable to cover.
//
// It's wired into Nuxt's auto-imports (useRouter/useRoute/useToast/useHead/
// useCookie/navigateTo/useAnalytics) rather than explicit imports, so
// there's no Nuxt runtime here to provide them -- they're stubbed as
// globals. The three sibling composables it *does* import explicitly
// (usePhoneGate/useContactUsModal/useDowngradeBlockedModal) are themselves
// wired into Nuxt state, so they're module-mocked rather than pulled in for
// real. Everything else (getErrorMessage, isSafeRelativePath, the
// composable's own formatting/branching logic) runs for real.
import { defineComponent } from 'vue';
import { mount, flushPromises } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppPlansPage, type AppPlan, type AppPlansPageConfig, type AppSubscription } from '@/composables/useAppPlansPage';

const h = vi.hoisted(() => ({
  requirePhone: vi.fn().mockResolvedValue(true),
  contactUsOpen: vi.fn(),
  downgradeOpen: vi.fn(),
  parseDowngradeRegressions: vi.fn().mockReturnValue(null),
  addAppToNamespace: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/composables/useI18n', () => ({
  // t(key) || 'fallback' is the pattern used throughout the app (and this
  // file) -- returning '' for every key exercises exactly that fallback
  // path, same as a real locale miss would.
  useI18n: () => ({ t: () => '' }),
}));
vi.mock('@/composables/usePhoneGate', () => ({
  usePhoneGate: () => ({ requirePhone: h.requirePhone }),
}));
vi.mock('@/composables/useContactUsModal', () => ({
  useContactUsModal: () => ({ open: h.contactUsOpen }),
}));
vi.mock('@/composables/useDowngradeBlockedModal', () => ({
  useDowngradeBlockedModal: () => ({ open: h.downgradeOpen }),
  parseDowngradeRegressions: h.parseDowngradeRegressions,
}));
vi.mock('@/api/hub/namespaces/addAppToNamespace', () => ({
  hubAddAppToNamespace: h.addAppToNamespace,
}));

let cookieValue: string | null = 'hub-token-123';
let routeQuery: Record<string, unknown> = {};
const navigateTo = vi.fn();
const toastAdd = vi.fn();
const routerBack = vi.fn();

beforeEach(() => {
  cookieValue = 'hub-token-123';
  routeQuery = {};
  vi.stubGlobal('useRouter', () => ({ back: routerBack }));
  vi.stubGlobal('useRoute', () => ({
    params: { namespace: 'acme' },
    query: routeQuery,
    path: '/acme/issues/plans',
  }));
  vi.stubGlobal('useToast', () => ({ add: toastAdd }));
  vi.stubGlobal('useHead', () => {});
  vi.stubGlobal('useCookie', () => ({ value: cookieValue }));
  vi.stubGlobal('navigateTo', navigateTo);
  vi.stubGlobal('useAnalytics', () => ({ track: vi.fn() }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function makePlan(overrides: Partial<AppPlan> = {}): AppPlan {
  return {
    id: 'plan-1',
    code: 'start',
    name: 'Start',
    currency: 'KZT',
    interval: 'MONTH',
    amountCents: 0,
    trialDays: 0,
    ...overrides,
  };
}

function makeConfig(overrides: Partial<AppPlansPageConfig> = {}): AppPlansPageConfig {
  return {
    appBundle: 'pieceowater.issues',
    appKey: 'issues',
    title: 'Plans',
    token: { ensure: vi.fn().mockResolvedValue('app-token'), current: vi.fn().mockReturnValue('app-token') },
    loadPlans: vi.fn().mockResolvedValue({ plans: [] }),
    loadActiveSubscription: vi.fn().mockResolvedValue(null),
    subscribe: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

// Mounts a bare host component so onMounted/watch inside the composable get
// a real component instance, and exposes the composable's return value on
// wrapper.vm for assertions.
function mountPage(config: AppPlansPageConfig) {
  const Host = defineComponent({
    setup() {
      return useAppPlansPage(config);
    },
    template: '<div />',
  });
  return mount(Host);
}

describe('useAppPlansPage: load on mount', () => {
  it('loads plans and active subscription, syncs the interval to the active plan', async () => {
    const yearlyActive = makePlan({ id: 'p-year', code: 'pro', interval: 'YEAR' });
    const config = makeConfig({
      loadPlans: vi.fn().mockResolvedValue({ plans: [makePlan(), yearlyActive] }),
      loadActiveSubscription: vi.fn().mockResolvedValue({ planId: 'p-year', planCode: 'pro' } as AppSubscription),
    });
    const wrapper = mountPage(config);
    await flushPromises();

    expect(wrapper.vm.plans).toHaveLength(2);
    expect(wrapper.vm.loading).toBe(false);
    expect(wrapper.vm.isPlanActive(yearlyActive)).toBe(true);
    expect(wrapper.vm.isPlanActive(makePlan({ id: 'other', code: 'other' }))).toBe(false);
    // The active plan is yearly -- selectedInterval must follow it, not stay
    // on the 'monthly' default, so the grid opens showing the tier the
    // namespace is actually on.
    expect(wrapper.vm.selectedInterval).toBe('yearly');
  });

  it('sets a not-authenticated error and never calls loadPlans when there is no hub token', async () => {
    cookieValue = null;
    const config = makeConfig();
    const wrapper = mountPage(config);
    await flushPromises();

    expect(wrapper.vm.error).toBeTruthy();
    expect(config.loadPlans).not.toHaveBeenCalled();
  });

  it('surfaces a real fetchPlans failure as a visible error instead of swallowing it', async () => {
    const config = makeConfig({ loadPlans: vi.fn().mockRejectedValue(new Error('boom')) });
    const wrapper = mountPage(config);
    await flushPromises();

    expect(wrapper.vm.error).toBe('boom');
    expect(wrapper.vm.loading).toBe(false);
  });

  it('auto-provisions the free plan when nothing is subscribed yet', async () => {
    const free = makePlan({ id: 'p-free', code: 'free', amountCents: 0 });
    const config = makeConfig({
      loadPlans: vi.fn().mockResolvedValue({ plans: [free] }),
      loadActiveSubscription: vi.fn().mockResolvedValue(null),
    });
    mountPage(config);
    await flushPromises();

    expect(config.subscribe).toHaveBeenCalledWith(
      expect.objectContaining({ nsSlug: 'acme', planCode: 'free' }),
    );
  });

  it('does not auto-provision when the active-subscription fetch merely failed', async () => {
    // subscriptionFetchFailed must gate this -- a transient error fetching
    // the current subscription must never look like "confirmed nothing
    // active" and silently re-provision/downgrade a paying namespace.
    const free = makePlan({ id: 'p-free', code: 'free', amountCents: 0 });
    const config = makeConfig({
      loadPlans: vi.fn().mockResolvedValue({ plans: [free] }),
      loadActiveSubscription: vi.fn().mockRejectedValue(new Error('network blip')),
    });
    mountPage(config);
    await flushPromises();

    expect(config.subscribe).not.toHaveBeenCalled();
  });
});

describe('useAppPlansPage: formatPrice', () => {
  it('formats KZT with the tenge sign', () => {
    const wrapper = mountPage(makeConfig());
    expect(wrapper.vm.formatPrice(150000, 'KZT')).toBe('1 500₸');
  });

  it('formats other currencies as "<code> <amount>"', () => {
    const wrapper = mountPage(makeConfig());
    expect(wrapper.vm.formatPrice(999900, 'USD')).toBe('USD 9,999');
  });
});

describe('useAppPlansPage: subscribePlan branching', () => {
  it('routes to Contact Us instead of subscribing when the trial is already used on a paid plan', async () => {
    const paidPlan = makePlan({ code: 'pro', amountCents: 500000, trialDays: 14 });
    const config = makeConfig({
      loadActiveSubscription: vi.fn().mockResolvedValue({ planId: 'plan-1', status: 'EXPIRED' } as AppSubscription),
    });
    const wrapper = mountPage(config);
    await flushPromises();

    await wrapper.vm.subscribePlan(paidPlan);

    expect(h.contactUsOpen).toHaveBeenCalledWith({ app: 'pieceowater.issues', planName: 'Start' });
    expect(config.subscribe).not.toHaveBeenCalled();
  });

  it('subscribes directly to a paid plan that still has an unused trial', async () => {
    const paidPlan = makePlan({ code: 'pro', amountCents: 500000, trialDays: 14 });
    const config = makeConfig();
    const wrapper = mountPage(config);
    await flushPromises();

    await wrapper.vm.subscribePlan(paidPlan);

    expect(h.contactUsOpen).not.toHaveBeenCalled();
    expect(config.subscribe).toHaveBeenCalledWith(
      expect.objectContaining({ nsSlug: 'acme', planCode: 'pro', appToken: 'app-token' }),
    );
  });

  it('never calls subscribe when the phone gate blocks', async () => {
    h.requirePhone.mockResolvedValueOnce(false);
    const config = makeConfig();
    const wrapper = mountPage(config);
    await flushPromises();

    await wrapper.vm.subscribePlan(makePlan());

    expect(config.subscribe).not.toHaveBeenCalled();
  });

  it('on success: installs the app, tracks it as active, and navigates to returnTo', async () => {
    routeQuery = { returnTo: '/acme/issues/board' };
    const config = makeConfig({
      subscribe: vi.fn().mockResolvedValue({ planId: 'plan-1', status: 'ACTIVE' } as AppSubscription),
    });
    const wrapper = mountPage(config);
    await flushPromises();

    await wrapper.vm.subscribePlan(makePlan());

    expect(h.addAppToNamespace).toHaveBeenCalledWith('hub-token-123', 'acme', 'pieceowater.issues');
    expect(navigateTo).toHaveBeenCalledWith('/acme/issues/board', { replace: true });
    expect(wrapper.vm.activeSubscription).toEqual({ planId: 'plan-1', status: 'ACTIVE' });
  });

  it('ignores "already installed" from addAppToNamespace instead of surfacing it as a subscribe failure', async () => {
    h.addAppToNamespace.mockRejectedValueOnce(new Error('app already exists in namespace'));
    const config = makeConfig();
    const wrapper = mountPage(config);
    await flushPromises();

    await wrapper.vm.subscribePlan(makePlan());

    expect(toastAdd).not.toHaveBeenCalledWith(expect.objectContaining({ color: 'red' }));
  });

  it('rejects an unsafe returnTo (open-redirect guard) and falls back to the app default', async () => {
    routeQuery = { returnTo: '//evil.example/phish' };
    const config = makeConfig({
      subscribe: vi.fn().mockResolvedValue({ planId: 'plan-1' } as AppSubscription),
    });
    const wrapper = mountPage(config);
    await flushPromises();

    await wrapper.vm.subscribePlan(makePlan());

    expect(navigateTo).toHaveBeenCalledWith('/acme/issues', { replace: true });
  });
});
