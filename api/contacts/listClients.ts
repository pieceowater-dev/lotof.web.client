import { contactsClient, setContactsAppToken } from '../clients';

export interface Tag {
  id: string;
  name: string;
}

export interface ClientRow {
  client: {
    id: string;
    shortId?: string;
    clientType: 'INDIVIDUAL' | 'LEGAL';
    status: 'ACTIVE' | 'ARCHIVED' | 'BLOCKED';
    createdAt: string;
    updatedAt: string;
  };
  individual?: {
    firstName: string;
    lastName: string;
    middleName?: string;
    birthDate?: string;
    gender?: boolean | null;
  };
  legalEntity?: {
    legalName: string;
    brandName?: string;
    binIin?: string;
    registrationCountry?: string;
    registrationDate?: string;
  };
  tags: Tag[];
}

export interface ClientsListResponse {
  clients: {
    rows: ClientRow[];
    info: {
      count: number;
    };
  };
}

const LIST_CLIENTS_QUERY = /* GraphQL */ `
  query ListClients($filter: ClientFilterInput) {
    clients(filter: $filter) {
      rows {
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
      info {
        count
      }
    }
  }
`;

export async function contactsListClients(
  contactsToken: string,
  namespaceSlug: string,
  filter?: any
): Promise<ClientsListResponse['clients']> {
  setContactsAppToken(contactsToken);

  const data = await contactsClient.request<ClientsListResponse>(LIST_CLIENTS_QUERY as any, {
    filter,
  }, {
    headers: { Namespace: namespaceSlug },
  });

  return data.clients;
}
