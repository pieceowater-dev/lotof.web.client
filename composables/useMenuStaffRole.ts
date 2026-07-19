import { decodeJwtPayload } from '@/utils/jwt'

export type MenuStaffRole = 'OWNER' | 'MANAGER' | 'COOK' | 'OPERATOR' | 'COURIER'

// Reads the caller's own role straight out of the current menu token
// (see menu.gtw's auth.svc.go, which embeds it as a `role` claim at
// issuance) — for UI decisions only, e.g. not showing a Settings link a
// cook/operator/courier could never do anything with. The actual gate is
// server-side (@menuAuth(roles: ...) on every settings mutation); this
// just keeps the nav honest about what a role can reach.
export function useMenuStaffRole() {
  const { current } = useMenuToken()

  const role = computed<MenuStaffRole | null>(() => {
    const token = current()
    if (!token) return null
    const payload = decodeJwtPayload<{ role?: string }>(token)
    return (payload?.role as MenuStaffRole) || null
  })

  const isOwnerOrManager = computed(() => role.value === 'OWNER' || role.value === 'MANAGER')

  return { role, isOwnerOrManager }
}
