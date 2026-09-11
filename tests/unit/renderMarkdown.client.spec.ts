// Default (jsdom) environment: window is defined, so renderMarkdownSafe/
// sanitizeHtml take the DOMPurify branch. See renderMarkdown.ssr.spec.ts for
// the no-window (SSR) branch of the same two functions.
import { describe, expect, it } from 'vitest';
import { renderMarkdownSafe, sanitizeHtml, stripLeadingHeading, stripMarkdownPreview } from '@/utils/renderMarkdown';

describe('renderMarkdownSafe (client / DOMPurify branch)', () => {
  it('returns "" for empty/falsy input', () => {
    expect(renderMarkdownSafe('')).toBe('');
    expect(renderMarkdownSafe(undefined as any)).toBe('');
  });

  it('renders ordinary markdown', () => {
    expect(renderMarkdownSafe('**bold** and _italic_')).toContain('<strong>bold</strong>');
  });

  it('escapes raw HTML in the source instead of passing it through (html:false)', () => {
    // The primary XSS guard: markdown-it is configured with html:false, so a
    // literal <script> in the *markdown source* must never survive as a tag.
    const out = renderMarkdownSafe('<script>alert(1)</script>');
    expect(out.toLowerCase()).not.toContain('<script');
  });

  it('never renders a javascript: URL as a clickable link', () => {
    // markdown-it's own default link validation already refuses to parse
    // this as a link at all -- it comes out as inert bracket text in a <p>,
    // not <a href="javascript:...">. The property that actually matters
    // (and that DOMPurify is the backstop for if that ever changes) is that
    // no *active* href with a dangerous scheme is ever produced.
    const out = renderMarkdownSafe('[click me](javascript:alert(document.cookie))');
    expect(out.toLowerCase()).not.toMatch(/href\s*=\s*["']javascript:/);
  });

  it('never renders a vbscript: URL as a clickable link', () => {
    const out = renderMarkdownSafe('[click me](vbscript:alert(1))');
    expect(out.toLowerCase()).not.toMatch(/href\s*=\s*["']vbscript:/);
  });

  it('keeps an ordinary https link intact', () => {
    const out = renderMarkdownSafe('[lota](https://lota.tools)');
    expect(out).toContain('https://lota.tools');
  });
});

describe('sanitizeHtml (client / DOMPurify branch)', () => {
  it('returns "" for empty/falsy input', () => {
    expect(sanitizeHtml('')).toBe('');
    expect(sanitizeHtml(null as any)).toBe('');
  });

  it('strips <script> tags and their contents entirely', () => {
    const out = sanitizeHtml('<p>Hello</p><script>alert(document.cookie)</script>');
    expect(out.toLowerCase()).not.toContain('<script');
    expect(out).not.toContain('alert(document.cookie)');
    expect(out).toContain('Hello');
  });

  it('strips inline event handler attributes', () => {
    const out = sanitizeHtml('<img src="x.png" onerror="alert(1)">');
    expect(out.toLowerCase()).not.toContain('onerror');
  });

  it('strips a javascript: href', () => {
    const out = sanitizeHtml('<a href="javascript:alert(1)">click</a>');
    expect(out.toLowerCase()).not.toContain('javascript:');
  });

  it('preserves structural tags this app relies on (details/summary)', () => {
    // Explicitly called out in the source comment -- publication bodies use
    // these for collapsible sections.
    const out = sanitizeHtml('<details><summary>More</summary>Body text</details>');
    expect(out).toContain('<details');
    expect(out).toContain('<summary');
    expect(out).toContain('Body text');
  });

  it('keeps a safe data:image URL (explicitly allowed for image sources)', () => {
    const out = sanitizeHtml('<img src="data:image/png;base64,iVBORw0KGgo=">');
    expect(out).toContain('data:image/png');
  });
});

describe('stripLeadingHeading', () => {
  it('removes a leading "# Title" line', () => {
    expect(stripLeadingHeading('## My Title\nBody text')).toBe('Body text');
  });

  it('leaves content with no leading heading untouched', () => {
    expect(stripLeadingHeading('Just body text')).toBe('Just body text');
  });

  it('only strips the first line, not headings further down', () => {
    expect(stripLeadingHeading('# Title\nBody\n## Subheading')).toBe('Body\n## Subheading');
  });
});

describe('stripMarkdownPreview', () => {
  it('strips a leading heading marker', () => {
    expect(stripMarkdownPreview('# Heading')).toBe('Heading');
  });

  it('strips bold/italic/code markers, keeping the inner text', () => {
    expect(stripMarkdownPreview('**bold** _italic_ `code`')).toBe('bold italic code');
  });

  it('renders a link as its visible text only', () => {
    expect(stripMarkdownPreview('[lota](https://lota.tools)')).toBe('lota');
  });

  it('renders an image as its alt text only', () => {
    expect(stripMarkdownPreview('![logo](https://lota.tools/logo.png)')).toBe('logo');
  });
});
