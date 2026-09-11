// Open-redirect guard used by useAppPlansPage's returnTo handling and
// atrace/recorded.vue. The interesting cases here are the ones a naive
// `path.startsWith('/') && !path.startsWith('//')` check would get wrong --
// that's exactly why this file exists instead (see its own comment).
import { describe, expect, it } from 'vitest';
import { isSafeRelativePath } from '@/utils/safeRelativePath';

describe('isSafeRelativePath', () => {
  it('accepts ordinary same-origin relative paths', () => {
    expect(isSafeRelativePath('/acme/issues/board')).toBe(true);
    expect(isSafeRelativePath('/')).toBe(true);
    expect(isSafeRelativePath('/acme/menu/plans?tab=yearly')).toBe(true);
    expect(isSafeRelativePath('/acme/issues#section')).toBe(true);
  });

  it('rejects a protocol-relative URL (the classic //evil.com case)', () => {
    expect(isSafeRelativePath('//evil.example')).toBe(false);
  });

  it('rejects an absolute URL to another origin', () => {
    expect(isSafeRelativePath('https://evil.example/phish')).toBe(false);
    expect(isSafeRelativePath('http://evil.example')).toBe(false);
  });

  it('rejects a tab/newline-smuggled protocol-relative URL', () => {
    // The exact attack the file's own comment documents: a plain
    // startsWith('/') check passes this (it doesn't start with "//"), but
    // the WHATWG URL parser strips the tab before resolving, turning it
    // into the off-site "//evil.example" once assigned to location.href.
    expect(isSafeRelativePath('/\t/evil.example')).toBe(false);
    expect(isSafeRelativePath('/\n/evil.example')).toBe(false);
    expect(isSafeRelativePath('/\r/evil.example')).toBe(false);
  });

  it('rejects a javascript: URL', () => {
    expect(isSafeRelativePath('javascript:alert(1)')).toBe(false);
  });

  it('rejects backslashes used to smuggle a protocol-relative URL', () => {
    // Browsers normalize backslashes to forward slashes when resolving a
    // URL, so "/\evil.example" and "\\evil.example" can also resolve
    // off-origin even though they don't look like "//" at a glance.
    expect(isSafeRelativePath('\\\\evil.example')).toBe(false);
  });

  it('treats an empty string as safe (resolves to the base itself, not off-site)', () => {
    expect(isSafeRelativePath('')).toBe(true);
  });
});
