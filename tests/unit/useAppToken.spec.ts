// createAppTokenComposable is the shared factory behind 6 products' token
// composables (useAtraceToken/useMenuToken/useTasksToken/useGoodsToken/
// usePlansToken/useContactsToken) -- the highest-leverage composable in the
// app after useAppPlansPage: every authenticated API call to any of those 6
// services goes through the token this returns, so a regression here is
// not scoped to one product at all.
//
// useCookie is stubbed as a tiny shared in-memory store (not per-call
// isolated) so that reading it at the top of ensureInner() and writing it
// again later in the same call both see the same conceptual cookie, exactly
// like the real Nuxt composable backed by document.cookie. localStorage is
// real (jsdom provides it) and cleared between tests.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAppTokenComposable, type AppTokenConfig } from '@/composables/useAppToken';

vi.mock('@/utils/logger', () => ({ logError: vi.fn() }));

const cookieStore = new Map<string, string | null>();
function fakeUseCookie(key: string) {
  return {
    get value() { return cookieStore.get(key) ?? null; },
    set value(v: string | null) { cookieStore.set(key, v); },
  };
}

beforeEach(() => {
  cookieStore.clear();
  localStorage.clear();
  vi.stubGlobal('useCookie', fakeUseCookie);
  // ensureInner() calls useNuxtApp() once (synchronously, before any await)
  // and reuses its runWithContext() to re-enter Nuxt's SSR instance context
  // after each dynamic import()/sleep() -- both real risk points for losing
  // it during actual SSR (see the comment in useAppToken.ts). Outside a real
  // Nuxt app there's no context to preserve, so just running the callback
  // immediately is the correct fake here.
  vi.stubGlobal('useNuxtApp', () => ({ runWithContext: (fn: () => unknown) => fn() }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function makeConfig(overrides: Partial<AppTokenConfig> = {}) {
  const setAppToken = vi.fn();
  const exchange = vi.fn().mockResolvedValue('fresh-token');
  const config: AppTokenConfig = {
    cookieKey: 'test_token',
    tsKey: 'test_token_ts',
    nsKey: 'test_token_ns',
    storageProbeKey: 'test_probe',
    ttlMs: 60_000,
    label: 'test',
    getSetAppToken: vi.fn().mockResolvedValue(setAppToken),
    getExchangeFn: vi.fn().mockResolvedValue(exchange),
    ...overrides,
  };
  return { config, setAppToken, exchange };
}

describe('useAppToken: fast path', () => {
  it('returns the cookie value without exchanging when the token is fresh', async () => {
    const { config, exchange } = makeConfig();
    cookieStore.set(config.cookieKey, 'cached-token');
    localStorage.setItem(config.tsKey, String(Date.now())); // fresh timestamp
    // Must also match the tracked namespace -- otherwise ensureInner's
    // "cookie + hubToken + nsSlug but no recorded namespace" heuristic
    // (shouldForceByNs) treats it as an unverified token and forces a
    // refresh anyway, regardless of how fresh the timestamp is.
    localStorage.setItem(config.nsKey, 'acme');
    const { ensure } = createAppTokenComposable(config)();

    const token = await ensure('acme', 'hub-token');

    expect(token).toBe('cached-token');
    expect(exchange).not.toHaveBeenCalled();
  });

  it('returns the cookie value without exchanging when there is no hub token to force a refresh with', async () => {
    const { config, exchange } = makeConfig();
    cookieStore.set(config.cookieKey, 'cached-token');
    // No timestamp at all -> would normally force a refresh, but there's no
    // hubToken to refresh with, so the stale cookie is still the best we have.
    const { ensure } = createAppTokenComposable(config)();

    const token = await ensure('acme', null);

    expect(token).toBe('cached-token');
    expect(exchange).not.toHaveBeenCalled();
  });

  it('force-refreshes when the cached token is past its TTL and a hub token is available', async () => {
    const { config, exchange } = makeConfig();
    cookieStore.set(config.cookieKey, 'stale-token');
    localStorage.setItem(config.tsKey, String(Date.now() - 999_999_999)); // ancient
    const { ensure } = createAppTokenComposable(config)();

    const token = await ensure('acme', 'hub-token');

    expect(token).toBe('fresh-token');
    expect(exchange).toHaveBeenCalledWith('hub-token', 'acme');
  });
});

describe('useAppToken: exchange + dedup', () => {
  it('exchanges for a new token when there is no cookie yet, and persists it', async () => {
    const { config, exchange, setAppToken } = makeConfig();
    const { ensure, current } = createAppTokenComposable(config)();

    const token = await ensure('acme', 'hub-token');

    expect(token).toBe('fresh-token');
    expect(exchange).toHaveBeenCalledTimes(1);
    expect(setAppToken).toHaveBeenCalledWith('fresh-token');
    expect(current()).toBe('fresh-token');
    expect(localStorage.getItem(config.tsKey)).toBeTruthy();
  });

  it('collapses concurrent ensure() calls for the same namespace into a single exchange', async () => {
    const { config, exchange } = makeConfig();
    const { ensure } = createAppTokenComposable(config)();

    const [a, b, c] = await Promise.all([
      ensure('acme', 'hub-token'),
      ensure('acme', 'hub-token'),
      ensure('acme', 'hub-token'),
    ]);

    expect(exchange).toHaveBeenCalledTimes(1);
    expect(a).toBe('fresh-token');
    expect(b).toBe('fresh-token');
    expect(c).toBe('fresh-token');
  });

  it('does not dedupe across different namespaces', async () => {
    const { config, exchange } = makeConfig();
    const { ensure } = createAppTokenComposable(config)();

    await Promise.all([ensure('acme', 'hub-token'), ensure('other-ns', 'hub-token')]);

    expect(exchange).toHaveBeenCalledTimes(2);
    expect(exchange).toHaveBeenCalledWith('hub-token', 'acme');
    expect(exchange).toHaveBeenCalledWith('hub-token', 'other-ns');
  });

  it('allows a fresh ensure() after the previous one for that namespace has settled', async () => {
    const { config, exchange } = makeConfig();
    const { ensure } = createAppTokenComposable(config)();

    await ensure('acme', 'hub-token');
    await ensure('acme', 'hub-token'); // cookie now set from the first call -> fast path

    // Only the first call actually exchanged; the second hit the fresh-cookie
    // fast path, same as any real second call moments later would.
    expect(exchange).toHaveBeenCalledTimes(1);
  });
});

describe('useAppToken: namespace mismatch', () => {
  it('clears the stored token when switching to a namespace different from the one it was issued for', async () => {
    const { config, exchange, setAppToken } = makeConfig();
    cookieStore.set(config.cookieKey, 'old-namespace-token');
    localStorage.setItem(config.nsKey, 'old-ns');
    const { ensure } = createAppTokenComposable(config)();

    const token = await ensure('new-ns', 'hub-token');

    // The stale token gets cleared (in-memory cleared via setAppToken(null))
    // before the fresh exchange's setAppToken('fresh-token') call.
    expect(setAppToken.mock.calls[0]).toEqual([null]);
    expect(exchange).toHaveBeenCalledWith('hub-token', 'new-ns');
    expect(token).toBe('fresh-token');
    expect(localStorage.getItem(config.nsKey)).toBe('new-ns');
  });
});

describe('useAppToken: retry semantics', () => {
  it('retries a transient exchange failure and succeeds once the backend recovers', async () => {
    vi.useFakeTimers();
    const exchange = vi.fn()
      .mockRejectedValueOnce(new Error('unavailable'))
      .mockRejectedValueOnce(new Error('unavailable'))
      .mockResolvedValueOnce('fresh-token');
    const { config } = makeConfig({ getExchangeFn: vi.fn().mockResolvedValue(exchange) });
    const { ensure } = createAppTokenComposable(config)();

    const promise = ensure('acme', 'hub-token');
    // "unavailable" backs off exponentially (1000ms, 2000ms, ...) -- fast-
    // forward well past both gaps.
    await vi.advanceTimersByTimeAsync(10_000);
    const token = await promise;

    expect(token).toBe('fresh-token');
    expect(exchange).toHaveBeenCalledTimes(3);
  });

  it('keeps retrying through a "not a member of namespace"-style message rather than bailing early', async () => {
    // Real-world regression this guards: hub-gtw's HPA flapping caused
    // AmIMemberOfNamespace to transiently answer false for confirmed,
    // permanent owners. An early bail on this message class would have
    // logged the owner out; retrying through it is what actually recovers.
    vi.useFakeTimers();
    const exchange = vi.fn()
      .mockRejectedValueOnce(new Error('not a member of the namespace'))
      .mockResolvedValueOnce('fresh-token');
    const { config } = makeConfig({ getExchangeFn: vi.fn().mockResolvedValue(exchange) });
    const { ensure } = createAppTokenComposable(config)();

    const promise = ensure('acme', 'hub-token');
    await vi.advanceTimersByTimeAsync(2_000);
    const token = await promise;

    expect(token).toBe('fresh-token');
    expect(exchange).toHaveBeenCalledTimes(2);
  });

  it('resolves to null (not a rejected promise) once every attempt is exhausted', async () => {
    vi.useFakeTimers();
    const exchange = vi.fn().mockRejectedValue(new Error('permanently broken'));
    const { config } = makeConfig({ getExchangeFn: vi.fn().mockResolvedValue(exchange) });
    const { ensure } = createAppTokenComposable(config)();

    const promise = ensure('acme', 'hub-token');
    await vi.advanceTimersByTimeAsync(60_000);
    const token = await promise;

    expect(token).toBeNull();
    expect(exchange).toHaveBeenCalledTimes(6); // maxAttempts
  });
});

describe('useAppToken: clear()', () => {
  it('removes the cookie and localStorage bookkeeping, and clears the in-memory token', () => {
    const { config, setAppToken } = makeConfig();
    cookieStore.set(config.cookieKey, 'some-token');
    localStorage.setItem(config.tsKey, '123');
    localStorage.setItem(config.nsKey, 'acme');
    const { clear, current } = createAppTokenComposable(config)();

    clear();

    expect(current()).toBeNull();
    expect(localStorage.getItem(config.tsKey)).toBeNull();
    expect(localStorage.getItem(config.nsKey)).toBeNull();
    // clearInMemoryToken() resolves getSetAppToken() asynchronously; give
    // its microtask a tick before asserting.
    return Promise.resolve().then(() => {
      expect(setAppToken).toHaveBeenCalledWith(null);
    });
  });
});
