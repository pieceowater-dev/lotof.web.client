import { GraphQLClient } from 'graphql-request';
import type { Ref } from 'vue';
import { logError, logWarn } from '@/utils/logger';

// Reactive token holder (shared across clients)
let tokenRef: Ref<string | null> | null = null; // hub token (Authorization)
let atraceTokenRef: Ref<string | null> | null = null; // atrace app token (AtraceAuthorization)

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

export function setGlobalAuthToken(token: string | null) {
  getTokenRef().value = token;
}

export function setAtraceAppToken(token: string | null) {
  getAtraceTokenRef().value = token;
}

type UnauthorizedHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;
let atraceUnauthorizedHandler: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(fn: UnauthorizedHandler | null) { 
  unauthorizedHandler = fn; 
}

export function setAtraceUnauthorizedHandler(fn: UnauthorizedHandler | null) {
  atraceUnauthorizedHandler = fn;
}

type ApiClientOptions = {
  authHeader?: 'Authorization' | 'AtraceAuthorization';
};

export class ApiClient {
  private client: GraphQLClient;
  private baseURL: string;
  private authHeader: 'Authorization' | 'AtraceAuthorization';

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
    // Merge headers each call to always use latest token + any provided headers
    const t = getTokenRef().value;
    const headers: Record<string, string> = {};
    // For atrace client, send AtraceAuthorization if we have it, regardless of hub token presence
    if (this.authHeader === 'AtraceAuthorization') {
      const at = getAtraceTokenRef().value;
      if (at) headers[this.authHeader] = `Bearer ${at}`;
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
      const status = error.response?.status;
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

      if (isAtraceUnauthorized) {
        logWarn('Atrace unauthorized detected, invoking atrace handler');
        atraceUnauthorizedHandler?.();
      } else if (isHubUnauthorized) {
        logWarn('Hub unauthorized detected, invoking handler');
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

export const hubClient = new ApiClient(import.meta.env.VITE_API_HUB, { authHeader: 'Authorization' });
export const atraceClient = new ApiClient(import.meta.env.VITE_API_ATRACE, { authHeader: 'AtraceAuthorization' });
