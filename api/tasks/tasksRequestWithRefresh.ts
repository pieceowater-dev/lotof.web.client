import { tasksClient, setTasksAppToken } from '@/api/clients';
import { tasksGetAppToken } from '@/api/tasks/auth/getAppToken';
import { CookieKeys } from '@/utils/storageKeys';
import { useAuth } from '@/composables/useAuth';
import { useTasksToken } from '@/composables/useTasksToken';

/**
 * Universal wrapper for tasksClient requests with auto-refresh on
 * IssuesAuthorization error. Usage: await tasksRequestWithRefresh(() => tasksClient.request(...), nsSlug)
 */
export async function tasksRequestWithRefresh<T>(fn: () => Promise<T>, nsSlug: string): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const isUnauthorized = error?.response?.errors?.some((e: any) =>
      typeof e.message === 'string' &&
      e.message.includes('IssuesAuthorization token is invalid')
    );
    if (isUnauthorized) {
      // Clear old token
      try { useCookie(CookieKeys.TASKS_TOKEN).value = null as any; } catch {}
      setTasksAppToken(null);
      try { useTasksToken().clear(); } catch {}
      // Try to get new token using hub token
      const { token } = useAuth();
      const hubToken = token.value;
      if (!hubToken) throw error;
      const newToken = await tasksGetAppToken(hubToken, nsSlug);
      if (newToken) {
        useCookie(CookieKeys.TASKS_TOKEN, { path: '/' }).value = newToken;
        setTasksAppToken(newToken);
        // Retry original request
        return await fn();
      }
    }
    throw error;
  }
}
