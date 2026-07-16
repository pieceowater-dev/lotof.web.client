import { menuClient } from '@/api/clients';
import { menuRequestWithRefresh } from '@/api/menu/menuRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';
import type { MenuPromoBanner } from '@/api/menu/promobanner/list';

export type CreatePromoBannerInput = {
  title: string;
  description?: string;
  imageUrl: string;
  imageAlt?: string;
  targetUrl?: string;
  startDate?: string;
  endDate?: string;
};

const CreatePromoBannerDocument = /* GraphQL */ `
  mutation CreatePromoBanner($input: CreatePromoBannerInput!) {
    createPromoBanner(input: $input) { id title description imageUrl imageAlt targetUrl startDate endDate isActive }
  }
`;

export async function menuCreatePromoBanner(menuToken: string, namespaceSlug: string, input: CreatePromoBannerInput): Promise<MenuPromoBanner> {
  const devHeaders = await getDeviceHeaders();
  return menuRequestWithRefresh(async () => {
    const res = await menuClient.request<{ createPromoBanner: MenuPromoBanner }>(
      CreatePromoBannerDocument,
      { input },
      { headers: { MenuAuthorization: `Bearer ${menuToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.createPromoBanner;
  }, namespaceSlug);
}
