// Manages current namespace selection (multi-tenant context)
export function useNamespace() {
  // NOTE: Replace this stub with an API-backed list of namespaces the user belongs to
  const all = useState<string[]>('namespaces_all', () => [
    'pieceowater',
    'pieceowater2',
    'pieceowater3',
    'pieceowater4',
    'pieceowater5_long_ns_name_aaa'
  ]);

  const { user } = useAuth();

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
  }

  function syncFromRoute(ns: string | undefined) {
    if (!ns) return;
    if (selected.value !== ns) setNamespace(ns);
  }

  // When user changes (login/logout), re-validate persisted selection
  if (process.client) {
    watch(
      () => user.value?.id,
      () => {
        const stored = readPerUserSelection();
        if (stored && stored !== selected.value) setNamespace(stored);
        // If selection is not in list, ensure it is present
        ensureInAll(selected.value);
      }
    );
  }

  return { all, selected, setNamespace, syncFromRoute };
}
