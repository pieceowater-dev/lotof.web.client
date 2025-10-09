// Manages current namespace selection (multi-tenant context)
export function useNamespace() {
  const all = useState<string[]>('namespaces_all', () => [
    'pieceowater',
    'pieceowater2',
    'pieceowater3',
    'pieceowater4',
    'pieceowater5_long_ns_name_aaa'
  ]);
  const selected = useState<string>('namespace_selected', () => {
    if (process.client) {
      const stored = localStorage.getItem('selectedNamespace');
      if (stored) return stored;
    }
    return all.value[0];
  });

  function setNamespace(ns: string) {
    if (!all.value.includes(ns)) return;
    selected.value = ns;
    if (process.client) localStorage.setItem('selectedNamespace', ns);
  }

  return { all, selected, setNamespace };
}
