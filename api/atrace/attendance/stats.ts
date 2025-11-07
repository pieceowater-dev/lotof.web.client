import { atraceClient } from '@/api/clients';

type UserAttendanceStats = {
  userId: string;
  username?: string;
  email?: string;
  workDays: number;
  attendedDays: number;
  violationDays: number;
  legitimateAbsences: number;
  totalWorkedHours: number;
};

const GET_ALL_USERS_STATS = `
  query GetAllUsersStats($startDate: String!, $endDate: String!) {
    getAllUsersStats(input: { startDate: $startDate, endDate: $endDate }) {
      userId
      workDays
      attendedDays
      violationDays
      legitimateAbsences
      totalWorkedHours
    }
  }
`;

const GET_USERS_BY_IDS = `
  query GetUsersByIDs($ids: [ID!]!) {
    getUsersByIDs(ids: $ids) {
      id
      username
      email
    }
  }
`;

export async function atraceGetAllUsersStats(
  startDate: string,
  endDate: string
): Promise<UserAttendanceStats[]> {
  try {
    const response = await atraceClient.request<{
      getAllUsersStats: Array<{
        userId: string;
        workDays: number;
        attendedDays: number;
        violationDays: number;
        legitimateAbsences: number;
        totalWorkedHours: number;
      }>;
    }>(GET_ALL_USERS_STATS, { startDate, endDate });

    const stats = response.getAllUsersStats;

    // Get user details
    const userIds = stats.map((s: any) => s.userId);
    if (userIds.length > 0) {
      try {
        const usersResponse = await atraceClient.request<{
          getUsersByIDs: Array<{
            id: string;
            username: string;
            email: string;
          }>;
        }>(GET_USERS_BY_IDS, { ids: userIds });

        const userMap = new Map(
          usersResponse.getUsersByIDs.map((u: any) => [u.id, u])
        );

        return stats.map((stat: any) => ({
          ...stat,
          username: (userMap.get(stat.userId) as any)?.username,
          email: (userMap.get(stat.userId) as any)?.email
        }));
      } catch (e) {
        // If user fetch fails, return stats without user details
        console.error('Failed to fetch user details:', e);
        return stats;
      }
    }

    return stats;
  } catch (error) {
    console.error('Error fetching attendance stats:', error);
    throw error;
  }
}
