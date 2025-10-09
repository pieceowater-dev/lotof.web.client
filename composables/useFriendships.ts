import { hubFriendshipsList } from '@/api/hub/friendships/list';
import { useAuth } from './useAuth';
import { FriendshipStatus } from '@gql-hub';

export function useFriendships() {
  const { token } = useAuth();
  const rows = useState<any[]>('friendships_rows', () => []);
  const loading = useState<boolean>('friendships_loading', () => false);
  const currentStatus = useState<FriendshipStatus>('friendships_status', () => FriendshipStatus.Accepted);

  async function load(status: FriendshipStatus = FriendshipStatus.Accepted) {
    currentStatus.value = status;
    if (!token.value) {
      rows.value = [];
      return;
    }
    loading.value = true;
    try {
      const data = await hubFriendshipsList(token.value, status);
      rows.value = data.rows;
    } catch (e) {
      console.error('[friendships] load error', e);
    } finally {
      loading.value = false;
    }
  }

  return { rows, loading, currentStatus, load };
}
