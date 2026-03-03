import { gql } from 'graphql-request';
import { contactsClient, setContactsAppToken } from '../clients';

export interface ClientIdentity {
  id: string;
  clientId: string;
  type: string;
  value: string;
  isPrimary: boolean;
  comments?: string;
  verifiedAt?: string;
}

export interface IdentityListResponse {
  clientIdentities: {
    rows: ClientIdentity[];
    info: {
      count: number;
    };
  };
}

const CLIENT_IDENTITIES_QUERY = gql`
  query ClientIdentities($clientId: ID!) {
    clientIdentities(clientId: $clientId) {
      rows {
        id
        clientId
        type
        value
        isPrimary
        comments
        verifiedAt
      }
      info {
        count
      }
    }
  }
`;

const CREATE_IDENTITY_MUTATION = gql`
  mutation CreateIdentity($input: CreateIdentityInput!) {
    createIdentity(input: $input) {
      id
      clientId
      type
      value
      isPrimary
      comments
      verifiedAt
    }
  }
`;

const UPDATE_IDENTITY_MUTATION = gql`
  mutation UpdateIdentity($input: UpdateIdentityInput!) {
    updateIdentity(input: $input) {
      id
      clientId
      type
      value
      isPrimary
      comments
      verifiedAt
    }
  }
`;

const DELETE_IDENTITY_MUTATION = gql`
  mutation DeleteIdentity($id: ID!) {
    deleteIdentity(id: $id) {
      success
    }
  }
`;

const VERIFY_IDENTITY_MUTATION = gql`
  mutation VerifyIdentity($input: VerifyIdentityInput!) {
    verifyIdentity(input: $input) {
      success
    }
  }
`;

const SET_PRIMARY_IDENTITY_MUTATION = gql`
  mutation SetPrimaryIdentity($input: SetPrimaryIdentityInput!) {
    setPrimaryIdentity(input: $input) {
      id
      clientId
      type
      value
      isPrimary
      verifiedAt
    }
  }
`;

export async function getClientIdentities(token: string, clientId: string, namespaceSlug?: string) {
  if (!token) throw new Error('Token is required');
  setContactsAppToken(token);
  return contactsClient.request<IdentityListResponse>(CLIENT_IDENTITIES_QUERY, {
    clientId,
  }, namespaceSlug ? {
    headers: { Namespace: namespaceSlug },
  } : undefined);
}

export async function createIdentity(
  token: string,
  namespaceSlug: string,
  clientId: string,
  type: string,
  value: string,
  isPrimary?: boolean,
  comments?: string
) {
  if (!token) throw new Error('Token is required');
  setContactsAppToken(token);
  return contactsClient.request<{ createIdentity: ClientIdentity }>(
    CREATE_IDENTITY_MUTATION,
    {
      input: { clientId, type, value, isPrimary, comments },
    },
    {
      headers: { Namespace: namespaceSlug },
    }
  );
}

export async function updateIdentity(token: string, namespaceSlug: string, id: string, value: string, comments?: string) {
  if (!token) throw new Error('Token is required');
  setContactsAppToken(token);
  return contactsClient.request<{ updateIdentity: ClientIdentity }>(
    UPDATE_IDENTITY_MUTATION,
    {
      input: { id, value, comments },
    },
    {
      headers: { Namespace: namespaceSlug },
    }
  );
}

export async function deleteIdentity(token: string, namespaceSlug: string, id: string) {
  if (!token) throw new Error('Token is required');
  setContactsAppToken(token);
  return contactsClient.request<{ deleteIdentity: { success: boolean } }>(
    DELETE_IDENTITY_MUTATION,
    {
      id,
    },
    {
      headers: { Namespace: namespaceSlug },
    }
  );
}

export async function verifyIdentity(token: string, namespaceSlug: string, id: string) {
  if (!token) throw new Error('Token is required');
  setContactsAppToken(token);
  return contactsClient.request<{ verifyIdentity: { success: boolean } }>(
    VERIFY_IDENTITY_MUTATION,
    {
      input: { id },
    },
    {
      headers: { Namespace: namespaceSlug },
    }
  );
}

export async function setPrimaryIdentity(token: string, namespaceSlug: string, id: string) {
  if (!token) throw new Error('Token is required');
  setContactsAppToken(token);
  return contactsClient.request<{ setPrimaryIdentity: ClientIdentity }>(
    SET_PRIMARY_IDENTITY_MUTATION,
    {
      input: { id },
    },
    {
      headers: { Namespace: namespaceSlug },
    }
  );
}
