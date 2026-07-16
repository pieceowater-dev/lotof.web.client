import { menuClient } from '@/api/clients';
import { menuRequestWithRefresh } from '@/api/menu/menuRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';
import type { MenuPromoBanner } from '@/api/menu/promobanner/list';

export type UpdatePromoBannerInput = {
  id: string;
  title?: string;
  description?: string;
  imageUrl?: string;
  imageAlt?: string;
  targetUrl?: string;
  startDate?: string;
  endDate?: string;
  isActive?: boolean;
};

const UpdatePromoBannerDocument = /* GraphQL */ `
  mutation UpdatePromoBanner($input: UpdatePromoBannerInput!) {
    updatePromoBanner(input: $input) { id title description imageUrl imageAlt targetUrl startDate endDate isActive }
  }
`;

export async function menuUpdatePromoBanner(menuToken: string, namespaceSlug: string, input: UpdatePromoBannerInput): Promise<MenuPromoBanner> {
  const devHeaders = await getDeviceHeaders();
  return menuRequestWithRefresh(async () => {
    const res = await menuClient.request<{ updatePromoBanner: MenuPromoBanner }>(
      UpdatePromoBannerDocument,
      { input },
      { headers: { MenuAuthorization: `Bearer ${menuToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.updatePromoBanner;
  }, namespaceSlug);
}
