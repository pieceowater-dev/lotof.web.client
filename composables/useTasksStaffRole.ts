import { decodeJwtPayload } from '@/utils/jwt'

export type TasksStaffRole = 'OWNER' | 'MANAGER' | 'ASSIGNEE' | 'VIEWER'

// Reads the caller's own role straight out of the current tasks (Issues) app
// token (see lotof.issues.gtw's auth.svc.go, which embeds it as a `role`
// claim at issuance) — for UI decisions only, e.g. hiding board-management
// actions a VIEWER/ASSIGNEE could never do anything with. The actual gate is
// server-side (@issuesAuth(roles: ...) on every management mutation); this
// just keeps the UI honest about what a role can reach.
export function useTasksStaffRole() {
  const { current } = useTasksToken()

  const role = computed<TasksStaffRole | null>(() => {
    const token = current()
    if (!token) return null
    const payload = decodeJwtPayload<{ role?: string }>(token)
    return (payload?.role as TasksStaffRole) || null
  })

  const isOwnerOrManager = computed(() => role.value === 'OWNER' || role.value === 'MANAGER')

  return { role, isOwnerOrManager }
}
