import { GraphQLClient } from 'graphql-request';
import { logError, logWarn } from '@/utils/logger';
import { getApiBaseUrl } from '@/utils/api-base';

// ---- Per-request auth state ------------------------------------------------
// Everything below used to be cached in module-level `let`s. On the Node SSR
// server a module is instantiated once per *process*, not once per request,
// so whichever request populated one of those `let`s first left it there for
// every other concurrent request on the same process to read (or overwrite)
// -- a real cross-user leak (see FRONTEND_AUDIT.md E1). Nothing here may be
// memoized in module scope; each accessor re-resolves it on every call.

type ServiceKey = 'hub' | 'atrace' | 'contacts' | 'menu' | 'tasks' | 'goods' | 'plans';

// useState() is already request-scoped by Nuxt (keyed off the current
// nuxtApp's payload.state), so the fix is simply to never cache the Ref it
// returns -- call useState() itself every time instead of once.
const TOKEN_STATE_KEY: Record<ServiceKey, string> = {
  hub: 'global_auth_token',
  atrace: 'atrace_app_token',
  contacts: 'contacts_app_token',
  menu: 'menu_app_token',
  tasks: 'tasks_app_token',
  goods: 'goods_app_token',
  plans: 'plans_app_token',
};

function tokenRef(service: ServiceKey) {
  return useState<string | null>(TOKEN_STATE_KEY[service], () => null);
}

export function setGlobalAuthToken(token: string | null) {
  tokenRef('hub').value = token;
}

export function setAtraceAppToken(token: string | null) {
  tokenRef('atrace').value = token;
}

export function setContactsAppToken(token: string | null) {
  tokenRef('contacts').value = token;
}

export function setMenuAppToken(token: string | null) {
  tokenRef('menu').value = token;
}

export function setTasksAppToken(token: string | null) {
  tokenRef('tasks').value = token;
}

export function setGoodsAppToken(token: string | null) {
  tokenRef('goods').value = token;
}

export function setPlansAppToken(token: string | null) {
  tokenRef('plans').value = token;
}

// "Unauthorized" callbacks are plain functions, not serializable state, so
// they can't live in useState. They're keyed off the current nuxtApp
// instance instead, via WeakMap: on the client there's one instance for the
// whole tab's session (same lifetime the old module-level `let` had); on
// SSR every request gets its own fresh instance, so concurrent requests can
// no longer see or invoke each other's handler.
type UnauthorizedHandler = () => void | Promise<void>;
type NuxtAppInstance = ReturnType<typeof useNuxtApp>;

const unauthorizedHandlers = new WeakMap<NuxtAppInstance, Partial<Record<ServiceKey, UnauthorizedHandler>>>();

function handlerBag() {
  const app = useNuxtApp();
  let bag = unauthorizedHandlers.get(app);
  if (!bag) {
    bag = {};
    unauthorizedHandlers.set(app, bag);
  }
  return bag;
}

export function setUnauthorizedHandler(fn: UnauthorizedHandler | null) {
  handlerBag().hub = fn ?? undefined;
}

export function setAtraceUnauthorizedHandler(fn: UnauthorizedHandler | null) {
  handlerBag().atrace = fn ?? undefined;
}

export function setContactsUnauthorizedHandler(fn: UnauthorizedHandler | null) {
  handlerBag().contacts = fn ?? undefined;
}

export function setMenuUnauthorizedHandler(fn: UnauthorizedHandler | null) {
  handlerBag().menu = fn ?? undefined;
}

export function setTasksUnauthorizedHandler(fn: UnauthorizedHandler | null) {
  handlerBag().tasks = fn ?? undefined;
}

export function setGoodsUnauthorizedHandler(fn: UnauthorizedHandler | null) {
  handlerBag().goods = fn ?? undefined;
}

export function setPlansUnauthorizedHandler(fn: UnauthorizedHandler | null) {
  handlerBag().plans = fn ?? undefined;
}

type ApiClientOptions = {
  authHeader?: 'Authorization' | 'AtraceAuthorization' | 'ContactsAuthorization' | 'CapitalAuthorization' | 'MenuAuthorization' | 'IssuesAuthorization' | 'GoodsAuthorization' | 'PlansAuthorization';
};

function notifyRateLimit() {
  if (!process.client) return;
  const rawLang = typeof window !== 'undefined' ? String(localStorage.getItem('lang') || '').toLowerCase() : '';
  const lang = rawLang.startsWith('ru') ? 'ru' : rawLang.startsWith('kk') ? 'kk' : 'en';
  const labels = {
    en: { title: 'Too many requests', description: 'Please wait a bit and try again.' },
    ru: { title: 'Слишком много запросов', description: 'Подождите немного и попробуйте снова.' },
    kk: { title: 'Сұрау тым көп', description: 'Сәл күтіп, қайтадан көріңіз.' },
  } as const;

  const text = labels[lang];
  try {
    const nuxtApp = useNuxtApp();
    nuxtApp.$handleGraphQLError?.({
      message: text.description,
      response: { errors: [{ message: text.description }] },
    });
  } catch {
    // Ignore UI notification errors in utility layer.
  }

  logWarn(`${text.title}: ${text.description}`);
}

export class ApiClient {
  private client: GraphQLClient;
  private baseURL: string;
  private authHeader: 'Authorization' | 'AtraceAuthorization' | 'ContactsAuthorization' | 'CapitalAuthorization' | 'MenuAuthorization' | 'IssuesAuthorization' | 'GoodsAuthorization' | 'PlansAuthorization';

  constructor(baseURL: string, options?: ApiClientOptions) {
    this.baseURL = baseURL;
    this.authHeader = options?.authHeader ?? 'Authorization';
    // Do not send cookies with GraphQL requests to avoid session/header identity mismatches
    // Auth is carried via Authorization: Bearer <token>
    this.client = new GraphQLClient(baseURL + '/query', { credentials: 'omit' as any });
  }

  setAuthToken(token: string) {
    // For backwards compatibility (some legacy calls)
    this.client.setHeaders({ [this.authHeader]: `Bearer ${token}` } as any);
  }

  async request<T>(
    query: any,
    variables?: Record<string, any>,
    options?: { headers?: Record<string, string>; suppressErrors?: boolean }
  ): Promise<T> {
    return this.requestWithRetry<T>(query, variables, options, 0);
  }

  private async requestWithRetry<T>(
    query: any,
    variables?: Record<string, any>,
    options?: { headers?: Record<string, string>; suppressErrors?: boolean },
    retryCount: number = 0
  ): Promise<T> {
    // Merge headers each call to always use latest token + any provided headers
    const t = tokenRef('hub').value;
    const headers: Record<string, string> = {};
    // For atrace client, send AtraceAuthorization if we have it, regardless of hub token presence
    if (this.authHeader === 'AtraceAuthorization') {
      const at = tokenRef('atrace').value;
      if (at) headers[this.authHeader] = `Bearer ${at}`;
    } else if (this.authHeader === 'ContactsAuthorization') {
      const ct = tokenRef('contacts').value;
      if (ct) headers[this.authHeader] = `Bearer ${ct}`;
    } else if (this.authHeader === 'MenuAuthorization') {
      const mt = tokenRef('menu').value;
      if (mt) headers[this.authHeader] = `Bearer ${mt}`;
    } else if (this.authHeader === 'IssuesAuthorization') {
      const tt = tokenRef('tasks').value;
      if (tt) headers[this.authHeader] = `Bearer ${tt}`;
    } else if (this.authHeader === 'PlansAuthorization') {
      const pt = tokenRef('plans').value;
      if (pt) headers['PlansAuthorization'] = `Bearer ${pt}`;
    } else if (this.authHeader === 'GoodsAuthorization') {
      const gt = tokenRef('goods').value;
      if (gt) headers[this.authHeader] = `Bearer ${gt}`;
    } else if (this.authHeader === 'CapitalAuthorization') {
      if (t) headers[this.authHeader] = `Bearer ${t}`;
    } else if (t) {
      // For hub client use hub token
      headers[this.authHeader] = `Bearer ${t}`;
    }
    if (options?.headers) Object.assign(headers, options.headers);
    if (Object.keys(headers).length) {
      this.client.setHeaders(headers);
    }
    try {
      return await this.client.request<T>(query, variables);
    } catch (error: any) {
      const rawErrors = error.response?.errors;
      const status = error.response?.status ?? error.response?.statusCode ?? error.status;
      const isRateLimited = status === 429;
      // Detect unauthorized both by HTTP status and GraphQL error messages
      const messages: string[] = Array.isArray(rawErrors)
        ? rawErrors.map((e: any) => String(e?.message || '').toLowerCase())
        : [];
      const isOptimisticConflict = messages.some((m) => m.includes('version mismatch') || m.includes('update conflict'));
      const isAtraceUnauthorized = this.authHeader === 'AtraceAuthorization' && (
        status === 401 || messages.some(m => m.includes('unauthorized') || m.includes('atraceauthorization token is invalid'))
      );
      const isMenuUnauthorized = this.authHeader === 'MenuAuthorization' && (
        status === 401 || messages.some(m => m.includes('unauthorized') || m.includes('menuauthorization token is invalid'))
      );
      const isTasksUnauthorized = this.authHeader === 'IssuesAuthorization' && (
        status === 401 || messages.some(m => m.includes('unauthorized') || m.includes('issuesauthorization token is invalid'))
      );
      const isGoodsUnauthorized = this.authHeader === 'GoodsAuthorization' && (
        status === 401 || messages.some(m => m.includes('unauthorized') || m.includes('goodsauthorization token is invalid'))
      );
      const isPlansUnauthorized = this.authHeader === 'PlansAuthorization' && (
        status === 401 || messages.some(m => m.includes('unauthorized') || m.includes('plansauthorization token is invalid'))
      );
      const isCapitalUnauthorized = this.authHeader === 'CapitalAuthorization' && (
        status === 401 || messages.some(m => m.includes('unauthorized') && m.includes('token'))
      );
      const isHubUnauthorized = this.authHeader === 'Authorization' && (
        status === 401 || messages.some(m => m.includes('unauthorized') && m.includes('token'))
      );

      if (isRateLimited) {
        logWarn('Rate limit detected');
        notifyRateLimit();
      } else if (isAtraceUnauthorized) {
        logWarn('Atrace unauthorized detected, invoking atrace handler');
        if (retryCount === 0) {
          // Try refresh once before giving up
          await handlerBag().atrace?.();
          // Retry request once with new token
          try {
            return await this.requestWithRetry<T>(query, variables, options, 1);
          } catch (retryError) {
            // If retry still fails, throw original error
            throw error;
          }
        }
      } else if (isMenuUnauthorized) {
        logWarn('Menu unauthorized detected, invoking menu handler');
        if (retryCount === 0) {
          // Try refresh once before giving up
          await handlerBag().menu?.();
          // Retry request once with new token
          try {
            return await this.requestWithRetry<T>(query, variables, options, 1);
          } catch (retryError) {
            // If retry still fails, throw original error
            throw error;
          }
        }
      } else if (isTasksUnauthorized) {
        logWarn('Tasks unauthorized detected, invoking tasks handler');
        if (retryCount === 0) {
          // Try refresh once before giving up
          await handlerBag().tasks?.();
          // Retry request once with new token
          try {
            return await this.requestWithRetry<T>(query, variables, options, 1);
          } catch (retryError) {
            // If retry still fails, throw original error
            throw error;
          }
        }
      } else if (isPlansUnauthorized) {
        logWarn('Plans unauthorized detected, invoking plans handler');
        try {
          await handlerBag().plans?.();
        } catch (e) {
          logError('plans unauthorized handler failed', e);
        }
      } else if (isGoodsUnauthorized) {
        logWarn('Goods unauthorized detected, invoking goods handler');
        if (retryCount === 0) {
          // Try refresh once before giving up
          await handlerBag().goods?.();
          // Retry request once with new token
          try {
            return await this.requestWithRetry<T>(query, variables, options, 1);
          } catch (retryError) {
            // If retry still fails, throw original error
            throw error;
          }
        }
      } else if (isHubUnauthorized) {
        logWarn('Hub unauthorized detected, invoking handler');
        if (retryCount === 0) {
          // Try refresh once before giving up
          await handlerBag().hub?.();
          // Retry request once with new token
          try {
            return await this.requestWithRetry<T>(query, variables, options, 1);
          } catch (retryError) {
            // If retry still fails, throw original error
            throw error;
          }
        }
      } else if (isCapitalUnauthorized) {
        logWarn('Capital unauthorized detected, invoking handler');
        if (retryCount === 0) {
          // Try refresh once before giving up
          await handlerBag().hub?.();
          // Retry request once with new token
          try {
            return await this.requestWithRetry<T>(query, variables, options, 1);
          } catch (retryError) {
            // If retry still fails, throw original error
            throw error;
          }
        }
      } else if (!isOptimisticConflict) {
        if (!options?.suppressErrors) {
          if (process.client) {
            try {
              const nuxtApp = useNuxtApp();
              nuxtApp.$handleGraphQLError?.(error);
            } catch {}
          }
          const firstMsg = rawErrors?.[0]?.message || error.message || 'GraphQL request failed';
          logError('GraphQL Error:', rawErrors || firstMsg);
        }
      }
      // Re-throw the original error so callers can inspect error.response.data for partial data
      throw error;
    }
  }
}

export const hubClient = new ApiClient(getApiBaseUrl('hub'), { authHeader: 'Authorization' });
export const atraceClient = new ApiClient(getApiBaseUrl('atrace'), { authHeader: 'AtraceAuthorization' });
export const contactsClient = new ApiClient(getApiBaseUrl('contacts'), { authHeader: 'ContactsAuthorization' });
export const capitalClient = new ApiClient(getApiBaseUrl('capital'), { authHeader: 'CapitalAuthorization' });
export const menuClient = new ApiClient(getApiBaseUrl('menu'), { authHeader: 'MenuAuthorization' });
export const tasksClient = new ApiClient(getApiBaseUrl('tasks'), { authHeader: 'IssuesAuthorization' });
export const goodsClient = new ApiClient(getApiBaseUrl('goods'), { authHeader: 'GoodsAuthorization' });
export const plansClient = new ApiClient(getApiBaseUrl('plans'), { authHeader: 'PlansAuthorization' });
