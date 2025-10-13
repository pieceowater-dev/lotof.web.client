import { GraphQLClient } from 'graphql-request';
import type { Ref } from 'vue';
import { logError, logWarn } from '@/utils/logger';

// Reactive token holder (shared across clients)
let tokenRef: Ref<string | null> | null = null;

function getTokenRef() {
  if (!tokenRef) {
    // useState so it survives across HMR in dev
    tokenRef = useState<string | null>('global_auth_token', () => null);
  }
  return tokenRef;
}

export function setGlobalAuthToken(token: string | null) {
  getTokenRef().value = token;
}

type UnauthorizedHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;
export function setUnauthorizedHandler(fn: UnauthorizedHandler) { unauthorizedHandler = fn; }

export class ApiClient {
  private client: GraphQLClient;
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
    // Do not send cookies with GraphQL requests to avoid session/header identity mismatches
    // Auth is carried via Authorization: Bearer <token>
    this.client = new GraphQLClient(baseURL + '/query', { credentials: 'omit' as any });
  }

  setAuthToken(token: string) {
    // For backwards compatibility (some legacy calls)
    this.client.setHeaders({ Authorization: `Bearer ${token}` });
  }

  async request<T>(
    query: any,
    variables?: Record<string, any>,
    options?: { headers?: Record<string, string> }
  ): Promise<T> {
    // Merge headers each call to always use latest token + any provided headers
    const t = getTokenRef().value;
    const headers: Record<string, string> = {};
    if (t) headers.Authorization = `Bearer ${t}`;
    if (options?.headers) Object.assign(headers, options.headers);
    if (Object.keys(headers).length) {
      this.client.setHeaders(headers);
    }
    try {
      return await this.client.request<T>(query, variables);
    } catch (error: any) {
      const rawErrors = error.response?.errors;
      const status = error.response?.status;
      if (status === 401) {
        logWarn('Unauthorized detected, invoking handler');
        unauthorizedHandler?.();
      } else {
        const firstMsg = rawErrors?.[0]?.message || error.message || 'GraphQL request failed';
        logError('GraphQL Error:', rawErrors || firstMsg);
      }
      // Re-throw the original error so callers can inspect error.response.data for partial data
      throw error;
    }
  }
}

export const hubClient = new ApiClient(import.meta.env.VITE_API_HUB);
export const atraceClient = new ApiClient(import.meta.env.VITE_API_ATRACE);
