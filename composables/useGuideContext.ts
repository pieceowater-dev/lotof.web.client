import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from '@/composables/useI18n';
import { ALL_APPS } from '@/config/apps';
import { atraceTour, contactsTour, issuesTour, menuTour } from '@/config/tours';
import type { TourConfig } from '@/composables/useOnboarding';
import type { GuideApp } from '@/api/guide/public';

export type GuideAppId = 'issues' | 'menu' | 'contacts' | 'atrace';

const APP_TOURS: Record<GuideAppId, TourConfig> = {
  atrace: atraceTour,
  menu: menuTour,
  issues: issuesTour,
  contacts: contactsTour,
};

export const GUIDE_APP_IDS: GuideAppId[] = ['issues', 'menu', 'contacts', 'atrace'];

const ALL_GUIDE_APPS: GuideApp[] = ['GLOBAL', 'LANDING', 'ISSUES', 'MENU', 'CONTACTS', 'ATRACE'];

/** Route param ("issues") -> GuideApp ("ISSUES"), or null if not a known app. */
export function guideAppFromParam(param: string): GuideApp | null {
  const upper = param.trim().toUpperCase();
  return (ALL_GUIDE_APPS as string[]).includes(upper) ? (upper as GuideApp) : null;
}

/** GuideApp ("ISSUES") -> route param ("issues"). */
export function guideAppToParam(app: GuideApp): string {
  return app.toLowerCase();
}

export const GUIDE_APP_BY_ID: Record<GuideAppId, GuideApp> = {
  issues: 'ISSUES',
  menu: 'MENU',
  contacts: 'CONTACTS',
  atrace: 'ATRACE',
};

/**
 * Resolves "what is currently open" for the lota Гид widget: which app (if
 * any) the user is inside, its onboarding tour, and its GuideApp identity
 * for content lookups. Regexes mirror AppHeader.vue's route matching so the
 * widget's "Провести тур" button and the old per-route lifebuoy agree on
 * scope. Pages without a tour (home, console, публичные статьи) resolve
 * currentTour to null -- the widget still opens there, just without the
 * tour button.
 */
export function useGuideContext() {
  const route = useRoute();
  const { t } = useI18n();

  const isAtraceRoute = computed(() => route.path.includes('/atrace'));
  const isContactsListRoute = computed(() => /\/contacts\/(all|individual|legal)\//.test(route.path));
  const isMenuRoute = computed(() => /^\/[^/]+\/menu\/?$/.test(route.path));
  const isIssuesRoute = computed(() => /^\/[^/]+\/issues\/(?!plans$|settings$|zen$)[^/]+\/?$/.test(route.path));
  const isConsoleRoute = computed(() => route.path.startsWith('/console'));
  const isPublicationRoute = computed(() => /^\/(blog|whatsnew|articles|academy|news)\//.test(route.path));

  const currentAppId = computed<GuideAppId | null>(() => {
    if (isAtraceRoute.value) return 'atrace';
    if (isContactsListRoute.value) return 'contacts';
    if (isMenuRoute.value) return 'menu';
    if (isIssuesRoute.value) return 'issues';
    return null;
  });

  const currentTour = computed<TourConfig | null>(() => {
    const id = currentAppId.value;
    if (!id || isConsoleRoute.value || isPublicationRoute.value) return null;
    return APP_TOURS[id];
  });

  const currentAppName = computed<string | null>(() => {
    const id = currentAppId.value;
    if (!id) return null;
    const app = ALL_APPS.find((a) => a.address === id);
    return app ? t(app.titleKey) : null;
  });

  const currentGuideApp = computed<GuideApp>(() => {
    const id = currentAppId.value;
    if (id) return GUIDE_APP_BY_ID[id];
    if (route.path === '/') return 'LANDING';
    return 'GLOBAL';
  });

  return { currentAppId, currentAppName, currentTour, currentGuideApp };
}
