/**
 * Single source of the platform's public site URL.
 *
 * The live value ALWAYS comes from runtime config (`NUXT_PUBLIC_SITE_URL`, set
 * per deployment). `DEFAULT_SITE_URL` is only the last-resort fallback for local
 * dev / prerender when that env var is unset. This module is the one place in
 * app code where a concrete platform domain is allowed to appear as a literal —
 * everything else must go through here so the project stays domain-agnostic and
 * can be served from lota.tools, lota.kz, or any future mirror unchanged.
 */
export const DEFAULT_SITE_URL = 'https://lota.tools';

/**
 * Absolute site origin, no trailing slash. Pass `config.public.siteUrl`
 * (or any candidate value); empty / non-string input falls back to
 * `DEFAULT_SITE_URL`.
 */
export function resolveSiteUrl(raw?: unknown): string {
  const value = typeof raw === 'string' ? raw.trim() : '';
  return (value || DEFAULT_SITE_URL).replace(/\/+$/, '');
}

/**
 * Bare host of the site URL — no scheme, no path, no trailing slash.
 * e.g. `"lota.tools"`. Handy for user-facing "opens on <host>" copy.
 */
export function resolveSiteHost(raw?: unknown): string {
  return resolveSiteUrl(raw).replace(/^https?:\/\//, '').replace(/\/+$/, '');
}
