export type ApiService = 'hub' | 'atrace' | 'contacts' | 'capital' | 'menu';

type QueryValue = string | number | boolean;

const API_BASE_PATHS: Record<ApiService, string> = {
  hub: '/api-hub',
  atrace: '/api-atrace',
  contacts: '/api-contacts',
  capital: '/api-capital',
  menu: '/api-menu',
};

const API_BASE_OVERRIDES: Record<ApiService, string | undefined> = {
  hub: import.meta.env.VITE_API_HUB,
  atrace: import.meta.env.VITE_API_ATRACE,
  contacts: import.meta.env.VITE_API_CONTACTS,
  capital: import.meta.env.VITE_API_CAPITAL,
  menu: import.meta.env.VITE_API_MENU,
};

function normalizeOverride(service: ApiService, raw: string): string {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return '';

  if (!/^https?:\/\//i.test(trimmed)) {
    return normalizeBase(trimmed);
  }

  try {
    const parsed = new URL(trimmed);
    const normalizedPath = parsed.pathname.replace(/\/$/, '');
    // Respect explicit absolute overrides as-is (host[:port] or custom path).
    // Do not force service proxy prefixes like /api-capital onto direct backends.
    if (!normalizedPath || normalizedPath === '/') return normalizeBase(parsed.toString());
    return normalizeBase(trimmed);
  } catch {
    return normalizeBase(trimmed);
  }
}

function normalizeBase(urlOrPath: string): string {
  return urlOrPath.replace(/\/$/, '');
}

function normalizeEndpointPath(path: string): string {
  return path.startsWith('/') ? path : `/${path}`;
}

function buildQueryString(query?: Record<string, QueryValue | null | undefined>): string {
  if (!query) return '';

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined) continue;
    params.set(key, String(value));
  }

  const encoded = params.toString();
  return encoded ? `?${encoded}` : '';
}

export function toWsUrl(
  baseUrlOrPath: string,
  path: string,
  query?: Record<string, QueryValue | null | undefined>,
): string {
  const base = normalizeBase(baseUrlOrPath);
  const endpointPath = normalizeEndpointPath(path);
  const queryString = buildQueryString(query);

  if (base.startsWith('https://')) return `${base.replace('https://', 'wss://')}${endpointPath}${queryString}`;
  if (base.startsWith('http://')) return `${base.replace('http://', 'ws://')}${endpointPath}${queryString}`;

  if (base.startsWith('/')) {
    if (process.client) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${protocol}//${window.location.host}${base}${endpointPath}${queryString}`;
    }

    return `ws://127.0.0.1${base}${endpointPath}${queryString}`;
  }

  return `${base}${endpointPath}${queryString}`;
}

export function getApiBasePath(service: ApiService): string {
  const override = API_BASE_OVERRIDES[service];
  if (override && override.trim().length > 0) {
    return normalizeOverride(service, override);
  }
  return API_BASE_PATHS[service];
}

export function toAbsoluteUrl(urlOrPath: string): string {
  const normalized = normalizeBase(urlOrPath);

  if (normalized.startsWith('https://') || normalized.startsWith('http://')) {
    return normalized;
  }

  if (!normalized.startsWith('/')) {
    return normalized;
  }

  if (process.client) {
    return `${window.location.origin}${normalized}`;
  }

  try {
    return `${useRequestURL().origin}${normalized}`;
  } catch {}

  try {
    const siteUrl = useRuntimeConfig().public.siteUrl;
    if (typeof siteUrl === 'string' && siteUrl.trim().length > 0) {
      return `${normalizeBase(siteUrl.trim())}${normalized}`;
    }
  } catch {}

  return `http://127.0.0.1${normalized}`;
}

export function getApiBaseUrl(service: ApiService): string {
  return toAbsoluteUrl(getApiBasePath(service));
}

export function getApiWsBase(service: ApiService): string {
  const base = getApiBasePath(service);
  return toWsUrl(base, '');
}

export function getApiWsUrl(
  service: ApiService,
  path: string,
  query?: Record<string, QueryValue | null | undefined>,
): string {
  return toWsUrl(getApiBasePath(service), path, query);
}
