import { useRoute, useRouter } from 'vue-router';
import { useNamespace } from '@/composables/useNamespace';
import { useOnboarding, type TourConfig } from '@/composables/useOnboarding';

/**
 * Where each tour actually runs. A tour's steps point at elements that exist
 * only on one page, so starting it from anywhere else (an app's settings page,
 * a different app, the hub) first has to take the visitor there.
 */
type TourPage = { match: RegExp; home: (ns: string) => string };

const TOUR_PAGES: Record<string, TourPage> = {
  'atrace-intro': { match: /^\/[^/]+\/atrace\/?$/, home: (ns) => `/${ns}/atrace` },
  'menu-intro': { match: /^\/[^/]+\/menu\/?$/, home: (ns) => `/${ns}/menu` },
  'plans-intro': { match: /^\/[^/]+\/plans\/?$/, home: (ns) => `/${ns}/plans` },
  'goods-intro': { match: /^\/[^/]+\/goods\/?$/, home: (ns) => `/${ns}/goods` },
  'goods-register-intro': { match: /^\/[^/]+\/goods\/register\/?$/, home: (ns) => `/${ns}/goods/register` },
  // /{ns}/issues itself redirects to the board the user is "in".
  'issues-intro': { match: /^\/[^/]+\/issues\/(?!plans$|settings$|zen$)[^/]+\/?$/, home: (ns) => `/${ns}/issues` },
  'contacts-intro': { match: /^\/[^/]+\/contacts\/(all|individual|legal)(\/|$)/, home: (ns) => `/${ns}/contacts/all/1-20` },
};

export function isOnTourPage(tourId: string, path: string): boolean {
  const page = TOUR_PAGES[tourId];
  return !page || page.match.test(path);
}

// Survives the page (and layout) swap that navigation causes.
const pendingTourId = () => useState<string | null>('pending_tour_id', () => null);
const pendingTours = new Map<string, TourConfig>();

export function useTourLauncher() {
  const route = useRoute();
  const router = useRouter();
  const { startTour, reset } = useOnboarding();
  const pending = pendingTourId();

  /** Run `tour` now if its page is open, otherwise go there and run it on arrival. */
  async function launchTour(tour: TourConfig) {
    if (isOnTourPage(tour.id, route.path)) {
      reset(tour.id);
      startTour(tour, 0);
      return;
    }
    const { selected } = useNamespace();
    const ns = (route.params.namespace as string) || selected.value;
    const page = TOUR_PAGES[tour.id];
    if (!page || !ns) return;
    reset(tour.id);
    pendingTours.set(tour.id, tour);
    pending.value = tour.id;
    await router.push(page.home(ns));
  }

  return { launchTour, pending, pendingTours };
}
