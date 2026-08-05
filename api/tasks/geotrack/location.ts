import { tasksClient } from '@/api/clients';
import { tasksRequestWithRefresh } from '@/api/tasks/tasksRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';

export interface GeoLocation {
  userId: string;
  lat: number;
  lng: number;
  accuracyM?: number | null;
  updatedAt: string;
  isStale: boolean;
}

const LOCATION_FIELDS = `userId lat lng accuracyM updatedAt isStale`;

const UpdateMyLocationDocument = /* GraphQL */ `
  mutation UpdateMyLocation($lat: Float!, $lng: Float!, $accuracyM: Float) {
    updateMyLocation(lat: $lat, lng: $lng, accuracyM: $accuracyM) { ${LOCATION_FIELDS} }
  }
`;
const MyLocationDocument = /* GraphQL */ `
  query MyLocation { myLocation { ${LOCATION_FIELDS} } }
`;
const CourierLocationsDocument = /* GraphQL */ `
  query CourierLocations($userIds: [String!]) { courierLocations(userIds: $userIds) { ${LOCATION_FIELDS} } }
`;

export async function tasksUpdateMyLocation(
  tasksToken: string, namespaceSlug: string,
  lat: number, lng: number, accuracyM?: number,
): Promise<GeoLocation> {
  const devHeaders = await getDeviceHeaders();
  return tasksRequestWithRefresh(async () => {
    const res = await tasksClient.request<{ updateMyLocation: GeoLocation }>(
      UpdateMyLocationDocument, { lat, lng, accuracyM },
      { headers: { IssuesAuthorization: `Bearer ${tasksToken}`, Namespace: namespaceSlug, ...devHeaders } },
    );
    return res.updateMyLocation;
  }, namespaceSlug);
}

export async function tasksMyLocation(tasksToken: string, namespaceSlug: string): Promise<GeoLocation | null> {
  const devHeaders = await getDeviceHeaders();
  return tasksRequestWithRefresh(async () => {
    const res = await tasksClient.request<{ myLocation: GeoLocation | null }>(
      MyLocationDocument, {},
      { headers: { IssuesAuthorization: `Bearer ${tasksToken}`, Namespace: namespaceSlug, ...devHeaders } },
    );
    return res.myLocation;
  }, namespaceSlug);
}

export async function tasksCourierLocations(tasksToken: string, namespaceSlug: string, userIds: string[] = []): Promise<GeoLocation[]> {
  const devHeaders = await getDeviceHeaders();
  return tasksRequestWithRefresh(async () => {
    const res = await tasksClient.request<{ courierLocations: GeoLocation[] }>(
      CourierLocationsDocument, { userIds },
      { headers: { IssuesAuthorization: `Bearer ${tasksToken}`, Namespace: namespaceSlug, ...devHeaders } },
    );
    return res.courierLocations;
  }, namespaceSlug);
}
