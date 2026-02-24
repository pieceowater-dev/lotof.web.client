import { gql } from 'graphql-request';
import { contactsClient, setContactsAppToken } from '../clients';

export interface Segment {
  id: string;
  name: string;
  createdBy: string;
}

export interface SegmentRule {
  id: string;
  segmentId: string;
  fieldKey: string;
  operator: string;
  value: string;
}

export interface SegmentListResponse {
  segments: {
    rows: Segment[];
    info: {
      total: number;
      limit: number;
      offset: number;
    };
  };
}

export interface SegmentRulesResponse {
  segmentRules: {
    rows: SegmentRule[];
    info: {
      total: number;
      limit: number;
      offset: number;
    };
  };
}

const LIST_SEGMENTS_QUERY = gql`
  query ListSegments($filter: DefaultFilterInput) {
    segments(filter: $filter) {
      rows {
        id
        name
        createdBy
      }
      info {
        total
        limit
        offset
      }
    }
  }
`;

const SEGMENT_RULES_QUERY = gql`
  query SegmentRules($segmentId: ID!) {
    segmentRules(segmentId: $segmentId) {
      rows {
        id
        segmentId
        fieldKey
        operator
        value
      }
      info {
        total
        limit
        offset
      }
    }
  }
`;

const CREATE_SEGMENT_MUTATION = gql`
  mutation CreateSegment($input: CreateSegmentInput!) {
    createSegment(input: $input) {
      id
      name
      createdBy
    }
  }
`;

const UPDATE_SEGMENT_MUTATION = gql`
  mutation UpdateSegment($input: UpdateSegmentInput!) {
    updateSegment(input: $input) {
      id
      name
      createdBy
    }
  }
`;

const DELETE_SEGMENT_MUTATION = gql`
  mutation DeleteSegment($id: ID!) {
    deleteSegment(id: $id) {
      success
    }
  }
`;

const CREATE_SEGMENT_RULE_MUTATION = gql`
  mutation CreateSegmentRule($input: CreateSegmentRuleInput!) {
    createSegmentRule(input: $input) {
      id
      segmentId
      fieldKey
      operator
      value
    }
  }
`;

const DELETE_SEGMENT_RULE_MUTATION = gql`
  mutation DeleteSegmentRule($id: ID!) {
    deleteSegmentRule(id: $id) {
      success
    }
  }
`;

export async function listSegments(token: string, search?: string) {
  if (!token) throw new Error('Token is required');
  setContactsAppToken(token);
  return contactsClient.request<SegmentListResponse>(LIST_SEGMENTS_QUERY, {
    filter: search ? { search } : {},
  });
}

export async function getSegmentRules(token: string, segmentId: string) {
  if (!token) throw new Error('Token is required');
  setContactsAppToken(token);
  return contactsClient.request<SegmentRulesResponse>(SEGMENT_RULES_QUERY, {
    segmentId,
  });
}

export async function createSegment(token: string, name: string, createdBy: string) {
  if (!token) throw new Error('Token is required');
  setContactsAppToken(token);
  return contactsClient.request<{ createSegment: Segment }>(CREATE_SEGMENT_MUTATION, {
    input: { name, createdBy },
  });
}

export async function updateSegment(token: string, id: string, name: string) {
  if (!token) throw new Error('Token is required');
  setContactsAppToken(token);
  return contactsClient.request<{ updateSegment: Segment }>(UPDATE_SEGMENT_MUTATION, {
    input: { id, name },
  });
}

export async function deleteSegment(token: string, id: string) {
  if (!token) throw new Error('Token is required');
  setContactsAppToken(token);
  return contactsClient.request<{ deleteSegment: { success: boolean } }>(
    DELETE_SEGMENT_MUTATION,
    {
      id,
    }
  );
}

export async function createSegmentRule(
  token: string,
  segmentId: string,
  fieldKey: string,
  operator: string,
  value: string
) {
  if (!token) throw new Error('Token is required');
  setContactsAppToken(token);
  return contactsClient.request<{ createSegmentRule: SegmentRule }>(
    CREATE_SEGMENT_RULE_MUTATION,
    {
      input: { segmentId, fieldKey, operator, value },
    }
  );
}

export async function deleteSegmentRule(token: string, id: string) {
  if (!token) throw new Error('Token is required');
  setContactsAppToken(token);
  return contactsClient.request<{ deleteSegmentRule: { success: boolean } }>(
    DELETE_SEGMENT_RULE_MUTATION,
    {
      id,
    }
  );
}
