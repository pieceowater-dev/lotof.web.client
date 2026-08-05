import MarkdownIt from 'markdown-it';
import DOMPurifyImport from 'dompurify';

// html:false means raw HTML in the source is escaped as text rather than
// passed through -- task descriptions are user input, and this is the
// primary XSS guard. DOMPurify below is defense in depth against anything
// markdown-it's own renderer produces (e.g. link targets). DOMPurify needs a
// real DOM (it's a no-op factory under SSR), so rendering only ever happens
// client-side -- which matches how task data already loads in this app.
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

export function renderMarkdownSafe(source: string): string {
  if (!source || typeof window === 'undefined') return '';
  const rawHtml = md.render(source);
  return getDOMPurify().sanitize(rawHtml, { ADD_ATTR: ['target', 'rel'] });
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
