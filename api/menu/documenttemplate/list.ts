import { menuClient } from '@/api/clients';
import { menuRequestWithRefresh } from '@/api/menu/menuRequestWithRefresh';
import { getDeviceHeaders } from '@/utils/device';

export type MenuDocumentTemplate = {
  id: string;
  name: string;
  content: string;
  isActive: boolean;
  branchId?: string | null;
};

const DocumentTemplatesDocument = /* GraphQL */ `
  query DocumentTemplates($filter: DefaultFilterInput) {
    documentTemplates(filter: $filter) {
      rows { id name content isActive branchId }
      info { count }
    }
  }
`;

export async function menuDocumentTemplatesList(menuToken: string, namespaceSlug: string): Promise<{ templates: MenuDocumentTemplate[]; count: number }> {
  const devHeaders = await getDeviceHeaders();
  return menuRequestWithRefresh(async () => {
    const res = await menuClient.request<{ documentTemplates: { rows: MenuDocumentTemplate[]; info: { count: number } } }>(
      DocumentTemplatesDocument,
      { filter: { pagination: { page: 1, length: 'ONE_HUNDRED' } } },
      { headers: { MenuAuthorization: `Bearer ${menuToken}`, Namespace: namespaceSlug, ...devHeaders } }
    );
    return { templates: res.documentTemplates.rows, count: res.documentTemplates.info.count };
  }, namespaceSlug);
}
