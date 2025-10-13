// Manages current namespace selection (multi-tenant context)
export function useNamespace() {
  // Backed by API: namespaces the current user belongs to
  const all = useState<string[]>('namespaces_all', () => []);
  // Keep a cache of records to resolve id by slug when needed
  type NsRecord = { id: string; slug: string; title?: string };
  const records = useState<NsRecord[]>('namespaces_records', () => []);

  const { user, token } = useAuth();
  const loading = useState<boolean>('namespaces_loading', () => false);
  const error = useState<string | null>('namespaces_error', () => null);

  function readPerUserSelection(): string | null {
    if (!process.client) return null;
    try {
      const mapRaw = localStorage.getItem('selectedNamespaceByUser');
      const single = localStorage.getItem('selectedNamespace'); // legacy key
      const uid = user.value?.id || 'anon';
      if (mapRaw) {
        const map = JSON.parse(mapRaw || '{}') as Record<string, string>;
        return map[uid] || single || null;
      }
      return single;
    } catch {
      return null;
    }
  }

  function writePerUserSelection(ns: string) {
    if (!process.client) return;
    try {
      const uid = user.value?.id || 'anon';
      const mapRaw = localStorage.getItem('selectedNamespaceByUser');
      const map = mapRaw ? (JSON.parse(mapRaw) as Record<string, string>) : {};
      map[uid] = ns;
      localStorage.setItem('selectedNamespaceByUser', JSON.stringify(map));
      // keep legacy key in sync for backward compatibility
      localStorage.setItem('selectedNamespace', ns);
    } catch {
      // noop
    }
  }

  function ensureInAll(ns: string | undefined) {
    if (!ns) return;
    if (!all.value.includes(ns)) all.value = [...all.value, ns];
  }

  const selected = useState<string>('namespace_selected', () => {
    const stored = readPerUserSelection();
    if (stored) {
      ensureInAll(stored);
      return stored;
    }
    return all.value[0];
  });

  function setNamespace(ns: string) {
    if (!ns) return;
    ensureInAll(ns);
    selected.value = ns;
    writePerUserSelection(ns);
    // On namespace switch, clear app-scoped tokens (e.g., A-Trace token)
    if (process.client) {
      try {
        // Prefer Nuxt helper
        try { useCookie('atrace-token').value = null as any; } catch {}
        // Fallback: manual expire in case path/domain differs
        document.cookie = `atrace-token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/;`;
      } catch {}
    }
  }

  function syncFromRoute(ns: string | undefined) {
    if (!ns) return;
    if (selected.value !== ns) setNamespace(ns);
  }

  async function load(search?: string) {
    if (!token.value) {
      all.value = [];
      records.value = [];
      return;
    }
    loading.value = true;
    error.value = null;
    try {
      const { hubNamespacesList } = await import('@/api/hub/namespaces/list');
  const data = await hubNamespacesList(token.value, search, 1);
  records.value = data.rows.map(r => ({ id: r.id, slug: r.slug, title: r.title }));
  const slugs = records.value.map(r => r.slug);
      all.value = slugs;
      // Reconcile current selection
      if (!slugs.includes(selected.value)) {
        const stored = readPerUserSelection();
        if (stored && slugs.includes(stored)) {
          setNamespace(stored);
        } else if (slugs[0]) {
          setNamespace(slugs[0]);
        }
      }
    } catch (e: any) {
      error.value = e?.message || 'Failed to load namespaces';
    } finally {
      loading.value = false;
    }
  }

  // When user changes (login/logout), re-validate persisted selection
  if (process.client) {
    watch(
      () => [user.value?.id, token.value] as const,
      async () => {
        const stored = readPerUserSelection();
        if (stored && stored !== selected.value) setNamespace(stored);
        // If selection is not in list, ensure it is present
        ensureInAll(selected.value);
        // Load namespaces for the current user
        await load();
      }
    );
  }

  function idBySlug(slug?: string): string | undefined {
    if (!slug) return undefined;
    return records.value.find(r => r.slug === slug)?.id;
  }
  function titleBySlug(slug?: string): string | undefined {
    if (!slug) return undefined;
    return records.value.find(r => r.slug === slug)?.title;
  }

  return { all, selected, setNamespace, syncFromRoute, load, loading, error, idBySlug, titleBySlug };
}
