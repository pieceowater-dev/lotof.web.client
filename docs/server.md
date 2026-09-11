# `server/` — the Nitro layer

Everything under `server/` runs on the Nitro server (Node), never in the
browser. It's small (16 files) but mixes three different jobs; this doc is
the map `FRONTEND_AUDIT.md` N3 asks for.

## `server/api/**` — internal BFF endpoints

Called by the client itself (via `$fetch('/api/...')`), not by anything
external. Each is a thin Nitro `defineEventHandler`.

| Route | Purpose |
|---|---|
| `api/analytics/collect.post.ts` | First-party proxy for Amplitude event ingestion. Ad blockers block `amplitude.com` by domain regardless of client-side config; routing through this same-origin path means the SDK never makes a request to a domain an ad blocker recognizes. Amplitude's HTTP API v2 takes the `api_key` in the JSON body, not a header, so this is a transparent passthrough with no server-side secret involved. |
| `api/atrace/members/*`, `api/atrace/plans/limits.ts` | Server-side helpers that call `atrace.gtw`'s GraphQL API directly (reading the `auth_token` cookie / `authorization` header) rather than going through `api/clients.ts`'s client-side `ApiClient`. Pre-date the `/api-atrace/**` proxy route rule for some call sites. |
| `api/atrace/qr/stream.get.ts` | Upgrades to a WebSocket and proxies it to the Atrace backend's own WS stream (QR/live-scan updates), via the `ws` package and `toWsUrl()`. |
| `api/client-overflow-log.post.ts` | Accepts a client-reported error/overflow payload and `console.log`s it server-side (ends up in the pod's stdout logs). |
| `api/publications/all.get.ts` | Public-publications listing, calling the hub/menu backend and mapping category enums both ways (`toGqlCategory`/`fromGqlCategory`). Backs `/news`, `/feed`, `console/publications`. |

## `server/routes/**` — public-facing routes

Not prefixed `/api`; these are real URLs a browser or crawler hits directly.

| Route | Purpose |
|---|---|
| `routes/robots.txt.get.ts` | Served dynamically (not a static `public/robots.txt`) so the `Sitemap:` line reflects the request's actual host — `lota.kz/robots.txt` advertises `lota.kz/sitemap.xml`, `lota.tools` advertises its own. Falls back to `NUXT_PUBLIC_SITE_URL`, then `DEFAULT_SITE_URL` (`utils/siteUrl.ts`). |
| `routes/sitemap.xml.get.ts` | Same host-awareness, built from the live publications list. |
| `routes/l/[code].get.ts` | Deep-link resolver — looks up a short code via the hub API and redirects into the right app/route (`config/apps.ts` has the app registry it maps into). |
| `routes/r/[code].get.ts` | Referral links (`domain/r/<namespace-slug>`): sets an attribution cookie tagging the visitor with the referring namespace, then redirects home. No backend validation of the slug at this point — an unknown/stale one just means no referral gets recorded at signup (see `hub.msvc.namespaces` `CreateNamespace`), not a dead end for the visitor. |
| `routes/publication/[publicationId]/[filename].get.ts` | On-the-fly image re-encoding for publication hero images via `sharp` — re-encodes to WebP and caps width, since uploads come in at whatever resolution the author's phone produced. This is the **only** place `sharp` is used; it does not appear in the client bundle (verified: `grep -rl sharp .output/public/_nuxt` finds nothing after a prod build). |

## `server/plugins/**` — Nitro plugins

| Plugin | Purpose |
|---|---|
| `deferMapsCss.ts` | Nuxt's build-time chunk manifest links the Leaflet stylesheet on every page, not just the two components that actually render a map. Defers/strips that link outside those pages so it isn't render-blocking dead weight everywhere else. |
| `forwarded-host.ts` | The `/api-*` route-rule proxies target a fixed backend origin; h3's proxy strips the original `Host` and doesn't add `X-Forwarded-Host`, so the gateway behind it can't tell which public host (lota.tools vs. the lota.kz mirror) the request actually came in on — this plugin adds that header so OAuth redirect URIs and cookie scoping land on the right domain. |

## `server/utils/publications.ts`

Shared helpers for reading/writing publication documents (used by both
`server/api/publications/all.get.ts` and the editor-facing console routes) —
not auto-imported into the client, only into other `server/` code.

## What's *not* here

Regular backend calls from pages/components go through `api/clients.ts`
(`ApiClient` + the 8 service clients) straight to the `/api-<service>/**`
proxy route rules defined in `nuxt.config.ts`, which forward to each
service's gateway. `server/api/**` above is only for the handful of cases
that need Nitro-side logic (streaming, image processing, host-aware
metadata, third-party proxying) that a pure client→gateway GraphQL call
can't do.
