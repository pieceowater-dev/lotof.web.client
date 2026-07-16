import { menuClient } from '@/api/clients';
import { menuRequestWithRefresh } from '@/api/menu/menuRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';
import type { MenuBrandSettings } from '@/api/menu/brandsettings/get';

export type UpsertBrandSettingsInput = {
  name: string;
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  welcomeMessage?: string;
  currencyCode?: string;
  socialLinks?: string;
  logoAlt?: string;
  seoTitle?: string;
  seoDescription?: string;
};

const UpsertBrandSettingsDocument = /* GraphQL */ `
  mutation UpsertBrandSettings($input: UpsertBrandSettingsInput!) {
    upsertBrandSettings(input: $input) {
      id name logoUrl primaryColor secondaryColor welcomeMessage currencyCode socialLinks logoAlt seoTitle seoDescription
    }
  }
`;

export async function menuUpsertBrandSettings(menuToken: string, namespaceSlug: string, input: UpsertBrandSettingsInput): Promise<MenuBrandSettings> {
  const devHeaders = await getDeviceHeaders();
  return menuRequestWithRefresh(async () => {
    const res = await menuClient.request<{ upsertBrandSettings: MenuBrandSettings }>(
      UpsertBrandSettingsDocument,
      { input },
      { headers: { MenuAuthorization: `Bearer ${menuToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.upsertBrandSettings;
  }, namespaceSlug);
}
