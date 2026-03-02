import { gql, GraphQLClient } from 'graphql-request';

// Bonus Balance
export interface BonusBalance {
  clientId: string;
  totalBonuses: number;
  availableBonuses: number;
  expiringSoon: number;
  updatedAt: string;
}

const BONUS_BALANCE_QUERY = gql`
  query GetBonusBalance($clientId: ID!) {
    bonusBalance(clientId: $clientId) {
      clientId
      totalBonuses
      availableBonuses
      expiringSoon
      updatedAt
    }
  }
`;

export async function getBonusBalance(
  token: string,
  clientId: string
): Promise<BonusBalance | null> {
  try {
    const endpoint = `${window.location.protocol}//${window.location.hostname}:8082/query`;
    const client = new GraphQLClient(endpoint, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await client.request<{ bonusBalance: BonusBalance }>(BONUS_BALANCE_QUERY, {
      clientId,
    });

    return data.bonusBalance;
  } catch (error) {
    console.error('Error fetching bonus balance:', error);
    return null;
  }
}

// Client Tier
export interface Tier {
  id: string;
  name: string;
  description: string;
  level: number;
  status: string;
  qualificationCriteria: string;
  qualificationThreshold: number;
  bonusMultiplier: number;
  benefitsJson: string;
  colorHex: string;
  iconUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface ClientTier {
  id: string;
  clientId: string;
  tierId: string;
  currentValue: number;
  nextTierThreshold: number;
  achievedAt: string;
  updatedAt: string;
}

const CLIENT_TIER_QUERY = gql`
  query GetClientTier($clientId: ID!) {
    clientTier(clientId: $clientId) {
      id
      clientId
      tierId
      currentValue
      nextTierThreshold
      achievedAt
      updatedAt
    }
  }
`;

export async function getClientTier(
  token: string,
  clientId: string
): Promise<ClientTier | null> {
  try {
    const endpoint = `${window.location.protocol}//${window.location.hostname}:8082/query`;
    const client = new GraphQLClient(endpoint, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await client.request<{ clientTier: ClientTier }>(CLIENT_TIER_QUERY, {
      clientId,
    });

    return data.clientTier;
  } catch (error) {
    console.error('Error fetching client tier:', error);
    return null;
  }
}

// Stamp Cards
export interface StampCard {
  id: string;
  name: string;
  description: string | null;
  type: string;
  status: string;
  totalStamps: number;
  rewardDescription: string;
  validFrom: string | null;
  validUntil: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClientStampProgress {
  id: string;
  clientId: string;
  stampCardId: string;
  currentStamps: number;
  completedRounds: number;
  lastStampAt: string | null;
  stampCard: StampCard | null;
}

const STAMP_CARDS_QUERY = gql`
  query GetStampCards($filter: DefaultFilterInput) {
    stampCards(filter: $filter) {
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

const CLIENT_STAMP_PROGRESS_QUERY = gql`
  query GetClientStampProgress($clientId: ID!, $stampCardId: ID!) {
    clientStampProgress(clientId: $clientId, stampCardId: $stampCardId) {
      id
      clientId
      stampCardId
      currentStamps
      completedRounds
      lastStampAt
      stampCard {
        id
        name
        description
        type
        status
        totalStamps
        rewardDescription
        validFrom
        validUntil
      }
    }
  }
`;

export async function getStampCards(
  token: string
): Promise<StampCard[]> {
  try {
    const endpoint = `${window.location.protocol}//${window.location.hostname}:8082/query`;
    const client = new GraphQLClient(endpoint, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await client.request<{ stampCards: { rows: StampCard[] } }>(STAMP_CARDS_QUERY, {
      filter: { status: 'ACTIVE' }
    });

    return data.stampCards.rows;
  } catch (error) {
    console.error('Error fetching stamp cards:', error);
    return [];
  }
}

export async function getClientStampProgress(
  token: string,
  clientId: string,
  stampCardId: string
): Promise<ClientStampProgress | null> {
  try {
    const endpoint = `${window.location.protocol}//${window.location.hostname}:8082/query`;
    const client = new GraphQLClient(endpoint, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await client.request<{ clientStampProgress: ClientStampProgress }>(
      CLIENT_STAMP_PROGRESS_QUERY,
      { clientId, stampCardId }
    );

    return data.clientStampProgress;
  } catch (error) {
    console.error('Error fetching client stamp progress:', error);
    return null;
  }
}
