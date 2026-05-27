import { GraphQLClient } from 'graphql-request';
import type { Ref } from 'vue';
import { logError, logWarn } from '@/utils/logger';
import { getApiBaseUrl } from '@/utils/api-base';

// Reactive token holder (shared across clients)
let tokenRef: Ref<string | null> | null = null; // hub token (Authorization)
let atraceTokenRef: Ref<string | null> | null = null; // atrace app token (AtraceAuthorization)
let contactsTokenRef: Ref<string | null> | null = null; // contacts app token (ContactsAuthorization)

function getTokenRef() {
  if (!tokenRef) {
    // useState so it survives across HMR in dev
    tokenRef = useState<string | null>('global_auth_token', () => null);
  }
  return tokenRef;
}

function getAtraceTokenRef() {
  if (!atraceTokenRef) {
    atraceTokenRef = useState<string | null>('atrace_app_token', () => null);
  }
  return atraceTokenRef;
}

function getContactsTokenRef() {
  if (!contactsTokenRef) {
    contactsTokenRef = useState<string | null>('contacts_app_token', () => null);
  }
  return contactsTokenRef;
}

export function setGlobalAuthToken(token: string | null) {
  getTokenRef().value = token;
}

export function setAtraceAppToken(token: string | null) {
  getAtraceTokenRef().value = token;
}

export function setContactsAppToken(token: string | null) {
  getContactsTokenRef().value = token;
}

type UnauthorizedHandler = () => void | Promise<void>;
let unauthorizedHandler: UnauthorizedHandler | null = null;
let atraceUnauthorizedHandler: UnauthorizedHandler | null = null;
let contactsUnauthorizedHandler: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(fn: UnauthorizedHandler | null) { 
  unauthorizedHandler = fn; 
}

export function setAtraceUnauthorizedHandler(fn: UnauthorizedHandler | null) {
  atraceUnauthorizedHandler = fn;
}

export function setContactsUnauthorizedHandler(fn: UnauthorizedHandler | null) {
  contactsUnauthorizedHandler = fn;
}

type ApiClientOptions = {
  authHeader?: 'Authorization' | 'AtraceAuthorization' | 'ContactsAuthorization' | 'CapitalAuthorization';
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
  private authHeader: 'Authorization' | 'AtraceAuthorization' | 'ContactsAuthorization' | 'CapitalAuthorization';

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
    options?: { headers?: Record<string, string> }
  ): Promise<T> {
    return this.requestWithRetry<T>(query, variables, options, 0);
  }

  private async requestWithRetry<T>(
    query: any,
    variables?: Record<string, any>,
    options?: { headers?: Record<string, string> },
    retryCount: number = 0
  ): Promise<T> {
    // Merge headers each call to always use latest token + any provided headers
    const t = getTokenRef().value;
    const headers: Record<string, string> = {};
    // For atrace client, send AtraceAuthorization if we have it, regardless of hub token presence
    if (this.authHeader === 'AtraceAuthorization') {
      const at = getAtraceTokenRef().value;
      if (at) headers[this.authHeader] = `Bearer ${at}`;
    } else if (this.authHeader === 'ContactsAuthorization') {
      const ct = getContactsTokenRef().value;
      if (ct) headers[this.authHeader] = `Bearer ${ct}`;
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
      const isAtraceUnauthorized = this.authHeader === 'AtraceAuthorization' && (
        status === 401 || messages.some(m => m.includes('unauthorized') || m.includes('atraceauthorization token is invalid'))
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
          await atraceUnauthorizedHandler?.();
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
          await unauthorizedHandler?.();
          // Retry request once with new token
          try {
            return await this.requestWithRetry<T>(query, variables, options, 1);
          } catch (retryError) {
            // If retry still fails, throw original error
            throw error;
          }
        }
      } else {
        if (process.client) {
          try {
            const nuxtApp = useNuxtApp();
            nuxtApp.$handleGraphQLError?.(error);
          } catch {}
        }
        const firstMsg = rawErrors?.[0]?.message || error.message || 'GraphQL request failed';
        logError('GraphQL Error:', rawErrors || firstMsg);
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
