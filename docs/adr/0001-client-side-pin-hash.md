# 0001: Client hashes the atrace post PIN with MD5 before sending it

**Status:** accepted, with known follow-up work (see Consequences)

## Context

`components/Card.vue` runs `CryptoJS.MD5(pin).toString()` on a 4–6 digit PIN
before sending it to `atrace.gtw`. Read on its own this looks like "broken
crypto masquerading as security" (`FRONTEND_AUDIT.md` L1) — MD5 is broken,
and hashing a short numeric PIN client-side adds no real protection (rainbow
table lookup is instant).

## Decision

The MD5 hash is not a security control — it's the wire format the backend
protocol expects. In `lotof.atrace.msvc.tracker`:

- `Post.Phrase` is stored as an MD5 hash (`post.svc.go:48`).
- `RecordService.GenerateQR` compares the client-sent string against that
  stored hash **as-is** (`record.svc.go:297`), via
  `subtle.ConstantTimeCompare`, with a lockout after repeated failed
  attempts (`pinLockoutMaxAttempts` / `pinLockoutDuration`).

So the client is required to send an MD5 hash because that's the value the
backend was built to compare against — not because hashing it client-side
makes it safer. Removing the client-side MD5 call in isolation breaks QR
generation and the post checkout screen; it does not improve security
(the real weaknesses are described in Consequences).

## Consequences

- **Do not remove the client-side `MD5(pin)` call without a matching
  backend change.** It's a protocol requirement, not defense.
- Real, separate problems worth fixing (cross-repo, backend-led):
  1. **The hash is equivalent to a password.** A DB leak hands out
     ready-to-use "secrets"; a 6-digit PIN's MD5 is a rainbow-table lookup
     away regardless.
  2. **The secret travels as a WS query parameter**
     (`pages/to/[namespace]/atrace/post/[postid].vue:224-231`,
     `getApiWsUrl(...)`), which means it lands in proxy/load-balancer
     access logs — a leak independent of the hash algorithm's strength.
  3. **Two backend endpoints disagree**: `GenerateQR` expects an
     already-hashed value; `CheckRecord`'s `MethodPostPhrase` branch
     (`record.svc.go:174`) hashes the raw value itself. Same entity, two
     incompatible conventions.
- Fix, in order: server-side hash on bcrypt/argon2 with a salt; raw PIN
  over TLS in the request body, never in a URL/query string; only then
  drop the client-side MD5 call and the `crypto-js` dependency it exists
  for (`FRONTEND_AUDIT.md` K2).
