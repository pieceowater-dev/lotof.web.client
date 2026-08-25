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

  return { get, set };
}
