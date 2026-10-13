import { contactsClient, setContactsAppToken } from '../clients';
import type { ClientRow } from './listClients';

export interface DuplicateGroup {
  matchKey: string;
  clients: ClientRow[];
}

export interface MergeClientsResult {
  mergedClients: number;
  movedIdentities: number;
  droppedDuplicateIdentities: number;
  movedFiles: number;
  movedEvents: number;
  movedMemberships: number;
  movedTags: number;
  movedDynamicFields: number;
  mergedBonusBalance: number;
}

const CLIENT_FIELDS = /* GraphQL */ `
  client { id shortId clientType status createdAt updatedAt mergedIntoId }
  individual { firstName lastName middleName }
  legalEntity { legalName brandName }
  contacts { id clientId type value isPrimary }
  tags { id name }
`;

const DUPLICATE_CLIENTS_QUERY = /* GraphQL */ `
  query DuplicateClients($limit: Int) {
    duplicateClients(limit: $limit) {
      matchKey
      clients { ${CLIENT_FIELDS} }
    }
  }
`;

const MERGE_CLIENTS_MUTATION = /* GraphQL */ `
  mutation MergeClients($primaryId: ID!, $secondaryIds: [ID!]!, $reason: String) {
    mergeClients(primaryId: $primaryId, secondaryIds: $secondaryIds, reason: $reason) {
      mergedClients
      movedIdentities
      droppedDuplicateIdentities
      movedFiles
      movedEvents
      movedMemberships
      movedTags
      movedDynamicFields
      mergedBonusBalance
    }
  }
`;

export async function contactsFindDuplicates(
  contactsToken: string,
  namespaceSlug: string,
  limit = 200
): Promise<DuplicateGroup[]> {
  setContactsAppToken(contactsToken);
  const data = await contactsClient.request<{ duplicateClients: DuplicateGroup[] }>(
    DUPLICATE_CLIENTS_QUERY as any,
    { limit },
    { headers: { Namespace: namespaceSlug } }
  );
  return data.duplicateClients;
}

export async function contactsMergeClients(
  contactsToken: string,
  namespaceSlug: string,
  primaryId: string,
  secondaryIds: string[],
  reason?: string
): Promise<MergeClientsResult> {
  setContactsAppToken(contactsToken);
  const data = await contactsClient.request<{ mergeClients: MergeClientsResult }>(
    MERGE_CLIENTS_MUTATION as any,
    { primaryId, secondaryIds, reason: reason || null },
    { headers: { Namespace: namespaceSlug } }
  );
  return data.mergeClients;
}
