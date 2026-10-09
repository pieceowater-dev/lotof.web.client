import { menuClient } from '@/api/clients';
import { menuRequestWithRefresh } from '@/api/menu/menuRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';
import type { MenuItem } from '@/api/menu/menuitem/list';

export type UpdateMenuItemInput = {
  id: string;
  categoryId?: string;
  name?: string;
  description?: string;
  price?: number;
  imageUrl?: string;
  isActive?: boolean;
  sortOrder?: number;
  imageAlt?: string;
  seoTitle?: string;
  seoDescription?: string;
};

const UpdateMenuItemDocument = /* GraphQL */ `
  mutation UpdateMenuItem($input: UpdateMenuItemInput!) {
    updateMenuItem(input: $input) {
      id categoryId name description price imageUrl isActive sortOrder imageAlt seoTitle seoDescription
    }
  }
`;

export async function menuUpdateMenuItem(menuToken: string, namespaceSlug: string, input: UpdateMenuItemInput): Promise<MenuItem> {
  const devHeaders = await getDeviceHeaders();
  return menuRequestWithRefresh(async () => {
    const res = await menuClient.request<{ updateMenuItem: MenuItem }>(
      UpdateMenuItemDocument,
      { input },
      { headers: { MenuAuthorization: `Bearer ${menuToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.updateMenuItem;
  }, namespaceSlug);
}
