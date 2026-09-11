# lota.web.client

The frontend for [lota.tools](https://lota.tools) (mirrored at lota.kz): a
Nuxt 3 / Vue 3 SSR app that serves the marketing site, the multi-tenant
workspace console, and the public storefronts for every lota product
(Atrace, Menu, Goods, Contacts/Memberships, Issues, Plans).

This is one of several `lotof.*` repos that make up the platform (one
gateway + one or more microservices per product, plus this client). See
`lotof.cloud.infra`/`lotof.cloud.state` for the cluster side.

## Stack

- **Nuxt 3** (Vue 3, SSR via Nitro), **@nuxt/ui** for the component kit.
- **GraphQL** over `graphql-request` (queries as inline strings today;
  `graphql-codegen` is configured but currently only wired up for the hub
  service — see `FRONTEND_AUDIT.md` D1).
- **TypeScript**, checked with `vue-tsc` (`npm run typecheck`).
- No global state library (Pinia etc.) — auth/token/namespace state lives in
  Nuxt's `useState`, see [Auth & per-service tokens](#auth--per-service-tokens)
  below.

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000
```

Backend services are expected behind this app's own `/api-*` proxy paths in
both dev and prod (see `nuxt.config.ts` → `routeRules`), so a plain `npm run
dev` talks to whatever `VITE_API_*` env vars resolve to, or `127.0.0.1:<port>`
per service by default. Copy `.env.example` to `.env.local` and override only
the services you're actually running locally — see the comments in that file
for each service's default port.

```bash
npm run build       # production build (Nitro server + client bundle)
npm run preview     # serve the production build locally
npm run typecheck   # vue-tsc, no emit
npm run lint         # eslint over .js/.ts/.vue
npm run codegen      # regenerate api/__generated__ from the hub GraphQL schema
```

`npm run typecheck` and `npm run lint` are required CI gates (see
`.github/workflows/ci.yml`) — a failing one blocks the Docker build/deploy.

**Never hand-edit anything under `api/__generated__/`** — it's
`graphql-codegen` output; change the query/schema and re-run `npm run
codegen` instead.

## Directory map

```
pages/          File-based routes — see Routing below.
layouts/        Just default.vue today; layout choice is currently decided
                by path-regex inside it (QUIET_FOOTER / WORKSPACE_PAGE /
                PRICING_PAGE), not definePageMeta({ layout }).
components/     ui/ = design-system primitives; the rest are feature-scoped
                folders (atrace/, menu/, contacts/, ...) or App*.vue (global
                chrome: AppHeader, AppFooter, ...).
composables/    Cross-cutting client logic: auth, per-service app tokens
                (useAtraceToken/useMenuToken/...), namespace selection,
                analytics, modals.
api/            One subfolder per backend service (hub/atrace/contacts/menu/
                tasks/goods/plans/capital), each file wrapping one GraphQL
                operation. api/clients.ts holds the shared ApiClient class,
                the 8 service clients, and all per-request auth state.
utils/          Pure helpers (formatting, sanitizing, site URL resolution,
                image compression, etc.) — auto-imported by Nuxt.
middleware/     Global route guards: auth.global.ts (session bootstrap),
                namespace.global.ts (namespace param validation),
                device-init.global.ts, admin.ts / console-access.ts (role
                gates for /console), performance.global.ts.
plugins/        App-wide client/universal plugins (amplitude, leaflet setup,
                accessibility, web-vitals, chunk-reload recovery, ...).
server/         Nitro-side code — see docs/server.md.
locales/        ru.json / en.json / kk.json for the hand-rolled useI18n()
                composable (not @nuxtjs/i18n). ru is the most complete
                locale; en/kk currently lag behind it (see
                FRONTEND_AUDIT.md I1/I2) and t() returns '' on a miss, so a
                gap shows up as blank UI text rather than an error.
config/         Static app/product registries (config/apps.ts is the single
                source of truth for what products exist, their routes,
                icons, bundle codes), business types, board/tour presets.
types/          Hand-written ambient types not covered by codegen.
mock/           A few files of static mock data genuinely used at runtime
                (e.g. mock/contacts-clients.ts) — not test fixtures, don't
                delete without checking call sites first.
```

## Routing conventions

- `/<namespace>/<product>/...` — the authenticated workspace for a tenant
  (`pages/[namespace]/{atrace,menu,goods,contacts,issues,plans}/...`).
  `middleware/namespace.global.ts` validates the `namespace` param and syncs
  it into global state.
- `/to/<namespace>/<product>/...` — the *public* side of a product for that
  tenant: storefronts, public order pages, the Atrace public post page, etc.
  Some of these routes intentionally opt out of SSR (`routeRules['/to/*/atrace/**']
  = { ssr: false }` in `nuxt.config.ts`) because they're WebSocket-driven live
  state; others (`/to/*/menu/**`) stay SSR for crawlable per-tenant SEO.
- `/console/...` — the internal admin console. Gated by `middleware/admin.ts`
  (roles 0/1) and `middleware/console-access.ts` (also admits role 2 for a
  narrower subset). Not tenant-scoped.
- Top-level marketing/public routes (`/`, `/catalog`, `/stores`, `/feed`,
  `/guide/**`, `/[category]/[slug]`, ...) are plain file-based pages.
- `[namespace]/bundles.vue` and the various `plans.vue`/`memberships.vue`
  pages are per-app billing surfaces; some of that is already consolidated
  behind `useAppPlansPage`/`AppPlansPage.vue`, more is still duplicated per
  product (`FRONTEND_AUDIT.md` C3).

## Auth & per-service tokens

Every backend service the client talks to (hub, atrace, contacts, menu,
tasks/issues, goods, plans, capital) has its own bearer token and its own
`*Authorization` GraphQL header, issued by exchanging the hub session token
via that service's `getAppToken` mutation. `api/clients.ts` centralizes:

- one `ApiClient` per service (`hubClient`, `atraceClient`, ...) that attaches
  the right header and retries once on a 401 after invoking that service's
  registered "unauthorized" handler (see `set*UnauthorizedHandler`);
- per-service token storage via `useState` (request-scoped, never cached in
  module scope — see the comment at the top of that file for why that
  matters on SSR) and setters (`set*AppToken`);
- `composables/useAppToken.ts` is the shared factory behind
  `useAtraceToken`/`useMenuToken`/`useTasksToken`/`useGoodsToken`/
  `usePlansToken`/`useContactsToken` — it owns the actual exchange-with-hub-
  token flow, cookie persistence, TTL-based refresh, and in-flight
  deduplication per namespace.

Patron (B2C) auth is a separate, namespace-less identity handled by
`composables/usePatronAuth.ts`.

## Known issues / roadmap

`FRONTEND_AUDIT.md` at the repo root is a standing technical audit (data
fetching architecture, type safety, testing, a11y, security, etc.) with a
prioritized fix plan — check it before assuming something odd in the code is
undocumented or unknown.
