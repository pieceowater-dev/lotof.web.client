// Centralized keys for cookies and Web Storage
// Use these to avoid string duplication across the app

export const CookieKeys = {
  TOKEN: 'token',
  ATRACE_TOKEN: 'atrace-token',
  CONTACTS_TOKEN: 'contacts-token',
  MENU_TOKEN: 'menu-token',
  TASKS_TOKEN: 'tasks-token',
  GOODS_TOKEN: 'goods-token',
  // Namespace-less Patron identity (see hub.gtw's PatronAuthService) --
  // deliberately its own cookie, never mixed with TOKEN (the namespace-owning
  // hub User session), matching backend's dedicated patron_token cookie.
  PATRON_TOKEN: 'patron_token',
} as const;
export type CookieKey = (typeof CookieKeys)[keyof typeof CookieKeys];

export const LSKeys = {
  LANGUAGE: 'lang',
  SELECTED_NAMESPACE: 'selectedNamespace', // legacy fallback
  SELECTED_NAMESPACE_BY_USER: 'selectedNamespaceByUser',
  ATRACE_TOKEN_NS: 'atraceTokenNs',
  CONTACTS_TOKEN_NS: 'contactsTokenNs',
  MENU_TOKEN_NS: 'menuTokenNs',
  TASKS_TOKEN_NS: 'tasksTokenNs',
  GOODS_TOKEN_NS: 'goodsTokenNs',
  DEVICE_ID: 'device-id',
  DEVICE_FINGERPRINT: 'device-fp',
  DEVICE_FINGERPRINT_META: 'device-fp-meta',
  // Non-httpOnly marker set after any successful login, so pages that want
  // to opportunistically silent-refresh (e.g. public article pages, for a
  // logged-in visitor whose access token expired) can skip the attempt --
  // and its guaranteed 401 -- for a browser that has never had a session.
  HAS_SESSION: 'lota_has_session',
  // Same idea as HAS_SESSION, but for the Patron identity (patron_token) --
  // patron_refresh_token is httpOnly, so pages that want to opportunistically
  // silent-refresh a Patron session (e.g. the Catalog) can skip the attempt
  // (and its guaranteed 401) for a browser that never had a Patron session.
  HAS_PATRON_SESSION: 'lota_has_patron_session',
  // Per-browser JSON array of namespace IDs an admin starred in
  // /console/namespaces, so that page can pin them above the (server-
  // paginated, search-filtered) table instead of making the admin
  // re-search for the same handful every visit. Client-only convenience,
  // no server-side counterpart.
  CONSOLE_FAVORITE_NAMESPACES: 'console:favorite-namespaces',
} as const;
export type LSKey = (typeof LSKeys)[keyof typeof LSKeys];

// Functions to build dynamic keys
export const dynamicLS = {
  atraceSelectedPostId: (namespaceSlug: string) => `atrace-selected-post-id:${namespaceSlug}`,
  atracePostPin: (namespaceSlug: string, postId: string) => `atrace-post-pin:${namespaceSlug}:${postId}`,
  tasksSelectedBoardSlug: (namespaceSlug: string) => `tasks-selected-board-slug:${namespaceSlug}`,
  tasksSelectedCycleId: (boardId: string) => `tasks-selected-cycle-id:${boardId}`,
} as const;
