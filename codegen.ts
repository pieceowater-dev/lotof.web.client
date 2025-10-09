import type { CodegenConfig } from '@graphql-codegen/cli';

// Multi-service config. Each service outputs its own typed file to keep bundles smaller
// and allow optional services (atrace may appear later).
// Env vars:
//  VITE_API_HUB    - hub base URL (required)
//  VITE_API_ATRACE - atrace base URL (optional)

const hubBase = process.env.VITE_API_HUB || 'http://localhost:8080';
const atraceBase = process.env.VITE_API_ATRACE; // optional

const plugins = ['typescript', 'typescript-operations', 'typed-document-node'];

const generates: Record<string, any> = {
  'api/__generated__/hub-types.ts': {
    schema: hubBase + '/query',
    documents: ['api/hub/**/*.gql'],
    plugins,
    config: { avoidOptionals: false, useTypeImports: true }
  }
};

if (atraceBase) {
  generates['api/__generated__/atrace-types.ts'] = {
    schema: atraceBase + '/query',
    documents: ['api/atrace/**/*.gql'],
    plugins,
    config: { avoidOptionals: false }
  };
}

const config: CodegenConfig = {
  documents: ['api/**/*.gql'],
  generates,
  hooks: { afterAllFileWrite: ['prettier --write'] }
};

export default config;
