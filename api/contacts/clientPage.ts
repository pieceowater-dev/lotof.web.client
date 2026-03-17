import { gql } from 'graphql-request';
import { contactsClient, setContactsAppToken } from '../clients';
import type { ClientRow } from './listClients';
import type { ClientIdentity } from './identities';
import type { ClientEvent } from './events';
import type { Tag } from './tags';
import type { BonusBalance, StampCard } from './loyalty';

interface ClientPageDataResponse {
  client?: ClientRow;
  clientByShortId?: ClientRow;
  clientIdentities?: {
    rows: ClientIdentity[];
  };
  clientTags?: {
    tags: Tag[];
  };
  clientEvents?: {
    rows: ClientEvent[];
  };
  bonusBalance?: BonusBalance | null;
  stampCards?: {
    rows: StampCard[];
  };
}

export interface ClientPageData {
  client: ClientRow | null;
  identities: ClientIdentity[];
  tags: Tag[];
  events: ClientEvent[];
  bonusBalance: BonusBalance | null;
  stampCards: StampCard[];
}

const CLIENT_PAGE_DATA_QUERY = gql`
  query ClientPageData(
    $id: ID!
    $shortId: String!
    $isUuid: Boolean!
    $clientIdForRelated: ID!
    $eventsLimit: Int!
    $eventsOffset: Int!
  ) {
    client(id: $id) @include(if: $isUuid) {
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
      tags {
        id
        name
      }
    }

    clientByShortId(shortId: $shortId) @skip(if: $isUuid) {
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
      tags {
        id
        name
      }
    }

    clientIdentities(clientId: $clientIdForRelated) {
      rows {
        id
        clientId
        type
        value
        isPrimary
        comments
        verifiedAt
      }
    }

    clientTags(clientId: $clientIdForRelated) {
      tags {
        id
        name
      }
    }

    clientEvents(clientId: $clientIdForRelated, limit: $eventsLimit, offset: $eventsOffset) {
      rows {
        id
        clientId
        eventType
        payload
        createdAt
      }
    }

    bonusBalance(clientId: $clientIdForRelated) {
      clientId
      totalBonuses
      availableBonuses
      expiringSoon
      updatedAt
    }

    stampCards {
      rows {
        id
        name
        description
        type
        status
        totalStamps
        rewardDescription
        validFrom
        validUntil
        createdAt
        updatedAt
      }
    }
  }
`;

function isUUID(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function getClientPageData(
  token: string,
  namespaceSlug: string,
  idOrShortId: string,
  eventsLimit = 50,
  eventsOffset = 0,
): Promise<ClientPageData> {
  if (!token) throw new Error('Token is required');

  setContactsAppToken(token);

  const isUuid = isUUID(idOrShortId);
  const clientIdForRelated = isUuid ? idOrShortId : '00000000-0000-0000-0000-000000000000';

  const data = await contactsClient.request<ClientPageDataResponse>(
    CLIENT_PAGE_DATA_QUERY,
    {
      id: idOrShortId,
      shortId: idOrShortId,
      isUuid,
      clientIdForRelated,
      eventsLimit,
      eventsOffset,
    },
    {
      headers: { Namespace: namespaceSlug },
    },
  );

  let resolvedClient = data.client || data.clientByShortId || null;
  let identities = data.clientIdentities?.rows || [];
  let tags = data.clientTags?.tags || resolvedClient?.tags || [];
  let events = data.clientEvents?.rows || [];
  let bonusBalance = data.bonusBalance || null;
  let stampCards = data.stampCards?.rows || [];

  if (!isUuid && resolvedClient?.client.id) {
    const resolvedId = resolvedClient.client.id;
    const fullData = await contactsClient.request<ClientPageDataResponse>(
      CLIENT_PAGE_DATA_QUERY,
      {
        id: resolvedId,
        shortId: resolvedId,
        isUuid: true,
        clientIdForRelated: resolvedId,
        eventsLimit,
        eventsOffset,
      },
      {
        headers: { Namespace: namespaceSlug },
      },
    );

    resolvedClient = fullData.client || resolvedClient;
    identities = fullData.clientIdentities?.rows || [];
    tags = fullData.clientTags?.tags || resolvedClient?.tags || [];
    events = fullData.clientEvents?.rows || [];
    bonusBalance = fullData.bonusBalance || null;
    stampCards = fullData.stampCards?.rows || [];
  }

  const resolvedClientId = resolvedClient?.client.id || '';

  identities = identities.filter((item) => item.clientId === resolvedClientId);
  events = events.filter((item) => item.clientId === resolvedClientId);

  return {
    client: resolvedClient,
    identities,
    tags,
    events,
    bonusBalance,
    stampCards,
  };
}
