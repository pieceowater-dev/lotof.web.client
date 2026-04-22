import type { CodegenConfig } from '@graphql-codegen/cli';

// Multi-service config. Each service outputs its own typed file to keep bundles smaller
// and allow optional services (atrace may appear later).
// Env vars:
//  VITE_API_HUB       - optional hub gateway base URL override
//  VITE_API_ATRACE    - optional atrace gateway base URL override

const hubBaseUrl = process.env.VITE_API_HUB || 'http://localhost:8080';
const atraceBaseUrl = process.env.VITE_API_ATRACE; // optional

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
    config: { avoidOptionals: false }
  };
}

// Note: Do NOT set a global `documents` here. Each service has its own `documents`
// pattern above so that validation is performed against the correct schema only.
const config: CodegenConfig = {
  generates,
  hooks: { afterAllFileWrite: ['prettier --write'] }
};

export default config;

