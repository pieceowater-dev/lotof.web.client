// Generic "refresh data if the tab was idle/backgrounded for a while" helper.
// Tracks a last-active timestamp in localStorage and re-runs a callback when
// the page regains focus/visibility after being idle longer than maxIdleMs.
export interface UseStaleRefreshOptions {
  /** localStorage key used to persist the last-active timestamp. */
  storageKey: string;
  /** How long the tab may be idle before the next focus/visibility triggers onStale. */
  maxIdleMs: number;
  /** Called when the idle threshold was exceeded. */
  onStale: () => void | Promise<void>;
}

export function useStaleRefresh(options: UseStaleRefreshOptions) {
  function setLastActiveNow() {
    if (!process.client) return;
    try { localStorage.setItem(options.storageKey, String(Date.now())); } catch {}
  }

  function getLastActiveTs(): number | null {
    if (!process.client) return null;
    try {
      const raw = localStorage.getItem(options.storageKey);
      const ts = raw ? Number(raw) : NaN;
      return Number.isFinite(ts) ? ts : null;
    } catch {
      return null;
    }
  }

  async function refreshIfStale() {
    if (!process.client) return;
    const last = getLastActiveTs();
    const now = Date.now();
    if (last && now - last > options.maxIdleMs) {
      await options.onStale();
    }
    setLastActiveNow();
  }

  function start() {
    if (!process.client) return;
    setLastActiveNow();
    document.addEventListener('visibilitychange', refreshIfStale);
    window.addEventListener('focus', refreshIfStale);
  }

  function stop() {
    if (!process.client) return;
    document.removeEventListener('visibilitychange', refreshIfStale);
    window.removeEventListener('focus', refreshIfStale);
  }

  return { start, stop, refreshIfStale };
}
