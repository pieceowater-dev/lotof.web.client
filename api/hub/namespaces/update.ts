import { hubClient, setGlobalAuthToken } from '@/api/clients';

// Rename a namespace (display title only). The slug is immutable server-side
// -- it's the identity key behind tenant schemas, per-app URLs and deep links
// -- so hub.msvc.namespaces ignores any slug sent here and keeps the existing
// one. `NamespaceInput.slug` is still required by the GraphQL schema, so the
// current slug is passed through and simply not applied.
const RENAME_NAMESPACE = /* GraphQL */ `
  mutation RenameNamespace($id: ID!, $input: NamespaceInput!) {
    updateNamespace(id: $id, input: $input) {
      id
      title
      slug
    }
  }
`;

export type RenamedNamespace = { id: string; title: string; slug: string };

export async function hubRenameNamespace(
  token: string,
  id: string,
  currentSlug: string,
  title: string,
): Promise<RenamedNamespace> {
  setGlobalAuthToken(token);
  const data = await hubClient.request<{ updateNamespace: RenamedNamespace }>(RENAME_NAMESPACE, {
    id,
    input: { title: title.trim(), slug: currentSlug },
  });
  return data.updateNamespace;
}
