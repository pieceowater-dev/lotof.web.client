import { gql } from 'graphql-request';
import { contactsClient, setContactsAppToken } from '../clients';
import type { ClientRow } from './listClients';

export interface ClientProfileResponse {
  client?: ClientRow;
  clientByShortId?: ClientRow;
}

const GET_CLIENT_QUERY = gql`
  query GetClient($id: ID!) {
    client(id: $id) {
      client {
        id
        shortId
        clientType
        status
        createdAt
        updatedAt
      }
      individual {
        firstName
        lastName
        middleName
        birthDate
        gender
      }
      legalEntity {
        legalName
        brandName
        binIin
        registrationCountry
        registrationDate
      }
      additionalInfo
    }
  }
`;

const GET_CLIENT_BY_SHORT_ID_QUERY = gql`
  query GetClientByShortId($shortId: String!) {
    clientByShortId(shortId: $shortId) {
      client {
        id
        shortId
        clientType
        status
        createdAt
        updatedAt
      }
      individual {
        firstName
        lastName
        middleName
        birthDate
        gender
      }
      legalEntity {
        legalName
        brandName
        binIin
        registrationCountry
        registrationDate
      }
      additionalInfo
    }
  }
`;

/**
 * Check if string is a UUID (contains dashes)
 */
function isUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

/**
 * Get multiple clients by UUID in a single batched GraphQL request (aliases).
 * Returns a map of id → ClientRow|null.
 */
export async function getClientsBatch(
  contactsToken: string,
  namespaceSlug: string,
  ids: string[],
): Promise<Record<string, ClientRow | null>> {
  if (ids.length === 0) return {};
  setContactsAppToken(contactsToken);

  const fields = `
    client { id shortId clientType status createdAt updatedAt }
    individual { firstName lastName middleName birthDate gender }
    legalEntity { legalName brandName binIin registrationCountry registrationDate }
    additionalInfo
  `;

  const varDecls = ids.map((_, i) => `$id${i}: ID!`).join(', ');
  const aliases = ids.map((_, i) => `c${i}: client(id: $id${i}) { ${fields} }`).join('\n');
  const query = `query BatchGetClients(${varDecls}) { ${aliases} }`;
  const variables = Object.fromEntries(ids.map((id, i) => [`id${i}`, id]));

  const data = await contactsClient.request<Record<string, ClientRow>>(
    query as any,
    variables,
    { headers: { Namespace: namespaceSlug } },
  );

  return Object.fromEntries(ids.map((id, i) => [id, data[`c${i}`] ?? null]));
}

/**
 * Get client by ID (UUID) or shortId (8 characters)
 */
export async function getClient(
  contactsToken: string,
  namespaceSlug: string,
  idOrShortId: string
): Promise<ClientRow | null> {
  setContactsAppToken(contactsToken);

  try {
    if (isUUID(idOrShortId)) {
      // Use UUID query
      const data = await contactsClient.request<ClientProfileResponse>(
        GET_CLIENT_QUERY,
        { id: idOrShortId },
        { headers: { Namespace: namespaceSlug } }
      );
      return data.client || null;
    } else {
      // Use short ID query
      const data = await contactsClient.request<ClientProfileResponse>(
        GET_CLIENT_BY_SHORT_ID_QUERY,
        { shortId: idOrShortId },
        { headers: { Namespace: namespaceSlug } }
      );
      return data.clientByShortId || null;
    }
  } catch (error) {
    console.error('Failed to fetch client:', error);
    return null;
  }
}
