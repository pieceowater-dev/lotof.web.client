import { computed } from 'vue';
import { LSKeys } from '@/utils/storageKeys';

// Per-browser list of namespace IDs an admin has starred in the console.
// /console/namespaces uses it to pin those namespaces above the
// server-paginated, search-filtered table, so the admin doesn't have to
// re-search for the same favourites on every visit. Purely a client-side
// convenience -- there is no server-side "favorite" concept, and clearing
// site data resets it.

function parseIds(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

export function useFavoriteNamespaces() {
  const ids = useState<string[]>('console-favorite-namespaces', () => []);
  const hydrated = useState<boolean>('console-favorite-namespaces-hydrated', () => false);

  if (process.client && !hydrated.value) {
    hydrated.value = true;
    try {
      ids.value = parseIds(window.localStorage.getItem(LSKeys.CONSOLE_FAVORITE_NAMESPACES));
    } catch {
      // localStorage unavailable (private mode) -- start empty.
    }
    // Reflect stars toggled in another console tab.
    window.addEventListener('storage', (e) => {
      if (e.key !== LSKeys.CONSOLE_FAVORITE_NAMESPACES) return;
      ids.value = parseIds(e.newValue);
    });
  }

  function persist() {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(LSKeys.CONSOLE_FAVORITE_NAMESPACES, JSON.stringify(ids.value));
    } catch {
      // Ignore write failures (private mode / quota).
    }
  }

  const favoriteSet = computed(() => new Set(ids.value));

  function isFavorite(id: string): boolean {
    return favoriteSet.value.has(id);
  }

  function toggle(id: string) {
    if (!id) return;
    ids.value = isFavorite(id) ? ids.value.filter((v) => v !== id) : [...ids.value, id];
    persist();
  }

  return {
    favoriteIds: ids,
    favoriteCount: computed(() => ids.value.length),
    isFavorite,
    toggle,
  };
}
