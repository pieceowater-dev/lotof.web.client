import { hubClient, setGlobalAuthToken } from '@/api/clients';

type PrecheckResp = {
  isAppInNamespace?: {
    id?: string | null;
    namespaceID?: string | null;
    appBundle?: string | null;
  } | null;
  namespaces?: {
    rows?: Array<{ id: string; slug: string }>
  } | null;
};

type AddResp = {
  addAppToNamespace: {
    id: string;
    namespaceID: string;
    appBundle: string;
  };
};

const PRECHECK_QUERY = /* GraphQL */ `
  query PreflightInstall($namespaceSlug: String!, $appBundle: String!) {
    isAppInNamespace(namespaceSlug: $namespaceSlug, appBundle: $appBundle) {
      id
      namespaceID
      appBundle
    }
    namespaces(filter: { search: $namespaceSlug, pagination: { page: 1, length: TEN } }) {
      rows { id slug }
    }
  }
`;

const ADD_MUTATION = /* GraphQL */ `
  mutation AddAppToNamespace($namespaceId: ID!, $appBundle: String!) {
    addAppToNamespace(namespaceId: $namespaceId, appBundle: $appBundle) {
      id
      namespaceID
      appBundle
    }
  }
`;

const NS_ONLY_QUERY = /* GraphQL */ `
  query PreflightNamespace($namespaceSlug: String!) {
    namespaces(filter: { search: $namespaceSlug, pagination: { page: 1, length: TEN } }) {
      rows { id slug }
    }
  }
`;

/**
 * Adds an app to the given namespace.
 * Contract:
 *  - inputs: token, namespaceSlug, appBundle
 *  - does: preflight query to obtain namespaceID via isAppInNamespace, then executes addAppToNamespace
 *  - returns: created link { id, namespaceID, appBundle }
 */
export async function hubAddAppToNamespace(
  token: string,
  namespaceSlug: string,
  appBundle: string
) {
  setGlobalAuthToken(token);

  let namespaceId: string | undefined;
  try {
    const pre = await hubClient.request<PrecheckResp>(PRECHECK_QUERY, { namespaceSlug, appBundle });
    namespaceId = pre?.isAppInNamespace?.namespaceID ??
      pre?.namespaces?.rows?.find?.(r => r.slug === namespaceSlug)?.id ?? undefined;
  } catch (err: any) {
    // Fallback: some servers may 400 on combined query; try namespaces-only query
    try {
      const nsOnly = await hubClient.request<PrecheckResp>(NS_ONLY_QUERY, { namespaceSlug });
      namespaceId = nsOnly?.namespaces?.rows?.find?.(r => r.slug === namespaceSlug)?.id ?? undefined;
    } catch (fallbackErr) {
      // If both fail, attempt to glean from partial data
      const data = err?.response?.data as PrecheckResp | undefined;
      namespaceId = data?.isAppInNamespace?.namespaceID ?? undefined;
      if (!namespaceId) {
        // Final fallback: try resolve from local composable cache
        try {
          const { useNamespace } = await import('@/composables/useNamespace');
          const { idBySlug } = useNamespace();
          namespaceId = idBySlug(namespaceSlug);
        } catch {}
        if (!namespaceId) throw err; // rethrow original if unresolved
      }
    }
  }

  if (!namespaceId) {
    throw new Error('Failed to resolve namespace ID from isAppInNamespace');
  }

  const added = await hubClient.request<AddResp>(ADD_MUTATION, { namespaceId, appBundle });
  return added.addAppToNamespace;
}
