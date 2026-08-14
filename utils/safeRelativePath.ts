// A plain startsWith('/') && !startsWith('//') check is NOT enough to
// guard a client-supplied redirect target: the WHATWG URL parser browsers
// actually use strips ASCII tab/LF/CR before resolving, so e.g.
// "/\t/evil.com" passes a string-prefix check but resolves to the
// protocol-relative "//evil.com" (off-site) once assigned to
// window.location.href. Parsing with the real URL constructor against a
// fixed neutral base reproduces that same normalization here, so whatever
// the browser would eventually resolve this to is exactly what gets
// checked -- works during SSR too since URL needs no `window`.
const SAFE_PATH_BASE = 'http://safe-base.invalid';

export function isSafeRelativePath(path: string): boolean {
  try {
    return new URL(path, SAFE_PATH_BASE).origin === SAFE_PATH_BASE;
  } catch {
    return false;
  }
}
