import { contactsClient, setContactsAppToken } from '../clients';
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

const UPDATE_INDIVIDUAL_CLIENT_MUTATION = /* GraphQL */ `
  mutation UpdateIndividualClient($id: ID!, $input: IndividualInput!) {
    updateIndividualClient(id: $id, input: $input) {
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
      tags {
        id
        name
      }
    }
  }
`;

const UPDATE_LEGAL_ENTITY_CLIENT_MUTATION = /* GraphQL */ `
  mutation UpdateLegalEntityClient($id: ID!, $input: LegalEntityInput!) {
    updateLegalEntityClient(id: $id, input: $input) {
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
      tags {
        id
        name
      }
    }
  }
`;

export interface CreateIndividualClientInput {
  individual: {
    firstName: string;
    lastName: string;
    middleName?: string;
    birthDate?: string;
    gender?: boolean | null;
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
  contactPerson?: {
    firstName: string;
    lastName?: string;
    middleName?: string;
    birthDate?: string;
    gender?: boolean | null;
  };
  status?: 'ACTIVE' | 'ARCHIVED' | 'BLOCKED';
}

function normalizeBoolean(value: unknown): boolean | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
  }
  return undefined;
}

function normalizeCreateIndividualInput(input: CreateIndividualClientInput): CreateIndividualClientInput {
  return {
    ...input,
    individual: {
      ...input.individual,
      gender: normalizeBoolean(input.individual.gender),
    },
  };
}

function normalizeCreateLegalEntityInput(input: CreateLegalEntityClientInput): CreateLegalEntityClientInput {
  if (!input.contactPerson) {
    return input;
  }

  return {
    ...input,
    contactPerson: {
      ...input.contactPerson,
      gender: normalizeBoolean(input.contactPerson.gender),
    },
  };
}

export async function contactsCreateIndividualClient(
  token: string,
  namespaceSlug: string,
  input: CreateIndividualClientInput
): Promise<ClientRow> {
  setContactsAppToken(token);
  const normalizedInput = normalizeCreateIndividualInput(input);

  const response = await contactsClient.request<{ createIndividualClient: ClientRow }>(
    CREATE_INDIVIDUAL_CLIENT_MUTATION as any,
    { input: normalizedInput },
    { headers: { Namespace: namespaceSlug } }
  );

  return response.createIndividualClient;
}

export async function contactsCreateLegalEntityClient(
  token: string,
  namespaceSlug: string,
  input: CreateLegalEntityClientInput
): Promise<ClientRow> {
  setContactsAppToken(token);
  const normalizedInput = normalizeCreateLegalEntityInput(input);

  const response = await contactsClient.request<{ createLegalEntityClient: ClientRow }>(
    CREATE_LEGAL_ENTITY_CLIENT_MUTATION as any,
    { input: normalizedInput },
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
  setContactsAppToken(token);

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

export async function contactsUpdateIndividualClient(
  token: string,
  namespaceSlug: string,
  id: string,
  input: CreateIndividualClientInput['individual']
): Promise<ClientRow> {
  setContactsAppToken(token);

  const response = await contactsClient.request<{ updateIndividualClient: ClientRow }>(
    UPDATE_INDIVIDUAL_CLIENT_MUTATION as any,
    { id, input: { ...input, gender: normalizeBoolean(input.gender) } },
    { headers: { Namespace: namespaceSlug } }
  );

  return response.updateIndividualClient;
}

export async function contactsUpdateLegalEntityClient(
  token: string,
  namespaceSlug: string,
  id: string,
  input: CreateLegalEntityClientInput['legalEntity']
): Promise<ClientRow> {
  setContactsAppToken(token);

  const response = await contactsClient.request<{ updateLegalEntityClient: ClientRow }>(
    UPDATE_LEGAL_ENTITY_CLIENT_MUTATION as any,
    { id, input },
    { headers: { Namespace: namespaceSlug } }
  );

  return response.updateLegalEntityClient;
}
