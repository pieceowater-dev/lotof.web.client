// Centralized keys for cookies and Web Storage
// Use these to avoid string duplication across the app

export const CookieKeys = {
  TOKEN: 'token',
  ATRACE_TOKEN: 'atrace-token',
} as const;
export type CookieKey = (typeof CookieKeys)[keyof typeof CookieKeys];

export const LSKeys = {
  LANGUAGE: 'lang',
  SELECTED_NAMESPACE: 'selectedNamespace', // legacy fallback
  SELECTED_NAMESPACE_BY_USER: 'selectedNamespaceByUser',
  DEVICE_ID: 'device-id',
  DEVICE_FINGERPRINT: 'device-fp',
} as const;
export type LSKey = (typeof LSKeys)[keyof typeof LSKeys];

// Functions to build dynamic keys
export const dynamicLS = {
  atraceSelectedPostId: (namespaceSlug: string) => `atrace-selected-post-id:${namespaceSlug}`,
} as const;
