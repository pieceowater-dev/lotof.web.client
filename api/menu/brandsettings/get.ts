import { menuClient } from '@/api/clients';
import { menuRequestWithRefresh } from '@/api/menu/menuRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';

export type MenuBrandSettings = {
  id: string;
  name: string;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  welcomeMessage: string;
  currencyCode: string;
  socialLinks: string;
  logoAlt?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
};

const BrandSettingsDocument = /* GraphQL */ `
  query BrandSettings {
    brandSettings {
      id name logoUrl primaryColor secondaryColor welcomeMessage currencyCode socialLinks logoAlt seoTitle seoDescription
    }
  }
`;

export async function menuGetBrandSettings(menuToken: string, namespaceSlug: string): Promise<MenuBrandSettings | null> {
  const devHeaders = await getDeviceHeaders();
  return menuRequestWithRefresh(async () => {
    const res = await menuClient.request<{ brandSettings: MenuBrandSettings | null }>(
      BrandSettingsDocument,
      {},
      { headers: { MenuAuthorization: `Bearer ${menuToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.brandSettings;
  }, namespaceSlug);
}
