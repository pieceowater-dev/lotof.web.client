import { menuClient } from '@/api/clients';
import { menuRequestWithRefresh } from '@/api/menu/menuRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';
import type { MenuItem } from '@/api/menu/menuitem/list';

export type CreateMenuItemInput = {
  categoryId: string;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  sortOrder?: number;
  imageAlt?: string;
  seoTitle?: string;
  seoDescription?: string;
};

const CreateMenuItemDocument = /* GraphQL */ `
  mutation CreateMenuItem($input: CreateMenuItemInput!) {
    createMenuItem(input: $input) {
      id categoryId name description price imageUrl isActive sortOrder imageAlt seoTitle seoDescription
    }
  }
`;

export async function menuCreateMenuItem(menuToken: string, namespaceSlug: string, input: CreateMenuItemInput): Promise<MenuItem> {
  const devHeaders = await getDeviceHeaders();
  return menuRequestWithRefresh(async () => {
    const res = await menuClient.request<{ createMenuItem: MenuItem }>(
      CreateMenuItemDocument,
      { input },
      { headers: { MenuAuthorization: `Bearer ${menuToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.createMenuItem;
  }, namespaceSlug);
}
