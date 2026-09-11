import type { CodegenConfig } from '@graphql-codegen/cli';

// Multi-service config. Each service outputs its own typed file to keep bundles smaller
// and allow optional services (atrace may appear later).
// Env vars:
//  VITE_API_HUB       - optional hub gateway base URL override
//  VITE_API_ATRACE    - optional atrace gateway base URL override
//
// Two things confirmed empirically (2026-09-11) that aren't obvious from the
// tool's own logs, worth knowing before running this:
//
// 1. The gateways' GraphQL introspection is OFF by default (see gql.module.go
//    in each *.gtw repo) -- codegen needs a live backend AND
//    ENABLE_PLAYGROUND=true set on that backend's own process env, or every
//    schema load fails with "introspection disabled" regardless of the
//    backend actually being reachable.
// 2. This run is all-or-nothing across every target configured in
//    `generates` below: if e.g. VITE_API_CAPITAL happens to be set in the
//    env but that backend isn't running, capital's schema load fails and
//    NONE of the other targets get written to disk either -- even though
//    the CLI's own per-target log lines say [SUCCESS] for hub/atrace right
//    up until the run as a whole is judged to have failed. Only set the env
//    vars for the services you actually have running locally.

const hubBaseUrl = process.env.VITE_API_HUB || 'http://localhost:8080';
const atraceBaseUrl = process.env.VITE_API_ATRACE; // optional
const capitalBaseUrl = process.env.VITE_API_CAPITAL; // optional

const withQueryPath = (baseUrl: string) => `${baseUrl.replace(/\/$/, '')}/query`;

const plugins = ['typescript', 'typescript-operations', 'typed-document-node'];

const generates: Record<string, any> = {
  'api/__generated__/hub-types.ts': {
    schema: withQueryPath(hubBaseUrl),
    documents: ['api/hub/**/*.gql'],
    plugins,
    config: { avoidOptionals: false, useTypeImports: true }
  }
};

if (atraceBaseUrl) {
  generates['api/__generated__/atrace-types.ts'] = {
    schema: withQueryPath(atraceBaseUrl),
    documents: ['api/atrace/**/*.gql'],
    plugins,
    // useTypeImports: true was missing here (present on hub's config above)
    // -- confirmed by actually running this against a live local atrace.gtw
    // (2026-09-11): without it, the generated `import { TypedDocumentNode
    // as DocumentNode } from ...` isn't a type-only import, and fails
    // typecheck under this project's verbatimModuleSyntax setting the
    // moment anything imports this file. Likely why atrace codegen has
    // stayed off in practice even on the occasions someone tried it.
    config: { avoidOptionals: false, useTypeImports: true }
  };
}

if (capitalBaseUrl) {
  generates['api/__generated__/capital-types.ts'] = {
    schema: withQueryPath(capitalBaseUrl),
    documents: ['api/capital/**/*.gql'],
    plugins,
    // Same useTypeImports gap as atrace above -- not independently verified
    // against a live capital.gtw, but the failure mode is identical (this
    // plugin's output shape doesn't depend on which schema it read).
    config: { avoidOptionals: false, useTypeImports: true }
  };
}

// Note: Do NOT set a global `documents` here. Each service has its own `documents`
// pattern above so that validation is performed against the correct schema only.
const config: CodegenConfig = {
  generates,
  hooks: { afterAllFileWrite: ['prettier --write'] }
};

export default config;

