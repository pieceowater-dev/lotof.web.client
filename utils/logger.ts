// Simple logger utility with environment-aware verbosity
const debug = import.meta.env.DEV;

export function log(...args: any[]) {
  if (debug) console.log('[app]', ...args);
}
export function logWarn(...args: any[]) {
  if (debug) console.warn('[app]', ...args);
}
export function logError(...args: any[]) {
  console.error('[app]', ...args); // always show errors
}
