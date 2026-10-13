import { crmRequest } from './crmRequest';

export interface ClientAddress {
  id: string;
  clientId: string;
  label: string;
  address: string;
  isPrimary: boolean;
  isDelivery: boolean;
  lat?: number | null;
  lng?: number | null;
}

export interface ClientAddressInput {
  label?: string;
  address: string;
  isPrimary?: boolean;
  isDelivery?: boolean;
  lat?: number | null;
  lng?: number | null;
}

const FIELDS = 'id clientId label address isPrimary isDelivery lat lng';

export async function listClientAddresses(token: string, ns: string, clientId: string) {
  const data = await crmRequest<{ clientAddresses: ClientAddress[] }>(
    token, ns, `query ClientAddresses($clientId: ID!) { clientAddresses(clientId: $clientId) { ${FIELDS} } }`, { clientId },
  );
  return data.clientAddresses;
}

export async function createClientAddress(token: string, ns: string, clientId: string, input: ClientAddressInput) {
  const data = await crmRequest<{ createClientAddress: ClientAddress }>(
    token, ns,
    `mutation CreateClientAddress($clientId: ID!, $input: ClientAddressInput!) {
      createClientAddress(clientId: $clientId, input: $input) { ${FIELDS} }
    }`,
    { clientId, input },
  );
  return data.createClientAddress;
}

export async function updateClientAddress(token: string, ns: string, id: string, input: ClientAddressInput) {
  const data = await crmRequest<{ updateClientAddress: ClientAddress }>(
    token, ns,
    `mutation UpdateClientAddress($id: ID!, $input: ClientAddressInput!) {
      updateClientAddress(id: $id, input: $input) { ${FIELDS} }
    }`,
    { id, input },
  );
  return data.updateClientAddress;
}

export async function deleteClientAddress(token: string, ns: string, id: string) {
  await crmRequest(token, ns, `mutation DeleteClientAddress($id: ID!) { deleteClientAddress(id: $id) { success } }`, { id });
}

/** 2GIS search link for an address (Kazakhstan/CIS default); coordinates win when present. */
export function mapLinkFor(a: Pick<ClientAddress, 'address' | 'lat' | 'lng'>): string {
  if (a.lat != null && a.lng != null) {
    return `https://2gis.kz/geo/${a.lng},${a.lat}`;
  }
  return `https://2gis.kz/search/${encodeURIComponent(a.address)}`;
}
