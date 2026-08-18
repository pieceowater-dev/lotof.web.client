import { decodeJwtPayload } from '@/utils/jwt'

export type GoodsStaffRole = 'OWNER' | 'MANAGER' | 'CASHIER' | 'STOCKKEEPER' | 'VIEWER'

// Reads the caller's own role straight out of the current goods token
// (see goods.gtw's auth.svc.go, which embeds it as a `role` claim at
// issuance) — for UI decisions only, e.g. hiding buttons a role has no
// backend access to (plan §6/§7). The actual gate is server-side
// (@goodsAuth(roles: ...) on every resolver); this just keeps the UI
// honest about what a role can reach.
export function useGoodsStaffRole() {
  const { current } = useGoodsToken()

  const role = computed<GoodsStaffRole | null>(() => {
    const token = current()
    if (!token) return null
    const payload = decodeJwtPayload<{ role?: string }>(token)
    return (payload?.role as GoodsStaffRole) || null
  })

  const isOwnerOrManager = computed(() => role.value === 'OWNER' || role.value === 'MANAGER')
  const canManageStock = computed(() => role.value === 'OWNER' || role.value === 'MANAGER' || role.value === 'STOCKKEEPER')
  const canSell = computed(() => role.value === 'OWNER' || role.value === 'MANAGER' || role.value === 'CASHIER')

  return { role, isOwnerOrManager, canManageStock, canSell }
}
