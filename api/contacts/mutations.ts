import { contactsClient, setGlobalAuthToken } from '../clients';
import type { ClientsListResponse, ClientRow } from './listClients';

const CREATE_INDIVIDUAL_CLIENT_MUTATION = /* GraphQL */ `
  mutation CreateIndividualClient($input: CreateIndividualClientInput!) {
    createIndividualClient(input: $input) {
      client {
        id
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
    }
  }
`;

const CREATE_LEGAL_ENTITY_CLIENT_MUTATION = /* GraphQL */ `
  mutation CreateLegalEntityClient($input: CreateLegalEntityClientInput!) {
    createLegalEntityClient(input: $input) {
      client {
        id
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
    }
  }
`;

const UPDATE_CLIENT_STATUS_MUTATION = /* GraphQL */ `
  mutation UpdateClientStatus($id: ID!, $status: ClientStatus!) {
    updateClientStatus(id: $id, status: $status) {
      id
      clientType
      status
      createdAt
      updatedAt
    }
  }
`;

export interface CreateIndividualClientInput {
  individual: {
    firstName: string;
    lastName: string;
    middleName?: string;
    birthDate?: string;
    gender?: string;
  };
  status?: 'ACTIVE' | 'ARCHIVED' | 'BLOCKED';
}

export interface CreateLegalEntityClientInput {
  legalEntity: {
    legalName: string;
    brandName?: string;
    binIin?: string;
    registrationCountry?: string;
    registrationDate?: string;
  };
  status?: 'ACTIVE' | 'ARCHIVED' | 'BLOCKED';
}

export async function contactsCreateIndividualClient(
  token: string,
  namespaceSlug: string,
  input: CreateIndividualClientInput
): Promise<ClientRow> {
  setGlobalAuthToken(token);

  const response = await contactsClient.request<{ createIndividualClient: ClientRow }>(
    CREATE_INDIVIDUAL_CLIENT_MUTATION as any,
    { input },
    { headers: { Namespace: namespaceSlug } }
  );

  return response.createIndividualClient;
}

export async function contactsCreateLegalEntityClient(
  token: string,
  namespaceSlug: string,
  input: CreateLegalEntityClientInput
): Promise<ClientRow> {
  setGlobalAuthToken(token);

  const response = await contactsClient.request<{ createLegalEntityClient: ClientRow }>(
    CREATE_LEGAL_ENTITY_CLIENT_MUTATION as any,
    { input },
    { headers: { Namespace: namespaceSlug } }
  );

  return response.createLegalEntityClient;
}

export async function contactsUpdateClientStatus(
  token: string,
  namespaceSlug: string,
  id: string,
  status: 'ACTIVE' | 'ARCHIVED' | 'BLOCKED'
): Promise<any> {
  setGlobalAuthToken(token);

  const response = await contactsClient.request<{
    updateClientStatus: {
      id: string;
      clientType: string;
      status: string;
      createdAt: string;
      updatedAt: string;
    };
  }>(UPDATE_CLIENT_STATUS_MUTATION as any, {
    id,
    status,
  }, {
    headers: { Namespace: namespaceSlug },
  });

  return response.updateClientStatus;
}
