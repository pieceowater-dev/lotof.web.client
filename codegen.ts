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

// Note: Do NOT set a global `documents` here. Each service has its own `documents`
// pattern above so that validation is performed against the correct schema only.
const config: CodegenConfig = {
  generates,
  hooks: { afterAllFileWrite: ['prettier --write'] }
};

export default config;

// Add a check to request geolocation only if not already granted
if (navigator.geolocation) {
  navigator.permissions.query({ name: 'geolocation' }).then((permissionStatus) => {
    if (permissionStatus.state === 'prompt') {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log('Geolocation access granted:', position);
        },
        (error) => {
          console.error('Geolocation access denied:', error);
        }
      );
    } else {
      console.log('Geolocation already granted or denied:', permissionStatus.state);
    }
  });
} else {
  console.error('Geolocation is not supported by this browser.');
}
