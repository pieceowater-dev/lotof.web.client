import { GraphQLClient } from 'graphql-request';
import { getApiBaseUrl } from '@/utils/api-base';

// Reads the namespace-less Patron identity (see hub.gtw's PatronAuthService)
// from the Menu storefront gateway. Deliberately its own tiny client rather
// than reusing api/menu/public/storefront.ts's freshClient() -- this call is
// identity-scoped (Authorization: Bearer <patron token>), not tenant-scoped
// (Namespace header), so it has nothing in common with those reads.

export interface PatronMe {
  id: string;
  name: string | null;
  email: string;
}

const PatronMeDocument = /* GraphQL */ `
  query PatronMe {
    patronMe {
      id
      name
      email
    }
  }
`;

export async function getPatronMe(patronToken: string): Promise<PatronMe | null> {
  const client = new GraphQLClient(`${getApiBaseUrl('menu')}/query`, {
    credentials: 'omit' as any,
    headers: { Authorization: `Bearer ${patronToken}` } as any,
  });

  const res = await client.request<{ patronMe: PatronMe | null }>(PatronMeDocument);
  return res.patronMe;
}

export interface PatronOrder {
  id: string;
  number: number;
  status: string;
  totalAmount: number;
  createdAt: string;
}

const PatronOrdersDocument = /* GraphQL */ `
  query PatronOrders {
    patronOrders {
      rows {
        id
        number
        status
        totalAmount
        createdAt
      }
    }
  }
`;

// patronOrders is tenant-scoped (menu.msvc.core is schema-per-namespace), so
// unlike getPatronMe this needs the Namespace header too -- it answers "my
// orders at THIS storefront," not a cross-storefront history.
export async function getPatronOrders(patronToken: string, namespaceSlug: string): Promise<PatronOrder[]> {
  const client = new GraphQLClient(`${getApiBaseUrl('menu')}/query`, {
    credentials: 'omit' as any,
    headers: { Authorization: `Bearer ${patronToken}`, Namespace: namespaceSlug } as any,
  });

  const res = await client.request<{ patronOrders: { rows: PatronOrder[] } }>(PatronOrdersDocument);
  return res.patronOrders.rows;
}
