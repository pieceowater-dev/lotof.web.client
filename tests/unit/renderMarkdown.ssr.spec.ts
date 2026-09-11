// @vitest-environment node
//
// Node has no `window`, so renderMarkdownSafe/sanitizeHtml take the
// no-DOMPurify SSR fallback path (stripDangerousUrlSchemes /
// stripUnsafeHtmlSSR). This is what actually runs when the server renders a
// public Guide article or publication body on first paint, before client
// hydration re-sanitizes with the real DOMPurify -- see
// renderMarkdown.client.spec.ts for that branch.
import { describe, expect, it } from 'vitest';
import { renderMarkdownSafe, sanitizeHtml } from '@/utils/renderMarkdown';

describe('renderMarkdownSafe (SSR / no-DOM branch)', () => {
  it('confirms window really is undefined in this test file', () => {
    expect(typeof window).toBe('undefined');
  });

  it('escapes raw HTML in the source (html:false), same as the client branch', () => {
    const out = renderMarkdownSafe('<script>alert(1)</script>');
    expect(out.toLowerCase()).not.toContain('<script');
  });

  it('never renders a javascript: URL as a clickable link, with no DOM available', () => {
    // Same markdown-it link-validation behavior as the client branch (see
    // renderMarkdown.client.spec.ts) -- it never becomes an active href,
    // just inert bracket text.
    const out = renderMarkdownSafe('[click me](javascript:alert(document.cookie))');
    expect(out.toLowerCase()).not.toMatch(/href\s*=\s*["']javascript:/);
  });

  it('keeps an ordinary https link intact', () => {
    const out = renderMarkdownSafe('[lota](https://lota.tools)');
    expect(out).toContain('https://lota.tools');
  });
});

describe('sanitizeHtml (SSR / stripUnsafeHtmlSSR branch)', () => {
  it('returns "" for empty/falsy input', () => {
    expect(sanitizeHtml('')).toBe('');
    expect(sanitizeHtml(null as any)).toBe('');
  });

  it('strips <script>...</script> including its contents', () => {
    const out = sanitizeHtml('<p>Hello</p><script>alert(document.cookie)</script>');
    expect(out.toLowerCase()).not.toContain('<script');
    expect(out).not.toContain('alert(document.cookie)');
    expect(out).toContain('Hello');
  });

  it('strips <style>, <iframe> and other dangerous block elements', () => {
    const out = sanitizeHtml('<iframe src="https://evil.example"></iframe><style>body{}</style>Text');
    expect(out.toLowerCase()).not.toContain('<iframe');
    expect(out.toLowerCase()).not.toContain('<style');
    expect(out).toContain('Text');
  });

  it('strips a self-closing dangerous element (e.g. a void-style <link>)', () => {
    const out = sanitizeHtml('<link rel="stylesheet" href="https://evil.example/x.css">Text');
    expect(out.toLowerCase()).not.toContain('<link');
    expect(out).toContain('Text');
  });

  it('strips inline event handler attributes', () => {
    const out = sanitizeHtml('<img src="x.png" onerror="alert(1)">');
    expect(out.toLowerCase()).not.toContain('onerror');
  });

  it('strips a javascript: href but keeps the surrounding markup', () => {
    const out = sanitizeHtml('<a href="javascript:alert(1)">click</a>');
    expect(out.toLowerCase()).not.toContain('javascript:');
    expect(out).toContain('click');
  });

  it('keeps an ordinary https href', () => {
    const out = sanitizeHtml('<a href="https://lota.tools">lota</a>');
    expect(out).toContain('https://lota.tools');
  });

  it('keeps a safe data:image URL but strips a non-image data: URL', () => {
    const safe = sanitizeHtml('<img src="data:image/png;base64,iVBORw0KGgo=">');
    expect(safe).toContain('data:image/png');

    const unsafe = sanitizeHtml('<img src="data:text/html;base64,PHNjcmlwdD4=">');
    expect(unsafe.toLowerCase()).not.toContain('data:text/html');
  });
});
