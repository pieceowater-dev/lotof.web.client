import type { DynamicFieldDataType, DynamicFieldClientScope } from '@/api/contacts/dynamicFields';
import type { StaticAccessRole } from '@/composables/useNamespaceStaticRoles';

export const staticRoleOptions: Array<{ label: string; value: StaticAccessRole }> = [
  { label: 'Админ', value: 'ADMIN' },
  { label: 'Оператор', value: 'OPERATOR' },
  { label: 'Наблюдатель', value: 'VIEWER' },
];

export const rolesPageSizeOptions = [10, 20, 50];

export const dynamicFieldDataTypeOptions: Array<{ label: string; value: DynamicFieldDataType }> = [
  { label: 'Строка', value: 'STRING' },
  { label: 'Число', value: 'NUMBER' },
  { label: 'Да/Нет', value: 'BOOLEAN' },
  { label: 'Дата', value: 'DATE' },
  { label: 'Список', value: 'SELECT' },
  { label: 'Множественный список', value: 'MULTI_SELECT' },
];

export const dynamicFieldScopeOptions: Array<{ label: string; value: DynamicFieldClientScope }> = [
  { label: 'Все клиенты', value: 'ALL' },
  { label: 'Только физлица', value: 'INDIVIDUAL' },
  { label: 'Только юрлица', value: 'LEGAL' },
];
