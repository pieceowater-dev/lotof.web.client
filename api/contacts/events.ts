import { gql } from 'graphql-request';
import { contactsClient, setContactsAppToken } from '../clients';

export interface ClientEvent {
  id: string;
  clientId: string;
  eventType: string;
  payload: string;
  createdAt: string;
}

export interface ClientEventsResponse {
  clientEvents: {
    rows: ClientEvent[];
    info: {
      count: number;
    };
  };
}

const CLIENT_EVENTS_QUERY = gql`
  query ClientEvents($clientId: ID!, $limit: Int, $offset: Int) {
    clientEvents(clientId: $clientId, limit: $limit, offset: $offset) {
      rows {
        id
        clientId
        eventType
        payload
        createdAt
      }
      info {
        count
      }
    }
  }
`;

export async function getClientEvents(
  token: string,
  clientId: string,
  limit: number = 50,
  offset: number = 0
) {
  if (!token) throw new Error('Token is required');
  setContactsAppToken(token);
  
  try {
    const response = await contactsClient.request<ClientEventsResponse>(CLIENT_EVENTS_QUERY, {
      clientId,
      limit,
      offset,
    });
    return response.clientEvents;
  } catch (error) {
    // If events API doesn't exist yet, return empty array
    console.warn('Failed to load events:', error);
    return {
      rows: [],
      info: {
        count: 0,
      },
    };
  }
}

// Parse JSON payload from event
export function parseEventPayload(payload: string): Record<string, any> {
  try {
    return JSON.parse(payload);
  } catch {
    return {};
  }
}

// Get human-readable event type description
export function getEventDescription(eventType: string, payload?: Record<string, any>): string {
  const descriptions: Record<string, string> = {
    'CLIENT_CREATED': 'Клиент создан',
    'CLIENT_UPDATED': 'Клиент обновлен',
    'CLIENT_STATUS_CHANGED': 'Статус изменен',
    'IDENTITY_ADDED': 'Добавлен контакт',
    'IDENTITY_REMOVED': 'Контакт удален',
    'IDENTITY_VERIFIED': 'Контакт верифицирован',
    'TAG_ADDED': 'Добавлен тег',
    'TAG_REMOVED': 'Тег удален',
  };
  return descriptions[eventType] || eventType;
}

// Get icon for event type
export function getEventIcon(eventType: string): string {
  const icons: Record<string, string> = {
    'CLIENT_CREATED': 'lucide:user-plus',
    'CLIENT_UPDATED': 'lucide:edit',
    'CLIENT_STATUS_CHANGED': 'lucide:toggle-right',
    'IDENTITY_ADDED': 'lucide:plus-circle',
    'IDENTITY_REMOVED': 'lucide:minus-circle',
    'IDENTITY_VERIFIED': 'lucide:check-circle',
    'TAG_ADDED': 'lucide:tag',
    'TAG_REMOVED': 'lucide:x-circle',
  };
  return icons[eventType] || 'lucide:activity';
}
