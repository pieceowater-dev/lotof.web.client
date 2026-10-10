import { getApiBasePath, toAbsoluteUrl } from '@/utils/api-base';

type MediaService = Parameters<typeof getApiBasePath>[0];

// Domains never live in the database. An uploaded file is stored as an origin-relative path
// (`/api-plans/media/…`); the browser resolves it against the current site, and where an
// absolute URL is unavoidable (og:image, share links) it is built on the fly with
// `absoluteMediaUrl()` from the current request origin.
export function toStoredMediaPath(service: MediaService, url: string): string {
  const raw = String(url || '').trim();
  if (/^https?:\/\//i.test(raw)) {
    try {
      const u = new URL(raw);
      return `${u.pathname}${u.search}`;
    } catch {
      return raw;
    }
  }
  return raw.startsWith('/api-') ? raw : `${getApiBasePath(service)}${raw.startsWith('/') ? raw : `/${raw}`}`;
}

export function absoluteMediaUrl(url?: string | null): string {
  if (!url) return '';
  return toAbsoluteUrl(url);
}
