import { gql } from 'graphql-request';
import { contactsClient, setContactsAppToken } from '../clients';

export type DynamicFieldDataType = 'STRING' | 'NUMBER' | 'BOOLEAN' | 'DATE' | 'SELECT' | 'MULTI_SELECT';
export type DynamicFieldClientScope = 'ALL' | 'INDIVIDUAL' | 'LEGAL';

export interface DynamicField {
  id: string;
  key: string;
  label: string;
  viewOrder: number;
  options: string[];
  dataType: DynamicFieldDataType;
  isRequired: boolean;
  searchable: boolean;
  clientTypeScope: DynamicFieldClientScope;
  createdBy: string;
  createdAt: string;
  deletedAt?: string | null;
  deletedBy?: string | null;
}

export interface DynamicFieldFilterInput {
  search?: string;
  dataType?: DynamicFieldDataType;
  clientTypeScope?: DynamicFieldClientScope;
  includeDeleted?: boolean;
}

export interface CreateDynamicFieldInput {
  key: string;
  label: string;
  viewOrder?: number;
  options?: string[];
  dataType: DynamicFieldDataType;
  isRequired?: boolean;
  searchable?: boolean;
  clientTypeScope: DynamicFieldClientScope;
  createdBy?: string;
}

export interface UpdateDynamicFieldInput {
  id: string;
  label: string;
  viewOrder?: number;
  options?: string[];
  isRequired: boolean;
  searchable: boolean;
}

export interface DynamicFieldValue {
  id: string;
  fieldId: string;
  entityId: string;
  valueString?: string | null;
  valueNumber?: number | null;
  valueBool?: boolean | null;
  valueDate?: string | null;
  valueJson?: string | null;
  updatedAt: string;
}

export interface SetDynamicFieldValueInput {
  fieldId: string;
  entityId: string;
  valueString?: string;
  valueNumber?: number;
  valueBool?: boolean;
  valueDate?: string;
  valueJson?: string;
}

const LIST_DYNAMIC_FIELDS_QUERY = gql`
  query DynamicFields($filter: DynamicFieldFilterInput) {
    dynamicFields(filter: $filter) {
      rows {
        id
        key
        label
        viewOrder
        options
        dataType
        isRequired
        searchable
        clientTypeScope
        createdBy
        createdAt
        deletedAt
        deletedBy
      }
      info {
        count
      }
    }
  }
`;

const CREATE_DYNAMIC_FIELD_MUTATION = gql`
  mutation CreateDynamicField($input: CreateDynamicFieldInput!) {
    createDynamicField(input: $input) {
      id
      key
      label
      viewOrder
      options
      dataType
      isRequired
      searchable
      clientTypeScope
      createdBy
      createdAt
      deletedAt
      deletedBy
    }
  }
`;

const UPDATE_DYNAMIC_FIELD_MUTATION = gql`
  mutation UpdateDynamicField($input: UpdateDynamicFieldInput!) {
    updateDynamicField(input: $input) {
      id
      key
      label
      viewOrder
      options
      dataType
      isRequired
      searchable
      clientTypeScope
      createdBy
      createdAt
      deletedAt
      deletedBy
    }
  }
`;

const DELETE_DYNAMIC_FIELD_MUTATION = gql`
  mutation DeleteDynamicField($id: ID!, $deletedBy: String) {
    deleteDynamicField(id: $id, deletedBy: $deletedBy) {
      success
    }
  }
`;

const RESTORE_DYNAMIC_FIELD_MUTATION = gql`
  mutation RestoreDynamicField($id: ID!) {
    restoreDynamicField(id: $id) {
      id
      key
      label
      viewOrder
      options
      dataType
      isRequired
      searchable
      clientTypeScope
      createdBy
      createdAt
      deletedAt
      deletedBy
    }
  }
`;

const LIST_DYNAMIC_FIELD_VALUES_QUERY = gql`
  query DynamicFieldValues($entityId: ID!, $fieldId: ID) {
    dynamicFieldValues(entityId: $entityId, fieldId: $fieldId) {
      rows {
        id
        fieldId
        entityId
        valueString
        valueNumber
        valueBool
        valueDate
        valueJson
        updatedAt
      }
      info {
        count
      }
    }
  }
`;

const SET_DYNAMIC_FIELD_VALUE_MUTATION = gql`
  mutation SetDynamicFieldValue($input: SetDynamicFieldValueInput!) {
    setDynamicFieldValue(input: $input) {
      id
      fieldId
      entityId
      valueString
      valueNumber
      valueBool
      valueDate
      valueJson
      updatedAt
    }
  }
`;

const DELETE_DYNAMIC_FIELD_VALUE_MUTATION = gql`
  mutation DeleteDynamicFieldValue($id: ID!) {
    deleteDynamicFieldValue(id: $id) {
      success
    }
  }
`;

const DYNAMIC_FIELDS_WITH_VALUES_QUERY = gql`
  query DynamicFieldsWithValues($filter: DynamicFieldFilterInput, $entityId: ID!) {
    dynamicFields(filter: $filter) {
      rows {
        id
        key
        label
        viewOrder
        options
        dataType
        isRequired
        searchable
        clientTypeScope
        createdBy
        createdAt
        deletedAt
        deletedBy
      }
    }
    dynamicFieldValues(entityId: $entityId) {
      rows {
        id
        fieldId
        entityId
        valueString
        valueNumber
        valueBool
        valueDate
        valueJson
        updatedAt
      }
    }
  }
`;

export async function listDynamicFieldsWithValues(
  token: string,
  namespaceSlug: string,
  entityId: string,
  filter?: DynamicFieldFilterInput,
) {
  if (!token) throw new Error('Token is required');
  setContactsAppToken(token);
  return contactsClient.request<{
    dynamicFields: { rows: DynamicField[] };
    dynamicFieldValues: { rows: DynamicFieldValue[] };
  }>(
    DYNAMIC_FIELDS_WITH_VALUES_QUERY,
    { filter: filter || {}, entityId },
    { headers: { Namespace: namespaceSlug } },
  );
}

export async function listDynamicFields(token: string, namespaceSlug: string, filter?: DynamicFieldFilterInput) {
  if (!token) throw new Error('Token is required');
  setContactsAppToken(token);
  return contactsClient.request<{
    dynamicFields: {
      rows: DynamicField[];
      info: { count: number };
    };
  }>(
    LIST_DYNAMIC_FIELDS_QUERY,
    { filter: filter || {} },
    { headers: { Namespace: namespaceSlug } }
  );
}

export async function createDynamicField(token: string, namespaceSlug: string, input: CreateDynamicFieldInput) {
  if (!token) throw new Error('Token is required');
  setContactsAppToken(token);
  return contactsClient.request<{ createDynamicField: DynamicField }>(
    CREATE_DYNAMIC_FIELD_MUTATION,
    { input },
    { headers: { Namespace: namespaceSlug } }
  );
}

export async function updateDynamicField(token: string, namespaceSlug: string, input: UpdateDynamicFieldInput) {
  if (!token) throw new Error('Token is required');
  setContactsAppToken(token);
  return contactsClient.request<{ updateDynamicField: DynamicField }>(
    UPDATE_DYNAMIC_FIELD_MUTATION,
    { input },
    { headers: { Namespace: namespaceSlug } }
  );
}

export async function deleteDynamicField(token: string, namespaceSlug: string, id: string, deletedBy?: string) {
  if (!token) throw new Error('Token is required');
  setContactsAppToken(token);
  return contactsClient.request<{ deleteDynamicField: { success: boolean } }>(
    DELETE_DYNAMIC_FIELD_MUTATION,
    { id, deletedBy },
    { headers: { Namespace: namespaceSlug } }
  );
}

export async function restoreDynamicField(token: string, namespaceSlug: string, id: string) {
  if (!token) throw new Error('Token is required');
  setContactsAppToken(token);
  return contactsClient.request<{ restoreDynamicField: DynamicField }>(
    RESTORE_DYNAMIC_FIELD_MUTATION,
    { id },
    { headers: { Namespace: namespaceSlug } }
  );
}

export async function listDynamicFieldValues(
  token: string,
  namespaceSlug: string,
  entityId: string,
  fieldId?: string,
) {
  if (!token) throw new Error('Token is required');
  setContactsAppToken(token);
  return contactsClient.request<{
    dynamicFieldValues: {
      rows: DynamicFieldValue[];
      info: { count: number };
    };
  }>(
    LIST_DYNAMIC_FIELD_VALUES_QUERY,
    { entityId, fieldId },
    { headers: { Namespace: namespaceSlug } }
  );
}

export async function setDynamicFieldValue(
  token: string,
  namespaceSlug: string,
  input: SetDynamicFieldValueInput,
) {
  if (!token) throw new Error('Token is required');
  setContactsAppToken(token);
  return contactsClient.request<{ setDynamicFieldValue: DynamicFieldValue }>(
    SET_DYNAMIC_FIELD_VALUE_MUTATION,
    { input },
    { headers: { Namespace: namespaceSlug } }
  );
}

export async function deleteDynamicFieldValue(token: string, namespaceSlug: string, id: string) {
  if (!token) throw new Error('Token is required');
  setContactsAppToken(token);
  return contactsClient.request<{ deleteDynamicFieldValue: { success: boolean } }>(
    DELETE_DYNAMIC_FIELD_VALUE_MUTATION,
    { id },
    { headers: { Namespace: namespaceSlug } }
  );
}
