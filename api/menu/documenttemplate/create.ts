import { menuClient } from '@/api/clients';
import { menuRequestWithRefresh } from '@/api/menu/menuRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';
import type { MenuDocumentTemplate } from '@/api/menu/documenttemplate/list';

const CreateDocumentTemplateDocument = /* GraphQL */ `
  mutation CreateDocumentTemplate($input: CreateDocumentTemplateInput!) {
    createDocumentTemplate(input: $input) { id name content isActive }
  }
`;

export async function menuCreateDocumentTemplate(menuToken: string, namespaceSlug: string, name: string, content: string): Promise<MenuDocumentTemplate> {
  const devHeaders = await getDeviceHeaders();
  return menuRequestWithRefresh(async () => {
    const res = await menuClient.request<{ createDocumentTemplate: MenuDocumentTemplate }>(
      CreateDocumentTemplateDocument,
      { input: { name, content } },
      { headers: { MenuAuthorization: `Bearer ${menuToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.createDocumentTemplate;
  }, namespaceSlug);
}
