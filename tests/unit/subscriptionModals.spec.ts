// useContactUsModal and useDowngradeBlockedModal are the two paywall-adjacent
// modals useAppPlansPage.spec.ts already mocks out -- this covers what those
// mocks stood in for, plus parseDowngradeRegressions/featureLabelKey, which
// were untested pure logic parsing a real backend error format.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  featureLabelKey,
  parseDowngradeRegressions,
  useDowngradeBlockedModal,
} from '@/composables/useDowngradeBlockedModal';
import { useContactUsModal } from '@/composables/useContactUsModal';

// useState stub: same key -> same backing object across calls, matching
// Nuxt's per-request/per-tab singleton semantics closely enough to test
// these composables' own logic (open/close/shared-state), without needing
// Vue's real reactivity system since nothing here is mounted as a component.
const stateStore = new Map<string, { value: unknown }>();
function fakeUseState<T>(key: string, init: () => T) {
  if (!stateStore.has(key)) stateStore.set(key, { value: init() });
  return stateStore.get(key)!;
}

const track = vi.fn();

beforeEach(() => {
  stateStore.clear();
  track.mockClear();
  vi.stubGlobal('useState', fakeUseState);
  vi.stubGlobal('useAnalytics', () => ({ track }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('parseDowngradeRegressions', () => {
  it('parses the real backend error format into structured rows', () => {
    const msg = 'downgrade not allowed: new plan lowers limits the current plan already allows (max_badges: 30 -> 10, max_branches: 5 -> 1). Choose a plan...';
    expect(parseDowngradeRegressions(msg)).toEqual([
      { key: 'max_badges', from: 30, to: 10 },
      { key: 'max_branches', from: 5, to: 1 },
    ]);
  });

  it('parses a single regression', () => {
    const msg = 'downgrade not allowed: ... (max_employees: 50 -> 20). Choose a plan';
    expect(parseDowngradeRegressions(msg)).toEqual([{ key: 'max_employees', from: 50, to: 20 }]);
  });

  it('returns null for a message that is not a downgrade error at all', () => {
    expect(parseDowngradeRegressions('some other error')).toBeNull();
    expect(parseDowngradeRegressions('Not authenticated')).toBeNull();
  });

  it('returns null when the message matches the prefix but has no parenthesized list', () => {
    expect(parseDowngradeRegressions('downgrade not allowed: no details')).toBeNull();
  });

  it('returns null when the parenthesized content has no parseable rows', () => {
    expect(parseDowngradeRegressions('downgrade not allowed: (nonsense here)')).toBeNull();
  });

  it('skips malformed entries but keeps the well-formed ones in a mixed list', () => {
    const msg = 'downgrade not allowed: (max_badges: 30 -> 10, garbage, max_branches: 5 -> 1)';
    expect(parseDowngradeRegressions(msg)).toEqual([
      { key: 'max_badges', from: 30, to: 10 },
      { key: 'max_branches', from: 5, to: 1 },
    ]);
  });
});

describe('featureLabelKey', () => {
  it('maps a known feature key to its i18n label key', () => {
    expect(featureLabelKey('max_employees')).toBe('app.limitEmployees');
    expect(featureLabelKey('max_badges')).toBe('app.limitBadges');
  });

  it('falls back to the raw key for an unmapped feature', () => {
    expect(featureLabelKey('max_something_new')).toBe('max_something_new');
  });
});

describe('useDowngradeBlockedModal', () => {
  it('open() sets the regressions and opens the modal', () => {
    const { isOpen, regressions, open } = useDowngradeBlockedModal();
    expect(isOpen.value).toBe(false);

    open([{ key: 'max_badges', from: 30, to: 10 }]);

    expect(isOpen.value).toBe(true);
    expect(regressions.value).toEqual([{ key: 'max_badges', from: 30, to: 10 }]);
  });

  it('close() closes the modal without clearing the regressions (they stay until the next open())', () => {
    const { isOpen, regressions, open, close } = useDowngradeBlockedModal();
    open([{ key: 'max_badges', from: 30, to: 10 }]);

    close();

    expect(isOpen.value).toBe(false);
    expect(regressions.value).toEqual([{ key: 'max_badges', from: 30, to: 10 }]);
  });

  it('shares state across separate calls to the composable (one modal instance, many callers)', () => {
    const a = useDowngradeBlockedModal();
    a.open([{ key: 'max_employees', from: 50, to: 20 }]);

    const b = useDowngradeBlockedModal();
    expect(b.isOpen.value).toBe(true);
    expect(b.regressions.value).toEqual([{ key: 'max_employees', from: 50, to: 20 }]);
  });
});

describe('useContactUsModal', () => {
  it('open() sets the context, opens the modal, and tracks the paywall event', () => {
    const { isOpen, context, open } = useContactUsModal();

    open({ app: 'pieceowater.issues', planName: 'Pro' });

    expect(isOpen.value).toBe(true);
    expect(context.value).toEqual({ app: 'pieceowater.issues', planName: 'Pro' });
    expect(track).toHaveBeenCalledWith('contact_us_paywall_shown', { app: 'pieceowater.issues', plan: 'Pro' });
  });

  it('open() with no context still opens the modal, with a null context', () => {
    const { isOpen, context, open } = useContactUsModal();

    open();

    expect(isOpen.value).toBe(true);
    expect(context.value).toBeNull();
  });

  it('close() closes the modal', () => {
    const { isOpen, open, close } = useContactUsModal();
    open({ app: 'x' });

    close();

    expect(isOpen.value).toBe(false);
  });

  it('still opens the modal even if analytics tracking throws', () => {
    vi.stubGlobal('useAnalytics', () => ({
      track: () => { throw new Error('amplitude not initialized'); },
    }));
    const { isOpen, open } = useContactUsModal();

    expect(() => open({ app: 'x' })).not.toThrow();
    expect(isOpen.value).toBe(true);
  });
});
