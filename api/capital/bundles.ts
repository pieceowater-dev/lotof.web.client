import { capitalClient, setGlobalAuthToken } from '@/api/clients';

// A bundle is one priced offer covering several applications at once. Activating
// it fans out into one ordinary per-app subscription per member application
// (each tagged with the bundle code), so every app's plan limits / active
// subscription keep working unchanged. See lotof.capital.msvc.billing bundle
// module + capital.gtw billing schema.

export type BundleItem = {
  applicationCode: string;
  planCode: string;
  planName: string;
};

export type Bundle = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  currency: string;
  interval: 'MONTH' | 'YEAR';
  amountCents: number;
  trialDays: number;
  status: string; // ACTIVE | ARCHIVED
  metadataJson?: string | null;
  items: BundleItem[];
};

export type ActivateBundlePayload = {
  success: boolean;
  message: string;
  error?: string | null;
  results: Array<{ applicationCode: string; planCode: string; subscriptionId: string; status: string }>;
};

export type CancelBundlePayload = {
  success: boolean;
  message: string;
  error?: string | null;
  canceledCount: number;
};

const BUNDLE_FIELDS = /* GraphQL */ `
  id
  code
  name
  description
  currency
  interval
  amountCents
  trialDays
  status
  metadataJson
  items { applicationCode planCode planName }
`;

// bundles / activeBundles / activateBundle are @hubAuth on the capital gateway,
// so a hub token (set via setGlobalAuthToken) is all that's needed.

export async function capitalListBundles(token: string, applicationCode?: string): Promise<Bundle[]> {
  setGlobalAuthToken(token);
  const query = /* GraphQL */ `
    query Bundles($applicationCode: String) {
      bundles(applicationCode: $applicationCode) { ${BUNDLE_FIELDS} }
    }
  `;
  const res = await capitalClient.request<{ bundles: Bundle[] }>(query, { applicationCode: applicationCode || null });
  return res.bundles ?? [];
}

export type CapitalPlan = {
  id: string;
  code: string;
  name: string;
  interval: 'MONTH' | 'YEAR';
  amountCents: number;
  trialDays: number;
  metadataJson?: string | null;
};

// capital `plans` is @auth -- usable from the hub-level bundles page (bundle
// comparison table needs each member plan's limits).
export async function capitalListPlans(token: string, applicationCode: string): Promise<CapitalPlan[]> {
  setGlobalAuthToken(token);
  const query = /* GraphQL */ `
    query Plans($applicationCode: String!) {
      plans(applicationCode: $applicationCode) {
        id
        code
        name
        interval
        amountCents
        trialDays
        metadataJson
      }
    }
  `;
  const res = await capitalClient.request<{ plans: CapitalPlan[] }>(query, { applicationCode });
  return res.plans ?? [];
}

export async function capitalGetActiveBundles(token: string, namespace: string): Promise<string[]> {
  setGlobalAuthToken(token);
  const query = /* GraphQL */ `
    query ActiveBundles($namespace: String!) {
      activeBundles(namespace: $namespace)
    }
  `;
  const res = await capitalClient.request<{ activeBundles: string[] }>(query, { namespace });
  return res.activeBundles ?? [];
}

export async function capitalActivateBundle(
  token: string,
  namespace: string,
  bundleCode: string,
  paymentMethod: string = 'cash'
): Promise<ActivateBundlePayload> {
  setGlobalAuthToken(token);
  const mutation = /* GraphQL */ `
    mutation ActivateBundle($namespace: String!, $bundleCode: String!, $paymentMethod: String!) {
      activateBundle(namespace: $namespace, bundleCode: $bundleCode, paymentMethod: $paymentMethod) {
        success
        message
        error
        results { applicationCode planCode subscriptionId status }
      }
    }
  `;
  const res = await capitalClient.request<{ activateBundle: ActivateBundlePayload }>(mutation, {
    namespace,
    bundleCode,
    paymentMethod,
  });
  return res.activateBundle;
}

// ── admin (capital.billing.manage) ──────────────────────────────────────────

export async function capitalAdminListBundles(token: string): Promise<Bundle[]> {
  setGlobalAuthToken(token);
  const query = /* GraphQL */ `
    query AdminBundles {
      adminBundles { ${BUNDLE_FIELDS} }
    }
  `;
  const res = await capitalClient.request<{ adminBundles: Bundle[] }>(query);
  return res.adminBundles ?? [];
}

export type CreateBundleInput = {
  code: string;
  name: string;
  description?: string;
  currency: string;
  interval: 'MONTH' | 'YEAR';
  amountCents: number;
  trialDays: number;
  metadataJson?: string;
  items: Array<{ applicationCode: string; planCode: string }>;
};

export async function capitalCreateBundle(token: string, input: CreateBundleInput): Promise<Bundle> {
  setGlobalAuthToken(token);
  const mutation = /* GraphQL */ `
    mutation CreateBundle($input: CreateBundleInput!) {
      createBundle(input: $input) { ${BUNDLE_FIELDS} }
    }
  `;
  const res = await capitalClient.request<{ createBundle: Bundle }>(mutation, { input });
  return res.createBundle;
}

export type UpdateBundleInput = {
  name?: string;
  description?: string;
  amountCents?: number;
  trialDays?: number;
  metadataJson?: string;
  items?: Array<{ applicationCode: string; planCode: string }>;
  replaceItems?: boolean;
};

export async function capitalUpdateBundle(token: string, id: string, input: UpdateBundleInput): Promise<Bundle> {
  setGlobalAuthToken(token);
  const mutation = /* GraphQL */ `
    mutation UpdateBundle($id: String!, $input: UpdateBundleInput!) {
      updateBundle(id: $id, input: $input) { ${BUNDLE_FIELDS} }
    }
  `;
  const res = await capitalClient.request<{ updateBundle: Bundle }>(mutation, { id, input });
  return res.updateBundle;
}

export async function capitalArchiveBundle(token: string, id: string): Promise<Bundle> {
  setGlobalAuthToken(token);
  const mutation = /* GraphQL */ `
    mutation ArchiveBundle($id: String!) {
      archiveBundle(id: $id) { id status }
    }
  `;
  const res = await capitalClient.request<{ archiveBundle: Bundle }>(mutation, { id });
  return res.archiveBundle;
}

// Admin: confirm an out-of-band cash payment and activate the whole bundle for
// a namespace (fan-out). capital.billing.manage gated, no ownership check.
export async function capitalConfirmBundleCashPayment(
  token: string,
  namespace: string,
  bundleCode: string
): Promise<ActivateBundlePayload> {
  setGlobalAuthToken(token);
  const mutation = /* GraphQL */ `
    mutation ConfirmBundleCashPayment($namespace: String!, $bundleCode: String!) {
      confirmBundleCashPayment(namespace: $namespace, bundleCode: $bundleCode) {
        success
        message
        error
        results { applicationCode planCode subscriptionId status }
      }
    }
  `;
  const res = await capitalClient.request<{ confirmBundleCashPayment: ActivateBundlePayload }>(mutation, {
    namespace,
    bundleCode,
  });
  return res.confirmBundleCashPayment;
}

export async function capitalCancelBundle(token: string, namespace: string, bundleCode: string): Promise<CancelBundlePayload> {
  setGlobalAuthToken(token);
  const mutation = /* GraphQL */ `
    mutation CancelBundle($namespace: String!, $bundleCode: String!) {
      cancelBundle(namespace: $namespace, bundleCode: $bundleCode) {
        success
        message
        error
        canceledCount
      }
    }
  `;
  const res = await capitalClient.request<{ cancelBundle: CancelBundlePayload }>(mutation, { namespace, bundleCode });
  return res.cancelBundle;
}
