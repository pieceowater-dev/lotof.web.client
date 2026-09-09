import { decodeJwtPayload } from '@/utils/jwt'
import { usePlansToken } from '@/composables/usePlansToken'

export type PlansStaffRole = 'OWNER' | 'MANAGER' | 'RECEPTIONIST' | 'MASTER' | 'VIEWER'

// Reads the caller's role from the current plans token (plans.gtw embeds a
// `role` claim at issuance). These flags mirror the server-side @plansAuth
// role lists 1:1 — the real gate is always the gateway; the UI just hides
// actions the caller would be rejected for.
//
//   OWNER        — everything, incl. staff roles + destructive deletes
//   MANAGER      — catalog / locations / settings / staff (view) — no deletes, no role changes
//   RECEPTIONIST — front desk: create / move / edit bookings; read everything
//   MASTER       — own calendar: set booking status, own working hours / time off; read everything
//   VIEWER       — read only
export function usePlansStaffRole() {
  const { current } = usePlansToken()

  const role = computed<PlansStaffRole | null>(() => {
    const token = current()
    if (!token) return null
    const payload = decodeJwtPayload<{ role?: string }>(token)
    return (payload?.role as PlansStaffRole) || null
  })

  const is = (...roles: PlansStaffRole[]) => computed(() => !!role.value && roles.includes(role.value))

  const isOwner = is('OWNER')
  const isOwnerOrManager = is('OWNER', 'MANAGER')
  const isMaster = is('MASTER')
  const isViewer = is('VIEWER')

  // catalog / services / locations / brand / rules — create+edit
  const canManageCatalog = is('OWNER', 'MANAGER')
  // create / reschedule / edit-fields / assign-master on bookings
  const canManageCalendar = is('OWNER', 'MANAGER', 'RECEPTIONIST')
  // change a booking's status (a master may do this for their own clients)
  const canSetBookingStatus = is('OWNER', 'MANAGER', 'RECEPTIONIST', 'MASTER')
  // assign / change staff roles
  const canManageStaff = is('OWNER')

  return {
    role, isOwner, isOwnerOrManager, isMaster, isViewer,
    canManageCatalog, canManageCalendar, canSetBookingStatus, canManageStaff,
  }
}
