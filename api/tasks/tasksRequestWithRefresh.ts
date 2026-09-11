import { tasksClient, setTasksAppToken } from '@/api/clients';
import { tasksGetAppToken } from '@/api/tasks/auth/getAppToken';
import { CookieKeys } from '@/utils/storageKeys';
import { useAuth } from '@/composables/useAuth';
import { useTasksToken } from '@/composables/useTasksToken';
import { logWarn } from '@/utils/logger';

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
      try { useCookie(CookieKeys.TASKS_TOKEN).value = null as any; } catch (e) { logWarn('[tasks] failed to clear token cookie', e); }
      setTasksAppToken(null);
      try { useTasksToken().clear(); } catch (e) { logWarn('[tasks] failed to clear token state', e); }
      // Try to get new token using hub token
      const { token } = useAuth();
      const hubToken = token.value;
      if (!hubToken) throw error;
      const newToken = await tasksGetAppToken(hubToken, nsSlug);
      if (newToken) {
        // Match the attributes the initial write uses (composables/useAppToken.ts)
        // -- without them the cookie loses Secure/SameSite the moment it's
        // rewritten here, i.e. after the very first refresh (FRONTEND_AUDIT.md L2).
        useCookie(CookieKeys.TASKS_TOKEN, { path: '/', sameSite: 'lax', secure: !import.meta.dev, maxAge: 60 * 60 * 24 * 6 }).value = newToken;
        setTasksAppToken(newToken);
        // Retry original request
        return await fn();
      }
    }
    throw error;
  }
}
