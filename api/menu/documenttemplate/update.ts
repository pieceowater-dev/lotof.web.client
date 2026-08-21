import { menuClient } from '@/api/clients';
import { menuRequestWithRefresh } from '@/api/menu/menuRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';
import type { MenuDocumentTemplate } from '@/api/menu/documenttemplate/list';

const UpdateDocumentTemplateDocument = /* GraphQL */ `
  mutation UpdateDocumentTemplate($input: UpdateDocumentTemplateInput!) {
    updateDocumentTemplate(input: $input) { id name content isActive }
  }
`;

export async function menuUpdateDocumentTemplate(
  menuToken: string,
  namespaceSlug: string,
  id: string,
  fields: { name?: string; content?: string; isActive?: boolean }
): Promise<MenuDocumentTemplate> {
  const devHeaders = await getDeviceHeaders();
  return menuRequestWithRefresh(async () => {
    const res = await menuClient.request<{ updateDocumentTemplate: MenuDocumentTemplate }>(
      UpdateDocumentTemplateDocument,
      { input: { id, ...fields } },
      { headers: { MenuAuthorization: `Bearer ${menuToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.updateDocumentTemplate;
  }, namespaceSlug);
}
