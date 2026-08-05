import { tasksClient } from '@/api/clients';

export interface PublicTrackedTask {
  boardName: string;
  taskTypeName: string;
  statusLabel: string;
  isTerminal: boolean;
  createdAt: string;
  courierLat?: number | null;
  courierLng?: number | null;
  courierUpdatedAt?: string | null;
}

const PublicTrackTaskDocument = /* GraphQL */ `
  query PublicTrackTask($shortId: String!) {
    publicTrackTask(shortId: $shortId) {
      boardName taskTypeName statusLabel isTerminal createdAt
      courierLat courierLng courierUpdatedAt
    }
  }
`;

// Deliberately unauthenticated (no IssuesAuthorization) — this backs the
// public, customer-facing tracking page. Tenant is resolved purely from the
// Namespace header, the same way Menu's public storefront queries work.
export async function tasksPublicTrackTask(namespaceSlug: string, shortId: string): Promise<PublicTrackedTask | null> {
  const res = await tasksClient.request<{ publicTrackTask: PublicTrackedTask | null }>(
    PublicTrackTaskDocument,
    { shortId },
    { headers: { Namespace: namespaceSlug } },
  );
  return res.publicTrackTask;
}
