import { decodeJwtPayload } from '@/utils/jwt'
import { usePlansToken } from '@/composables/usePlansToken'

export type PlansStaffRole = 'OWNER' | 'MANAGER' | 'RECEPTIONIST' | 'MASTER' | 'VIEWER'

// Reads the caller's role from the current plans token (plans.gtw embeds a
// `role` claim at issuance). UI-only — the real gate is server-side
// (@plansAuth(roles: ...) on every mutation).
export function usePlansStaffRole() {
  const { current } = usePlansToken()

  const role = computed<PlansStaffRole | null>(() => {
    const token = current()
    if (!token) return null
    const payload = decodeJwtPayload<{ role?: string }>(token)
    return (payload?.role as PlansStaffRole) || null
  })

  const isOwnerOrManager = computed(() => role.value === 'OWNER' || role.value === 'MANAGER')
  const canManageCalendar = computed(() =>
    role.value === 'OWNER' || role.value === 'MANAGER' || role.value === 'RECEPTIONIST',
  )
  const isMaster = computed(() => role.value === 'MASTER')

  return { role, isOwnerOrManager, canManageCalendar, isMaster }
}
