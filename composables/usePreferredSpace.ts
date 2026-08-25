// Remembers which "space" (hub workspace vs. patron catalog) the visitor
// picked from the / landing page, so returning clicks on the header logo
// skip the landing choice and go straight there. Purely a client-side
// convenience -- / itself always renders as the stable landing page
// regardless of this value.
const STORAGE_KEY = 'lota:preferred-space';

export type PreferredSpace = 'hub' | 'catalog';

export function usePreferredSpace() {
  function get(): PreferredSpace | null {
    if (typeof window === 'undefined') return null;
    try {
      const v = window.localStorage.getItem(STORAGE_KEY);
      return v === 'hub' || v === 'catalog' ? v : null;
    } catch {
      return null;
    }
  }

  function set(space: PreferredSpace) {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(STORAGE_KEY, space);
    } catch {}
  }

  // Shared "where does a generic Home link go" rule -- any "Home" /
  // "back to lota" link outside AppHeader.vue (which has its own
  // isPublicationPage-aware variant) should use this instead of hardcoding
  // to="/", so it respects a returning hub user's actual home (/hub)
  // instead of always bouncing them through the landing page.
  function homePath(): string {
    const pref = get();
    if (pref === 'hub') return '/hub';
    if (pref === 'catalog') return '/catalog';
    return '/';
  }

  return { get, set, homePath };
}
