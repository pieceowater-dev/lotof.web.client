import { TypedDocumentNode as DocumentNode } from "@graphql-typed-document-node/core";
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = {
  [K in keyof T]: T[K];
};
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & {
  [SubKey in K]?: Maybe<T[SubKey]>;
};
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & {
  [SubKey in K]: Maybe<T[SubKey]>;
};
export type MakeEmpty<
  T extends { [key: string]: unknown },
  K extends keyof T,
> = { [_ in K]?: never };
export type Incremental<T> =
  | T
  | {
      [P in keyof T]?: P extends " $fragmentName" | "__typename" ? T[P] : never;
    };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string };
  String: { input: string; output: string };
  Boolean: { input: boolean; output: boolean };
  Int: { input: number; output: number };
  Float: { input: number; output: number };
};

export type DefaultFilterInput = {
  pagination?: InputMaybe<DefaultFilterPaginationInput>;
  search?: InputMaybe<Scalars["String"]["input"]>;
  sort?: InputMaybe<DefaultFilterSortInput>;
};

export type DefaultFilterPaginationInput = {
  length?: InputMaybe<FilterPaginationLengthEnum>;
  page?: InputMaybe<Scalars["Int"]["input"]>;
};

export type DefaultFilterSortInput = {
  by?: InputMaybe<FilterSortByEnum>;
  field?: InputMaybe<Scalars["String"]["input"]>;
  nullsFirst?: InputMaybe<Scalars["Boolean"]["input"]>;
};

export enum FilterPaginationLengthEnum {
  Eighty = "EIGHTY",
  EightyFive = "EIGHTY_FIVE",
  Fifteen = "FIFTEEN",
  Fifty = "FIFTY",
  FiftyFive = "FIFTY_FIVE",
  Forty = "FORTY",
  FortyFive = "FORTY_FIVE",
  Ninety = "NINETY",
  NinetyFive = "NINETY_FIVE",
  OneHundred = "ONE_HUNDRED",
  Seventy = "SEVENTY",
  SeventyFive = "SEVENTY_FIVE",
  Sixty = "SIXTY",
  SixtyFive = "SIXTY_FIVE",
  Ten = "TEN",
  Thirty = "THIRTY",
  ThirtyFive = "THIRTY_FIVE",
  Twenty = "TWENTY",
  TwentyFive = "TWENTY_FIVE",
}

export enum FilterSortByEnum {
  Asc = "ASC",
  Desc = "DESC",
}

export type Friendship = {
  __typename?: "Friendship";
  friend: User;
  id: Scalars["ID"]["output"];
  status: FriendshipStatus;
  userId: Scalars["ID"]["output"];
};

export type FriendshipFilter = {
  data?: InputMaybe<DefaultFilterInput>;
  status?: InputMaybe<FriendshipStatus>;
};

export enum FriendshipStatus {
  Accepted = "ACCEPTED",
  Pending = "PENDING",
  Rejected = "REJECTED",
}

export type Member = {
  __typename?: "Member";
  id: Scalars["ID"]["output"];
  userId: Scalars["ID"]["output"];
};

export type MemberToNamespaceInput = {
  namespaceId: Scalars["ID"]["input"];
  userId: Scalars["ID"]["input"];
};

export type MembersFilter = {
  filter?: InputMaybe<DefaultFilterInput>;
  namespaceId?: InputMaybe<Scalars["ID"]["input"]>;
};

export type Mutation = {
  __typename?: "Mutation";
  _placeholder?: Maybe<Scalars["String"]["output"]>;
  acceptFriendshipRequest: Friendship;
  addAppToNamespace: NamespaceApp;
  addMemberToNamespace: Namespace;
  createFriendship: Friendship;
  createNamespace: Namespace;
  removeFriendship: Scalars["Boolean"]["output"];
  removeMemberFromNamespace: Namespace;
  updateNamespace: Namespace;
  updateUser: User;
};

export type MutationAcceptFriendshipRequestArgs = {
  friendshipId: Scalars["ID"]["input"];
};

export type MutationAddAppToNamespaceArgs = {
  appBundle: Scalars["String"]["input"];
  namespaceId: Scalars["ID"]["input"];
};

export type MutationAddMemberToNamespaceArgs = {
  input: MemberToNamespaceInput;
};

export type MutationCreateFriendshipArgs = {
  friendId: Scalars["ID"]["input"];
};

export type MutationCreateNamespaceArgs = {
  input: NamespaceInput;
};

export type MutationRemoveFriendshipArgs = {
  friendshipId: Scalars["ID"]["input"];
};

export type MutationRemoveMemberFromNamespaceArgs = {
  input: MemberToNamespaceInput;
};

export type MutationUpdateNamespaceArgs = {
  id: Scalars["ID"]["input"];
  input: NamespaceInput;
};

export type MutationUpdateUserArgs = {
  id: Scalars["ID"]["input"];
  input: UserInput;
};

export type Namespace = {
  __typename?: "Namespace";
  description?: Maybe<Scalars["String"]["output"]>;
  id: Scalars["ID"]["output"];
  members?: Maybe<Array<Maybe<Member>>>;
  owner: Scalars["ID"]["output"];
  slug: Scalars["String"]["output"];
  title: Scalars["String"]["output"];
};

export type NamespaceApp = {
  __typename?: "NamespaceApp";
  appBundle: Scalars["String"]["output"];
  id: Scalars["ID"]["output"];
  namespaceID: Scalars["ID"]["output"];
};

export type NamespaceInput = {
  description?: InputMaybe<Scalars["String"]["input"]>;
  slug: Scalars["String"]["input"];
  title: Scalars["String"]["input"];
};

export type PaginatedFriendshipList = {
  __typename?: "PaginatedFriendshipList";
  info: PaginationInfo;
  rows: Array<Friendship>;
};

export type PaginatedNamespaceList = {
  __typename?: "PaginatedNamespaceList";
  info: PaginationInfo;
  rows: Array<Namespace>;
};

export type PaginatedUserList = {
  __typename?: "PaginatedUserList";
  info: PaginationInfo;
  rows: Array<User>;
};

export type PaginationInfo = {
  __typename?: "PaginationInfo";
  count: Scalars["Int"]["output"];
};

export type Query = {
  __typename?: "Query";
  _placeholder?: Maybe<Scalars["String"]["output"]>;
  me?: Maybe<User>;
  member?: Maybe<Member>;
  members: Array<Member>;
  myFriends: PaginatedFriendshipList;
  namespace?: Maybe<Namespace>;
  namespaces: PaginatedNamespaceList;
  user?: Maybe<User>;
  users: PaginatedUserList;
};

export type QueryMemberArgs = {
  membershipId: Scalars["ID"]["input"];
};

export type QueryMembersArgs = {
  filter?: InputMaybe<MembersFilter>;
};

export type QueryMyFriendsArgs = {
  filter?: InputMaybe<FriendshipFilter>;
};

export type QueryNamespaceArgs = {
  id: Scalars["ID"]["input"];
};

export type QueryNamespacesArgs = {
  filter?: InputMaybe<DefaultFilterInput>;
};

export type QueryUserArgs = {
  id: Scalars["ID"]["input"];
};

export type QueryUsersArgs = {
  filter?: InputMaybe<DefaultFilterInput>;
};

export type User = {
  __typename?: "User";
  email: Scalars["String"]["output"];
  id: Scalars["ID"]["output"];
  username: Scalars["String"]["output"];
};

export type UserInput = {
  username: Scalars["String"]["input"];
};

export type MutateMeMutationVariables = Exact<{
  id: Scalars["ID"]["input"];
  username: Scalars["String"]["input"];
}>;

export type MutateMeMutation = {
  __typename?: "Mutation";
  updateUser: {
    __typename?: "User";
    id: string;
    email: string;
    username: string;
  };
};

export type MeQueryVariables = Exact<{ [key: string]: never }>;

export type MeQuery = {
  __typename?: "Query";
  me?: {
    __typename?: "User";
    id: string;
    username: string;
    email: string;
  } | null;
};

export type MyFriendsQueryVariables = Exact<{ [key: string]: never }>;

export type MyFriendsQuery = {
  __typename?: "Query";
  myFriends: {
    __typename?: "PaginatedFriendshipList";
    rows: Array<{
      __typename?: "Friendship";
      friend: {
        __typename?: "User";
        id: string;
        username: string;
        email: string;
      };
    }>;
    info: { __typename?: "PaginationInfo"; count: number };
  };
};

export const MutateMeDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "MutateMe" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "id" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "ID" } },
          },
        },
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "username" },
          },
          type: {
            kind: "NonNullType",
            type: {
              kind: "NamedType",
              name: { kind: "Name", value: "String" },
            },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "updateUser" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "id" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "id" },
                },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "input" },
                value: {
                  kind: "ObjectValue",
                  fields: [
                    {
                      kind: "ObjectField",
                      name: { kind: "Name", value: "username" },
                      value: {
                        kind: "Variable",
                        name: { kind: "Name", value: "username" },
                      },
                    },
                  ],
                },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "email" } },
                { kind: "Field", name: { kind: "Name", value: "username" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<MutateMeMutation, MutateMeMutationVariables>;
export const MeDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "Me" },
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "me" },
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "username" } },
                { kind: "Field", name: { kind: "Name", value: "email" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<MeQuery, MeQueryVariables>;
export const MyFriendsDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "MyFriends" },
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "myFriends" },
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                {
                  kind: "Field",
                  name: { kind: "Name", value: "rows" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "friend" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            {
                              kind: "Field",
                              name: { kind: "Name", value: "id" },
                            },
                            {
                              kind: "Field",
                              name: { kind: "Name", value: "username" },
                            },
                            {
                              kind: "Field",
                              name: { kind: "Name", value: "email" },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "info" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "count" } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<MyFriendsQuery, MyFriendsQueryVariables>;
