import { gql } from 'graphql-request';
import { contactsClient, setContactsAppToken } from '../clients';

// Bonus Balance
export interface BonusBalance {
  clientId: string;
  totalBonuses: number;
  availableBonuses: number;
  expiringSoon: number;
  updatedAt: string;
  hasPin?: boolean;
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
    if (!token) throw new Error('Token is required');
    setContactsAppToken(token);

    const data = await contactsClient.request<{ bonusBalance: BonusBalance }>(BONUS_BALANCE_QUERY, {
      clientId,
    });

    return data.bonusBalance;
  } catch (error) {
    console.error('Error fetching bonus balance:', error);
    return null;
  }
}

export interface AddBonusTransactionInput {
  clientId: string;
  transactionType: 'EARNED' | 'SPENT' | 'EXPIRED' | 'ADMIN_ADJUSTMENT';
  reason: 'MANUAL' | 'PURCHASE' | 'VISIT' | 'BIRTHDAY' | 'REGISTRATION' | 'PROMOTION' | 'TIER_BONUS' | 'EXPIRATION';
  amount: number;
  pin?: string;
  description?: string;
  referenceId?: string;
  expiresAt?: string;
  createdBy: string;
}

export interface AddBonusTransactionResult {
  id: string;
  clientId: string;
  amount: number;
  balance: number;
  createdAt: string;
}

const ADD_BONUS_TRANSACTION_MUTATION = gql`
  mutation AddBonusTransaction($input: AddBonusTransactionInput!) {
    addBonusTransaction(input: $input) {
      id
      clientId
      amount
      balance
      createdAt
    }
  }
`;

export async function addBonusTransaction(
  token: string,
  input: AddBonusTransactionInput
): Promise<AddBonusTransactionResult | null> {
  try {
    if (!token) throw new Error('Token is required');
    setContactsAppToken(token);

    const data = await contactsClient.request<{ addBonusTransaction: AddBonusTransactionResult }>(
      ADD_BONUS_TRANSACTION_MUTATION,
      { input },
    );

    return data.addBonusTransaction;
  } catch (error) {
    console.error('Error adding bonus transaction:', error);
    throw error;
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
    if (!token) throw new Error('Token is required');
    setContactsAppToken(token);

    const data = await contactsClient.request<{ clientTier: ClientTier }>(CLIENT_TIER_QUERY, {
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

export type StampCardType = 'COFFEE' | 'MEAL' | 'VISIT' | 'CUSTOM';

export interface CreateStampCardInput {
  name: string;
  description?: string;
  type: StampCardType;
  totalStamps: number;
  rewardDescription: string;
  pin?: string;
  validFrom?: string;
  validUntil?: string;
}

export interface UpdateStampCardInput {
  id: string;
  name?: string;
  description?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  totalStamps?: number;
  rewardDescription?: string;
  pin?: string;
  clearPin?: boolean;
  validFrom?: string;
  validUntil?: string;
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

export interface AddStampInput {
  clientId: string;
  stampCardId: string;
  stampsToAdd: number;
  pin?: string;
  addedBy: string;
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

const CREATE_STAMP_CARD_MUTATION = gql`
  mutation CreateStampCard($input: CreateStampCardInput!) {
    createStampCard(input: $input) {
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
`;

const UPDATE_STAMP_CARD_MUTATION = gql`
  mutation UpdateStampCard($input: UpdateStampCardInput!) {
    updateStampCard(input: $input) {
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
`;

const DELETE_STAMP_CARD_MUTATION = gql`
  mutation DeleteStampCard($id: ID!) {
    deleteStampCard(id: $id) {
      success
    }
  }
`;

const ADD_STAMP_MUTATION = gql`
  mutation AddStamp($input: AddStampInput!) {
    addStamp(input: $input) {
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
    if (!token) throw new Error('Token is required');
    setContactsAppToken(token);

    const data = await contactsClient.request<{ stampCards: { rows: StampCard[] } }>(STAMP_CARDS_QUERY);

    return data.stampCards.rows;
  } catch (error) {
    console.error('Error fetching stamp cards:', error);
    return [];
  }
}

export async function createStampCard(
  token: string,
  input: CreateStampCardInput
): Promise<StampCard | null> {
  try {
    if (!token) throw new Error('Token is required');
    setContactsAppToken(token);

    const data = await contactsClient.request<{ createStampCard: StampCard }>(
      CREATE_STAMP_CARD_MUTATION,
      { input }
    );

    return data.createStampCard;
  } catch (error) {
    console.error('Error creating stamp card:', error);
    return null;
  }
}

export async function updateStampCard(
  token: string,
  input: UpdateStampCardInput
): Promise<StampCard | null> {
  try {
    if (!token) throw new Error('Token is required');
    setContactsAppToken(token);

    const data = await contactsClient.request<{ updateStampCard: StampCard }>(
      UPDATE_STAMP_CARD_MUTATION,
      { input }
    );

    return data.updateStampCard;
  } catch (error) {
    console.error('Error updating stamp card:', error);
    return null;
  }
}

export async function deleteStampCard(
  token: string,
  id: string
): Promise<boolean> {
  try {
    if (!token) throw new Error('Token is required');
    setContactsAppToken(token);

    const data = await contactsClient.request<{ deleteStampCard: { success: boolean } }>(
      DELETE_STAMP_CARD_MUTATION,
      { id }
    );

    return !!data.deleteStampCard?.success;
  } catch (error) {
    console.error('Error deleting stamp card:', error);
    return false;
  }
}

export async function getClientStampProgress(
  token: string,
  clientId: string,
  stampCardId: string
): Promise<ClientStampProgress | null> {
  try {
    if (!token) throw new Error('Token is required');
    setContactsAppToken(token);

    const data = await contactsClient.request<{ clientStampProgress: ClientStampProgress }>(
      CLIENT_STAMP_PROGRESS_QUERY,
      { clientId, stampCardId }
    );

    return data.clientStampProgress;
  } catch (error) {
    console.error('Error fetching client stamp progress:', error);
    return null;
  }
}

export async function addStamp(
  token: string,
  input: AddStampInput
): Promise<ClientStampProgress | null> {
  try {
    if (!token) throw new Error('Token is required');
    setContactsAppToken(token);

    const data = await contactsClient.request<{ addStamp: ClientStampProgress }>(
      ADD_STAMP_MUTATION,
      { input }
    );

    return data.addStamp;
  } catch (error) {
    console.error('Error adding stamp:', error);
    throw error;
  }
}

// Bonus PIN Management
export interface ChangePinInput {
  clientId: string;
  newPin: string;
  oldPin?: string;
}

export interface ChangePinResponse {
  success: boolean;
  message?: string;
}

const CHANGE_BONUS_PIN_MUTATION = gql`
  mutation ChangeBonusPin($input: ChangeBonusPinInput!) {
    changeBonusPin(input: $input) {
      success
      message
    }
  }
`;

const CHECK_BONUS_PIN_QUERY = gql`
  query CheckBonusPin($clientId: ID!) {
    bonusBalance(clientId: $clientId) {
      clientId
      hasPin
    }
  }
`;

export async function changeBonusPin(
  token: string,
  input: ChangePinInput
): Promise<ChangePinResponse> {
  try {
    if (!token) throw new Error('Token is required');
    setContactsAppToken(token);

    const data = await contactsClient.request<{ changeBonusPin: ChangePinResponse }>(
      CHANGE_BONUS_PIN_MUTATION,
      { input }
    );

    return data.changeBonusPin;
  } catch (error: any) {
    console.error('Error changing bonus PIN:', error);
    return {
      success: false,
      message: error.response?.errors?.[0]?.message || 'Failed to change PIN'
    };
  }
}

export async function checkBonusPinStatus(
  token: string,
  clientId: string
): Promise<boolean> {
  try {
    if (!token) throw new Error('Token is required');
    setContactsAppToken(token);

    const data = await contactsClient.request<{ bonusBalance: { hasPin: boolean } }>(
      CHECK_BONUS_PIN_QUERY,
      { clientId }
    );

    return data.bonusBalance?.hasPin || false;
  } catch (error) {
    console.error('Error checking bonus PIN status:', error);
    return false;
  }
}
