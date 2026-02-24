import { gql } from 'graphql-request';
import { contactsClient, setContactsAppToken } from '../clients';

export interface Tag {
  id: string;
  name: string;
}

export interface ClientTagsResponse {
  tags: Tag[];
}

export interface TagListResponse {
  tags: {
    rows: Tag[];
    info: {
      total: number;
      limit: number;
      offset: number;
    };
  };
}

const LIST_TAGS_QUERY = gql`
  query ListTags($filter: DefaultFilterInput) {
    tags(filter: $filter) {
      rows {
        id
        name
      }
      info {
        total
        limit
        offset
      }
    }
  }
`;

const CLIENT_TAGS_QUERY = gql`
  query ClientTags($clientId: ID!) {
    clientTags(clientId: $clientId) {
      tags {
        id
        name
      }
    }
  }
`;

const CREATE_TAG_MUTATION = gql`
  mutation CreateTag($input: CreateTagInput!) {
    createTag(input: $input) {
      id
      name
    }
  }
`;

const UPDATE_TAG_MUTATION = gql`
  mutation UpdateTag($input: UpdateTagInput!) {
    updateTag(input: $input) {
      id
      name
    }
  }
`;

const DELETE_TAG_MUTATION = gql`
  mutation DeleteTag($id: ID!) {
    deleteTag(id: $id) {
      success
    }
  }
`;

const ADD_TAG_TO_CLIENT_MUTATION = gql`
  mutation AddTagToClient($input: AddTagToClientInput!) {
    addTagToClient(input: $input) {
      success
    }
  }
`;

const REMOVE_TAG_FROM_CLIENT_MUTATION = gql`
  mutation RemoveTagFromClient($input: RemoveTagFromClientInput!) {
    removeTagFromClient(input: $input) {
      success
    }
  }
`;

export async function listTags(token: string, search?: string) {
  if (!token) throw new Error('Token is required');
  setContactsAppToken(token);
  return contactsClient.request<{ tags: TagListResponse['tags'] }>(LIST_TAGS_QUERY, {
    filter: search ? { search } : {},
  });
}

export async function getClientTags(token: string, clientId: string) {
  if (!token) throw new Error('Token is required');
  setContactsAppToken(token);
  return contactsClient.request<ClientTagsResponse>(CLIENT_TAGS_QUERY, {
    clientId,
  });
}

export async function createTag(token: string, name: string) {
  if (!token) throw new Error('Token is required');
  setContactsAppToken(token);
  return contactsClient.request<{ createTag: Tag }>(CREATE_TAG_MUTATION, {
    input: { name },
  });
}

export async function updateTag(token: string, id: string, name: string) {
  if (!token) throw new Error('Token is required');
  setContactsAppToken(token);
  return contactsClient.request<{ updateTag: Tag }>(UPDATE_TAG_MUTATION, {
    input: { id, name },
  });
}

export async function deleteTag(token: string, id: string) {
  if (!token) throw new Error('Token is required');
  setContactsAppToken(token);
  return contactsClient.request<{ deleteTag: { success: boolean } }>(DELETE_TAG_MUTATION, {
    id,
  });
}

export async function addTagToClient(token: string, clientId: string, tagId: string) {
  if (!token) throw new Error('Token is required');
  setContactsAppToken(token);
  return contactsClient.request<{ addTagToClient: { success: boolean } }>(
    ADD_TAG_TO_CLIENT_MUTATION,
    {
      input: { clientId, tagId },
    }
  );
}

export async function removeTagFromClient(token: string, clientId: string, tagId: string) {
  if (!token) throw new Error('Token is required');
  setContactsAppToken(token);
  return contactsClient.request<{ removeTagFromClient: { success: boolean } }>(
    REMOVE_TAG_FROM_CLIENT_MUTATION,
    {
      input: { clientId, tagId },
    }
  );
}
