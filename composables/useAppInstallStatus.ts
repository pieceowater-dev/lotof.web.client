import { reactive } from 'vue';
import { ALL_APPS, type AppConfig } from '@/config/apps';
import { CookieKeys } from '@/utils/storageKeys';

// Module-level (not per-component instance) so every consumer -- the home
// page dashboard tiles, the header nav, the deep-link handler -- reads and
// writes the SAME install-status map instead of each keeping its own copy
// that can drift out of sync with the others.
const appInstalled: Record<string, boolean> = reactive({});
let checkSeq = 0;

/**
 * Where clicking into `app` from `ns` should go: straight into the app if
 * it's installed for this namespace, otherwise its plan-selection page (with
 * a returnTo back to the app). This is the ONE place that decision is made --
 * every nav entry point (dashboard cards, header buttons, deep links) must
 * route through this so a user can never be sent into an app they haven't
 * subscribed to yet.
 */
function appRoutePath(app: AppConfig, ns: string): string {
  return app.address === 'atrace' ? `/${ns}/atrace/attendance/all` : `/${ns}/${app.address}`;
}

function resolveAppDestination(app: AppConfig, ns: string): string {
  if (appInstalled[app.bundle]) {
    return appRoutePath(app, ns);
  }
  const target = `/${ns}/${app.address}`;
  return `/${ns}/${app.address}/plans?returnTo=${encodeURIComponent(target)}`;
}

/**
 * Refreshes appInstalled for every known app bundle in namespace `ns`.
 * Safe to call repeatedly (e.g. on every namespace switch, or right after a
 * subscribe) -- a sequence guard drops stale responses if calls overlap.
 */
async function ensureAppInstallStatus(ns: string): Promise<void> {
  // Client-only: this feeds header/dashboard UI gating, not the initial SSR
  // render, and firing it from AppHeader's immediate watcher during SSR races
  // the request's Nuxt instance being torn down once the response is sent --
  // the async work here resumes after that point and throws "[nuxt] instance
  // unavailable" (an unhandled rejection on the server, seen intermittently
  // in prod logs for any logged-in visitor on a namespaced page).
  if (process.server) return;
  if (!ns) return;
  const token = useCookie<string | null>(CookieKeys.TOKEN, { path: '/' }).value;
  if (!token) return;

  const seq = ++checkSeq;
  const { hubAreAppsInNamespace } = await import('@/api/hub/namespaces/isAppInNamespace');
  const bundles = ALL_APPS.map(a => a.bundle);
  const installedMap = await hubAreAppsInNamespace(token, ns, bundles);
  if (seq !== checkSeq) return; // superseded by a newer check
  for (const b of bundles) appInstalled[b] = !!installedMap[b];
}

export function useAppInstallStatus() {
  return { appInstalled, appRoutePath, resolveAppDestination, ensureAppInstallStatus };
}
