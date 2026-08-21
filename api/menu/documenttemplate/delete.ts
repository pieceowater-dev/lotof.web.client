import { menuClient } from '@/api/clients';
import { menuRequestWithRefresh } from '@/api/menu/menuRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';

const DeleteDocumentTemplateDocument = /* GraphQL */ `
  mutation DeleteDocumentTemplate($id: ID!) {
    deleteDocumentTemplate(id: $id) { success }
  }
`;

export async function menuDeleteDocumentTemplate(menuToken: string, namespaceSlug: string, id: string): Promise<boolean> {
  const devHeaders = await getDeviceHeaders();
  return menuRequestWithRefresh(async () => {
    const res = await menuClient.request<{ deleteDocumentTemplate: { success: boolean } }>(
      DeleteDocumentTemplateDocument,
      { id },
      { headers: { MenuAuthorization: `Bearer ${menuToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return res.deleteDocumentTemplate.success;
  }, namespaceSlug);
}
