import { CookieKeys, LSKeys } from '@/utils/storageKeys'
import { createAppTokenComposable } from '@/composables/useAppToken'

export const useTasksToken = createAppTokenComposable({
  cookieKey: CookieKeys.TASKS_TOKEN,
  tsKey: 'tasks-token-ts',
  nsKey: LSKeys.TASKS_TOKEN_NS,
  storageProbeKey: '__tasks_storage_probe__',
  ttlMs: 12 * 60 * 60 * 1000, // 12h
  label: 'useTasksToken',
  getSetAppToken: async () => (await import('@/api/clients')).setTasksAppToken,
  getExchangeFn: async () => (await import('@/api/tasks/auth/getAppToken')).tasksGetAppToken,
})
