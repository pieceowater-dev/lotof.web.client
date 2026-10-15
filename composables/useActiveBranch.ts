import type { Ref } from 'vue'

// The person's working point(s), kept per namespace in this browser and shared
// by every orders filter and selector: staff of one point pick it once and the
// order list, the "create order" form and the rest start on it. An empty list
// means "all points" (owners and managers who work across points).
const storageKey = (ns: string) => `menu:activeBranch:${ns}`

export function useActiveBranch(nsSlug: Ref<string>) {
  const state = useState<Record<string, string[]>>('activeBranch', () => ({}))

  function read(): string[] {
    const ns = nsSlug.value
    if (!ns) return []
    if (state.value[ns]) return state.value[ns]
    if (typeof window === 'undefined') return []
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey(ns)) || '[]')
      return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
    } catch {
      return []
    }
  }

  const branchIds = computed<string[]>({
    get: read,
    set: (ids) => {
      const ns = nsSlug.value
      if (!ns) return
      state.value = { ...state.value, [ns]: ids }
      try { localStorage.setItem(storageKey(ns), JSON.stringify(ids)) } catch {}
    },
  })

  /** Keeps only ids that still exist (a point may have been deleted). */
  function validated(existing: string[]): string[] {
    return branchIds.value.filter((id) => existing.includes(id))
  }

  return { branchIds, validated }
}
