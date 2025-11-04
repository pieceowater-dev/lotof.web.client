import { hubClient, setGlobalAuthToken } from '@/api/clients';

const NAMESPACE_BY_SLUG_QUERY = /* GraphQL */ `
  query NamespaceBySlug($slug: String!) {
    namespaces(filter: { search: $slug, pagination: { page: 1, length: TEN } }) {
      rows {
        id
        title
        slug
        description
        owner
      }
    }
  }
`;

export type Namespace = {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  owner: string;
};

export async function hubNamespaceBySlug(
  token: string,
  slug: string
): Promise<Namespace | null> {
  setGlobalAuthToken(token);
  const data = await hubClient.request<any>(NAMESPACE_BY_SLUG_QUERY, { slug });
  const rows = data?.namespaces?.rows || [];
  const exact = rows.find((ns: Namespace) => ns.slug === slug);
  return exact || rows[0] || null;
}
