import MarkdownIt from 'markdown-it';
import DOMPurifyImport from 'dompurify';

// html:false means raw HTML in the source is escaped as text rather than
// passed through -- task descriptions are user input, and this is the
// primary XSS guard. DOMPurify below is defense in depth against anything
// markdown-it's own renderer produces (e.g. link targets).
const md = new MarkdownIt({ html: false, linkify: true, breaks: true });

// Depending on how the bundler resolves the ESM/CJS export conditions,
// the default export can come through either as an already-initialized
// instance (has .sanitize) or as the raw factory that still needs a window
// passed in -- handle both rather than assuming one.
function getDOMPurify(): { sanitize: (html: string, opts?: any) => string } {
  const mod: any = DOMPurifyImport;
  if (mod && typeof mod.sanitize === 'function') return mod;
  return mod(window);
}

// DOMPurify needs a real DOM and is a no-op factory under SSR (Node has no
// window). With html:false already blocking literal <script>/onerror etc in
// the source, the one realistic gap DOMPurify would otherwise catch here is
// a dangerous URL scheme on a markdown link/image target (e.g.
// "[x](javascript:...)"), since that's markdown syntax, not raw HTML, so
// html:false doesn't touch it. Stripped manually so pages that render this
// server-side (public Guide articles) still ship real content on first
// paint instead of an empty node until client hydration re-renders it.
const DANGEROUS_URL_SCHEME = /^\s*(javascript|vbscript|data(?!:image\/(?:png|gif|jpe?g|webp|svg\+xml)))\s*:/i;

function stripDangerousUrlSchemes(html: string): string {
  return html.replace(/\s(href|src)=(["'])(.*?)\2/gi, (match, attr, quote, url) => (
    DANGEROUS_URL_SCHEME.test(url) ? '' : match
  ));
}

export function renderMarkdownSafe(source: string): string {
  if (!source) return '';
  const rawHtml = md.render(source);
  if (typeof window === 'undefined') return stripDangerousUrlSchemes(rawHtml);
  return getDOMPurify().sanitize(rawHtml, { ADD_ATTR: ['target', 'rel'] });
}

// sanitizeHtml is for content that is ALREADY HTML (not markdown) but is
// authored by someone -- e.g. publication bodies from the console editor.
// Without this, a `v-html` of that string is stored XSS for every reader.
// DOMPurify keeps structural tags (details/summary) and data-* attributes,
// strips <script>, on* handlers and javascript: URLs. SSR has no DOM, so it
// falls back to the same dangerous-scheme strip renderMarkdownSafe uses.
export function sanitizeHtml(html: string): string {
  if (!html) return '';
  if (typeof window === 'undefined') return stripUnsafeHtmlSSR(html);
  return getDOMPurify().sanitize(html, { ADD_ATTR: ['target', 'rel'] });
}

// Best-effort SSR strip (no DOM available for DOMPurify): drop script/style/
// frame elements, inline event handlers and dangerous URL schemes so the
// first server-rendered paint is safe; the client re-sanitises with DOMPurify
// on hydration.
function stripUnsafeHtmlSSR(html: string): string {
  return stripDangerousUrlSchemes(
    html
      .replace(/<\s*(script|style|iframe|object|embed|link|meta|base)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
      .replace(/<\s*(script|style|iframe|object|embed|link|meta|base)\b[^>]*\/?>/gi, '')
      .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, ''),
  );
}

// Guide articles are authored with a leading "## Title" line that restates
// the article's own title (kept for readability in the console editor and
// for content copied elsewhere). Reader-facing views already render the
// title separately as its own heading, so pass content through this first
// to avoid showing the same heading twice back to back.
export function stripLeadingHeading(source: string): string {
  return source.replace(/^\s*#{1,6}[^\n]*\n?/, '');
}

// For compact, single-line previews (kanban cards) where rendering actual
// HTML doesn't make sense -- strips the markdown syntax instead so a "#
// Heading" or "**bold**" description reads as its plain text, not literal
// hashes and asterisks.
export function stripMarkdownPreview(source: string): string {
  return source
    .replace(/^#{1,6}\s+/, '')
    .replace(/^>\s?/, '')
    .replace(/^[-*+]\s+/, '')
    .replace(/^\d+[.)]\s+/, '')
    .replace(/(\*\*\*|___)(.+?)\1/g, '$2')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/(\*|_)(.+?)\1/g, '$2')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
}
