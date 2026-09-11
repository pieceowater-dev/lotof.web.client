import { describe, expect, it } from 'vitest';
import { DEFAULT_SITE_URL, fillSiteHost, resolveSiteHost, resolveSiteUrl } from '@/utils/siteUrl';

describe('resolveSiteUrl', () => {
  it('returns the given URL with a trailing slash stripped', () => {
    expect(resolveSiteUrl('https://lota.kz/')).toBe('https://lota.kz');
  });

  it('passes through a URL with no trailing slash unchanged', () => {
    expect(resolveSiteUrl('https://lota.tools')).toBe('https://lota.tools');
  });

  it.each([undefined, null, '', '   ', 42, {}])('falls back to DEFAULT_SITE_URL for %j', (input) => {
    expect(resolveSiteUrl(input as any)).toBe(DEFAULT_SITE_URL);
  });

  it('trims surrounding whitespace before use', () => {
    expect(resolveSiteUrl('  https://lota.kz  ')).toBe('https://lota.kz');
  });
});

describe('resolveSiteHost', () => {
  it('strips the scheme and trailing slash', () => {
    expect(resolveSiteHost('https://lota.kz/')).toBe('lota.kz');
  });

  it('strips http as well as https', () => {
    expect(resolveSiteHost('http://localhost:3000')).toBe('localhost:3000');
  });

  it('falls back to the default host when unset', () => {
    expect(resolveSiteHost()).toBe('lota.tools');
  });
});

describe('fillSiteHost', () => {
  it('substitutes {{site}} with the given host', () => {
    expect(fillSiteHost('Contact us at {{site}}.', 'lota.kz')).toBe('Contact us at lota.kz.');
  });

  it('replaces every occurrence, not just the first', () => {
    expect(fillSiteHost('{{site}} and {{site}}', 'lota.kz')).toBe('lota.kz and lota.kz');
  });

  it('tolerates whitespace inside the token', () => {
    expect(fillSiteHost('{{ site }}', 'lota.kz')).toBe('lota.kz');
  });

  // The exact scenario the comment in siteUrl.ts calls out: a prerender/build
  // context has no real request host, so a baked legal doc must never end up
  // naming "localhost" as the operator's domain.
  it.each(['localhost', 'localhost:3000', '127.0.0.1', '0.0.0.0', '', undefined, null])(
    'falls back to the configured site host instead of a dev/empty host (%j)',
    (host) => {
      expect(fillSiteHost('{{site}}', host as any)).toBe('lota.tools');
    },
  );

  it('lowercases a mixed-case host', () => {
    expect(fillSiteHost('{{site}}', 'LOTA.KZ')).toBe('lota.kz');
  });

  it('leaves text with no token untouched', () => {
    expect(fillSiteHost('no token here', 'lota.kz')).toBe('no token here');
  });
});
