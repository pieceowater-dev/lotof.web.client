import { menuClient } from '@/api/clients';
import { menuRequestWithRefresh } from '@/api/menu/menuRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';

export type MenuPromoBanner = {
  id: string;
  title: string;
  description?: string | null;
  imageUrl: string;
  imageAlt?: string | null;
  targetUrl?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  isActive: boolean;
};

const PromoBannersDocument = /* GraphQL */ `
  query PromoBanners($filter: DefaultFilterInput) {
    promoBanners(filter: $filter) {
      rows { id title description imageUrl imageAlt targetUrl startDate endDate isActive }
      info { count }
    }
  }
`;

export async function menuPromoBannersList(menuToken: string, namespaceSlug: string): Promise<{ banners: MenuPromoBanner[]; count: number }> {
  const devHeaders = await getDeviceHeaders();
  return menuRequestWithRefresh(async () => {
    const res = await menuClient.request<{ promoBanners: { rows: MenuPromoBanner[]; info: { count: number } } }>(
      PromoBannersDocument,
      { filter: { pagination: { page: 1, length: 'ONE_HUNDRED' } } },
      { headers: { MenuAuthorization: `Bearer ${menuToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return { banners: res.promoBanners.rows, count: res.promoBanners.info.count };
  }, namespaceSlug);
}
