import type { TypedDocumentNode as DocumentNode } from "@graphql-typed-document-node/core";
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

export type AppHealthStatus = {
  __typename?: "AppHealthStatus";
  appBundle: Scalars["String"]["output"];
  appliedVersion?: Maybe<Scalars["String"]["output"]>;
  error?: Maybe<Scalars["String"]["output"]>;
  reachable: Scalars["Boolean"]["output"];
  schemaReady: Scalars["Boolean"]["output"];
  targetVersion?: Maybe<Scalars["String"]["output"]>;
};

export type CatalogBusiness = {
  __typename?: "CatalogBusiness";
  address?: Maybe<Scalars["String"]["output"]>;
  avgRating: Scalars["Float"]["output"];
  categoryId?: Maybe<Scalars["String"]["output"]>;
  city?: Maybe<Scalars["String"]["output"]>;
  description?: Maybe<Scalars["String"]["output"]>;
  id: Scalars["ID"]["output"];
  isActive: Scalars["Boolean"]["output"];
  lat?: Maybe<Scalars["Float"]["output"]>;
  lng?: Maybe<Scalars["Float"]["output"]>;
  logoUrl?: Maybe<Scalars["String"]["output"]>;
  name: Scalars["String"]["output"];
  namespaceSlug: Scalars["String"]["output"];
  reviewCount: Scalars["Int"]["output"];
  source: Scalars["String"]["output"];
  sourceBranchId: Scalars["String"]["output"];
};

export type CatalogBusinessFilter = {
  categoryId?: InputMaybe<Scalars["ID"]["input"]>;
  data?: InputMaybe<DefaultFilterInput>;
  namespaceSlug?: InputMaybe<Scalars["String"]["input"]>;
  source?: InputMaybe<Scalars["String"]["input"]>;
  tagId?: InputMaybe<Scalars["ID"]["input"]>;
};

export type CatalogCategory = {
  __typename?: "CatalogCategory";
  icon?: Maybe<Scalars["String"]["output"]>;
  id: Scalars["ID"]["output"];
  name: Scalars["String"]["output"];
  slug: Scalars["String"]["output"];
  sortOrder: Scalars["Int"]["output"];
};

export type CatalogReview = {
  __typename?: "CatalogReview";
  authorName: Scalars["String"]["output"];
  body: Scalars["String"]["output"];
  businessId: Scalars["ID"]["output"];
  createdAt: Scalars["String"]["output"];
  id: Scalars["ID"]["output"];
  rating: Scalars["Int"]["output"];
};

export type CatalogTag = {
  __typename?: "CatalogTag";
  businessCount: Scalars["Int"]["output"];
  id: Scalars["ID"]["output"];
  name: Scalars["String"]["output"];
};

export type CreateDeepLinkCategoryInput = {
  name: Scalars["String"]["input"];
};

export type CreateDeepLinkInput = {
  categoryId?: InputMaybe<Scalars["ID"]["input"]>;
  label?: InputMaybe<Scalars["String"]["input"]>;
  target: Scalars["String"]["input"];
};

export type CreateInviteInput = {
  actions: Scalars["String"]["input"];
  email: Scalars["String"]["input"];
  expiresAt?: InputMaybe<Scalars["Int"]["input"]>;
  namespaceSlug: Scalars["String"]["input"];
};

export type DeepLink = {
  __typename?: "DeepLink";
  appInstallCount: Scalars["Int"]["output"];
  categoryId?: Maybe<Scalars["ID"]["output"]>;
  clickCount: Scalars["Int"]["output"];
  code: Scalars["String"]["output"];
  createdAt?: Maybe<Scalars["String"]["output"]>;
  id: Scalars["ID"]["output"];
  label?: Maybe<Scalars["String"]["output"]>;
  registrationCount: Scalars["Int"]["output"];
  target: Scalars["String"]["output"];
};

export type DeepLinkCategory = {
  __typename?: "DeepLinkCategory";
  createdAt?: Maybe<Scalars["String"]["output"]>;
  id: Scalars["ID"]["output"];
  name: Scalars["String"]["output"];
};

export type DeepLinkResolution = {
  __typename?: "DeepLinkResolution";
  code?: Maybe<Scalars["String"]["output"]>;
  found: Scalars["Boolean"]["output"];
  target?: Maybe<Scalars["String"]["output"]>;
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
  initiatedByMe: Scalars["Boolean"]["output"];
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

export type Invite = {
  __typename?: "Invite";
  actions?: Maybe<Scalars["String"]["output"]>;
  createdAt: Scalars["Int"]["output"];
  email: Scalars["String"]["output"];
  expiresAt: Scalars["Int"]["output"];
  id: Scalars["ID"]["output"];
  namespaceId: Scalars["ID"]["output"];
  ownerUserId: Scalars["ID"]["output"];
};

export type Member = {
  __typename?: "Member";
  email: Scalars["String"]["output"];
  id: Scalars["ID"]["output"];
  nickname?: Maybe<Scalars["String"]["output"]>;
  userId: Scalars["ID"]["output"];
  username: Scalars["String"]["output"];
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
  catalogCreateReview: CatalogReview;
  catalogToggleFavorite: Scalars["Boolean"]["output"];
  createDeepLink: DeepLink;
  createDeepLinkCategory: DeepLinkCategory;
  createFriendship: Friendship;
  createInvite: Invite;
  createNamespace: Namespace;
  deleteDeepLink: Scalars["Boolean"]["output"];
  deleteDeepLinkCategory: Scalars["Boolean"]["output"];
  deleteInvite: Scalars["Boolean"]["output"];
  rejectFriendshipRequest: Friendship;
  removeFriendship: Scalars["Boolean"]["output"];
  removeMemberFromNamespace: Namespace;
  setMemberNickname: Member;
  setNamespaceBusinessType: Namespace;
  updateDeepLink: DeepLink;
  updateDeepLinkCategory: DeepLinkCategory;
  updateInvite: Invite;
  updateNamespace: Namespace;
  updatePatronProfile: Patron;
  updateUser: User;
};

export type MutationAcceptFriendshipRequestArgs = {
  friendshipId: Scalars["ID"]["input"];
};

export type MutationAddAppToNamespaceArgs = {
  appBundle: Scalars["String"]["input"];
  leadSource?: InputMaybe<Scalars["String"]["input"]>;
  namespaceId: Scalars["ID"]["input"];
};

export type MutationAddMemberToNamespaceArgs = {
  input: MemberToNamespaceInput;
};

export type MutationCatalogCreateReviewArgs = {
  body: Scalars["String"]["input"];
  businessId: Scalars["ID"]["input"];
  rating: Scalars["Int"]["input"];
};

export type MutationCatalogToggleFavoriteArgs = {
  businessId: Scalars["ID"]["input"];
};

export type MutationCreateDeepLinkArgs = {
  input: CreateDeepLinkInput;
};

export type MutationCreateDeepLinkCategoryArgs = {
  input: CreateDeepLinkCategoryInput;
};

export type MutationCreateFriendshipArgs = {
  friendId: Scalars["ID"]["input"];
};

export type MutationCreateInviteArgs = {
  input: CreateInviteInput;
};

export type MutationCreateNamespaceArgs = {
  input: NamespaceInput;
};

export type MutationDeleteDeepLinkArgs = {
  id: Scalars["ID"]["input"];
};

export type MutationDeleteDeepLinkCategoryArgs = {
  id: Scalars["ID"]["input"];
};

export type MutationDeleteInviteArgs = {
  id: Scalars["ID"]["input"];
};

export type MutationRejectFriendshipRequestArgs = {
  friendshipId: Scalars["ID"]["input"];
};

export type MutationRemoveFriendshipArgs = {
  friendshipId: Scalars["ID"]["input"];
};

export type MutationRemoveMemberFromNamespaceArgs = {
  input: MemberToNamespaceInput;
};

export type MutationSetMemberNicknameArgs = {
  input: SetMemberNicknameInput;
};

export type MutationSetNamespaceBusinessTypeArgs = {
  businessType: Scalars["String"]["input"];
  namespaceId: Scalars["ID"]["input"];
};

export type MutationUpdateDeepLinkArgs = {
  id: Scalars["ID"]["input"];
  input: UpdateDeepLinkInput;
};

export type MutationUpdateDeepLinkCategoryArgs = {
  id: Scalars["ID"]["input"];
  input: UpdateDeepLinkCategoryInput;
};

export type MutationUpdateInviteArgs = {
  id: Scalars["ID"]["input"];
  input: UpdateInviteInput;
};

export type MutationUpdateNamespaceArgs = {
  id: Scalars["ID"]["input"];
  input: NamespaceInput;
};

export type MutationUpdatePatronProfileArgs = {
  input: UpdatePatronProfileInput;
};

export type MutationUpdateUserArgs = {
  id: Scalars["ID"]["input"];
  input: UserInput;
};

export type Namespace = {
  __typename?: "Namespace";
  apps?: Maybe<Array<NamespaceApp>>;
  businessType?: Maybe<Scalars["String"]["output"]>;
  createdAt?: Maybe<Scalars["String"]["output"]>;
  description?: Maybe<Scalars["String"]["output"]>;
  id: Scalars["ID"]["output"];
  leadSource?: Maybe<Scalars["String"]["output"]>;
  memberInfos?: Maybe<Array<UserInfo>>;
  members?: Maybe<Array<Maybe<Member>>>;
  owner: Scalars["ID"]["output"];
  ownerEmployerNamespaces?: Maybe<Array<NamespaceRef>>;
  ownerInfo?: Maybe<UserInfo>;
  ownerOtherNamespaceCount?: Maybe<Scalars["Int"]["output"]>;
  referredByNamespace?: Maybe<NamespaceRef>;
  slug: Scalars["String"]["output"];
  title: Scalars["String"]["output"];
};

export type NamespaceApp = {
  __typename?: "NamespaceApp";
  appBundle: Scalars["String"]["output"];
  id: Scalars["ID"]["output"];
  namespaceID: Scalars["ID"]["output"];
};

export type NamespaceHealth = {
  __typename?: "NamespaceHealth";
  apps: Array<AppHealthStatus>;
};

export type NamespaceInput = {
  description?: InputMaybe<Scalars["String"]["input"]>;
  slug: Scalars["String"]["input"];
  title: Scalars["String"]["input"];
};

export type NamespaceRef = {
  __typename?: "NamespaceRef";
  id: Scalars["ID"]["output"];
  slug: Scalars["String"]["output"];
  title: Scalars["String"]["output"];
};

export type PaginatedCatalogBusinessList = {
  __typename?: "PaginatedCatalogBusinessList";
  info: PaginationInfo;
  rows: Array<CatalogBusiness>;
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

export type PaginationInput = {
  length: Scalars["Int"]["input"];
  page: Scalars["Int"]["input"];
};

export type Patron = {
  __typename?: "Patron";
  avatarUrl?: Maybe<Scalars["String"]["output"]>;
  email: Scalars["String"]["output"];
  id: Scalars["ID"]["output"];
  name?: Maybe<Scalars["String"]["output"]>;
  phone?: Maybe<Scalars["String"]["output"]>;
};

export type Query = {
  __typename?: "Query";
  _placeholder?: Maybe<Scalars["String"]["output"]>;
  adminDeepLinkCategories: Array<DeepLinkCategory>;
  adminDeepLinks: Array<DeepLink>;
  adminNamespaceHealth: NamespaceHealth;
  adminNamespaces: PaginatedNamespaceList;
  catalogBusinesses: PaginatedCatalogBusinessList;
  catalogCategories: Array<CatalogCategory>;
  catalogFavorites: Array<Scalars["ID"]["output"]>;
  catalogReviews: Array<CatalogReview>;
  catalogTags: Array<CatalogTag>;
  findUserByEmail?: Maybe<User>;
  invite?: Maybe<Invite>;
  invites: Array<Invite>;
  isAppInNamespace?: Maybe<NamespaceApp>;
  me?: Maybe<User>;
  member?: Maybe<Member>;
  members: Array<Member>;
  myFriends: PaginatedFriendshipList;
  myReferrals: Array<Namespace>;
  namespace?: Maybe<Namespace>;
  namespaces: PaginatedNamespaceList;
  patronMe?: Maybe<Patron>;
  resolveDeepLink: DeepLinkResolution;
  user?: Maybe<User>;
  users: PaginatedUserList;
};

export type QueryAdminDeepLinksArgs = {
  categoryId?: InputMaybe<Scalars["ID"]["input"]>;
};

export type QueryAdminNamespaceHealthArgs = {
  namespaceId: Scalars["ID"]["input"];
};

export type QueryAdminNamespacesArgs = {
  filter?: InputMaybe<DefaultFilterInput>;
};

export type QueryCatalogBusinessesArgs = {
  filter?: InputMaybe<CatalogBusinessFilter>;
};

export type QueryCatalogReviewsArgs = {
  businessId: Scalars["ID"]["input"];
};

export type QueryFindUserByEmailArgs = {
  email: Scalars["String"]["input"];
};

export type QueryInviteArgs = {
  id: Scalars["ID"]["input"];
};

export type QueryInvitesArgs = {
  namespaceSlug: Scalars["String"]["input"];
  pagination?: InputMaybe<PaginationInput>;
  search?: InputMaybe<Scalars["String"]["input"]>;
  sort?: InputMaybe<SortInput>;
};

export type QueryIsAppInNamespaceArgs = {
  appBundle: Scalars["String"]["input"];
  namespaceSlug: Scalars["String"]["input"];
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

export type QueryMyReferralsArgs = {
  namespaceId: Scalars["ID"]["input"];
};

export type QueryNamespaceArgs = {
  id: Scalars["ID"]["input"];
};

export type QueryNamespacesArgs = {
  filter?: InputMaybe<DefaultFilterInput>;
};

export type QueryResolveDeepLinkArgs = {
  code: Scalars["String"]["input"];
};

export type QueryUserArgs = {
  id: Scalars["ID"]["input"];
};

export type QueryUsersArgs = {
  filter?: InputMaybe<DefaultFilterInput>;
};

export type SetMemberNicknameInput = {
  namespaceId: Scalars["ID"]["input"];
  nickname: Scalars["String"]["input"];
  userId: Scalars["ID"]["input"];
};

export type SortInput = {
  direction: Scalars["String"]["input"];
  field: Scalars["String"]["input"];
};

export type UpdateDeepLinkCategoryInput = {
  name: Scalars["String"]["input"];
};

export type UpdateDeepLinkInput = {
  categoryId?: InputMaybe<Scalars["ID"]["input"]>;
  label?: InputMaybe<Scalars["String"]["input"]>;
  target: Scalars["String"]["input"];
};

export type UpdateInviteInput = {
  actions?: InputMaybe<Scalars["String"]["input"]>;
  email?: InputMaybe<Scalars["String"]["input"]>;
  expiresAt?: InputMaybe<Scalars["Int"]["input"]>;
};

export type UpdatePatronProfileInput = {
  name?: InputMaybe<Scalars["String"]["input"]>;
  phone?: InputMaybe<Scalars["String"]["input"]>;
};

export type User = {
  __typename?: "User";
  email: Scalars["String"]["output"];
  id: Scalars["ID"]["output"];
  phone?: Maybe<Scalars["String"]["output"]>;
  username: Scalars["String"]["output"];
};

export type UserInfo = {
  __typename?: "UserInfo";
  email: Scalars["String"]["output"];
  id: Scalars["ID"]["output"];
  phone?: Maybe<Scalars["String"]["output"]>;
  username: Scalars["String"]["output"];
};

export type UserInput = {
  phone?: InputMaybe<Scalars["String"]["input"]>;
  username: Scalars["String"]["input"];
};

export type MembersQueryVariables = Exact<{
  namespaceId?: InputMaybe<Scalars["ID"]["input"]>;
  page?: InputMaybe<Scalars["Int"]["input"]>;
  length?: InputMaybe<FilterPaginationLengthEnum>;
}>;

export type MembersQuery = {
  __typename?: "Query";
  members: Array<{
    __typename?: "Member";
    id: string;
    userId: string;
    username: string;
    email: string;
  }>;
};

export type CatalogCreateReviewMutationVariables = Exact<{
  businessId: Scalars["ID"]["input"];
  rating: Scalars["Int"]["input"];
  body: Scalars["String"]["input"];
}>;

export type CatalogCreateReviewMutation = {
  __typename?: "Mutation";
  catalogCreateReview: {
    __typename?: "CatalogReview";
    id: string;
    businessId: string;
    authorName: string;
    rating: number;
    body: string;
    createdAt: string;
  };
};

export type CatalogToggleFavoriteMutationVariables = Exact<{
  businessId: Scalars["ID"]["input"];
}>;

export type CatalogToggleFavoriteMutation = {
  __typename?: "Mutation";
  catalogToggleFavorite: boolean;
};

export type UpdateMyPhoneMutationVariables = Exact<{
  id: Scalars["ID"]["input"];
  username: Scalars["String"]["input"];
  phone: Scalars["String"]["input"];
}>;

export type UpdateMyPhoneMutation = {
  __typename?: "Mutation";
  updateUser: {
    __typename?: "User";
    id: string;
    email: string;
    username: string;
    phone?: string | null;
  };
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

export type IsAppInNamespaceQueryVariables = Exact<{
  namespaceSlug: Scalars["String"]["input"];
  appBundle: Scalars["String"]["input"];
}>;

export type IsAppInNamespaceQuery = {
  __typename?: "Query";
  isAppInNamespace?: {
    __typename?: "NamespaceApp";
    id: string;
    namespaceID: string;
    appBundle: string;
  } | null;
};

export type NamespacesQueryVariables = Exact<{
  filter?: InputMaybe<DefaultFilterInput>;
}>;

export type NamespacesQuery = {
  __typename?: "Query";
  namespaces: {
    __typename?: "PaginatedNamespaceList";
    rows: Array<{
      __typename?: "Namespace";
      id: string;
      title: string;
      slug: string;
      description?: string | null;
      owner: string;
    }>;
    info: { __typename?: "PaginationInfo"; count: number };
  };
};

export type CatalogBusinessesQueryVariables = Exact<{
  categoryId?: InputMaybe<Scalars["ID"]["input"]>;
  tagId?: InputMaybe<Scalars["ID"]["input"]>;
  namespaceSlug?: InputMaybe<Scalars["String"]["input"]>;
  search?: InputMaybe<Scalars["String"]["input"]>;
  page?: InputMaybe<Scalars["Int"]["input"]>;
  length?: InputMaybe<FilterPaginationLengthEnum>;
}>;

export type CatalogBusinessesQuery = {
  __typename?: "Query";
  catalogBusinesses: {
    __typename?: "PaginatedCatalogBusinessList";
    rows: Array<{
      __typename?: "CatalogBusiness";
      id: string;
      namespaceSlug: string;
      sourceBranchId: string;
      categoryId?: string | null;
      name: string;
      logoUrl?: string | null;
      description?: string | null;
      address?: string | null;
      city?: string | null;
      lat?: number | null;
      lng?: number | null;
      isActive: boolean;
      avgRating: number;
      reviewCount: number;
      source: string;
    }>;
    info: { __typename?: "PaginationInfo"; count: number };
  };
};

export type CatalogCategoriesQueryVariables = Exact<{ [key: string]: never }>;

export type CatalogCategoriesQuery = {
  __typename?: "Query";
  catalogCategories: Array<{
    __typename?: "CatalogCategory";
    id: string;
    name: string;
    slug: string;
    icon?: string | null;
    sortOrder: number;
  }>;
};

export type CatalogFavoritesQueryVariables = Exact<{ [key: string]: never }>;

export type CatalogFavoritesQuery = {
  __typename?: "Query";
  catalogFavorites: Array<string>;
};

export type CatalogReviewsQueryVariables = Exact<{
  businessId: Scalars["ID"]["input"];
}>;

export type CatalogReviewsQuery = {
  __typename?: "Query";
  catalogReviews: Array<{
    __typename?: "CatalogReview";
    id: string;
    businessId: string;
    authorName: string;
    rating: number;
    body: string;
    createdAt: string;
  }>;
};

export type CatalogTagsQueryVariables = Exact<{ [key: string]: never }>;

export type CatalogTagsQuery = {
  __typename?: "Query";
  catalogTags: Array<{
    __typename?: "CatalogTag";
    id: string;
    name: string;
    businessCount: number;
  }>;
};

export type MeQueryVariables = Exact<{ [key: string]: never }>;

export type MeQuery = {
  __typename?: "Query";
  me?: {
    __typename?: "User";
    id: string;
    username: string;
    email: string;
    phone?: string | null;
  } | null;
};

export type MyFriendsQueryVariables = Exact<{
  status?: InputMaybe<FriendshipStatus>;
}>;

export type MyFriendsQuery = {
  __typename?: "Query";
  myFriends: {
    __typename?: "PaginatedFriendshipList";
    rows: Array<{
      __typename?: "Friendship";
      id: string;
      status: FriendshipStatus;
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

export const MembersDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "Members" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "namespaceId" },
          },
          type: { kind: "NamedType", name: { kind: "Name", value: "ID" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "page" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "Int" } },
        },
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "length" },
          },
          type: {
            kind: "NamedType",
            name: { kind: "Name", value: "FilterPaginationLengthEnum" },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "members" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "filter" },
                value: {
                  kind: "ObjectValue",
                  fields: [
                    {
                      kind: "ObjectField",
                      name: { kind: "Name", value: "namespaceId" },
                      value: {
                        kind: "Variable",
                        name: { kind: "Name", value: "namespaceId" },
                      },
                    },
                    {
                      kind: "ObjectField",
                      name: { kind: "Name", value: "filter" },
                      value: {
                        kind: "ObjectValue",
                        fields: [
                          {
                            kind: "ObjectField",
                            name: { kind: "Name", value: "pagination" },
                            value: {
                              kind: "ObjectValue",
                              fields: [
                                {
                                  kind: "ObjectField",
                                  name: { kind: "Name", value: "page" },
                                  value: {
                                    kind: "Variable",
                                    name: { kind: "Name", value: "page" },
                                  },
                                },
                                {
                                  kind: "ObjectField",
                                  name: { kind: "Name", value: "length" },
                                  value: {
                                    kind: "Variable",
                                    name: { kind: "Name", value: "length" },
                                  },
                                },
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
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "userId" } },
                { kind: "Field", name: { kind: "Name", value: "username" } },
                { kind: "Field", name: { kind: "Name", value: "email" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<MembersQuery, MembersQueryVariables>;
export const CatalogCreateReviewDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "CatalogCreateReview" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "businessId" },
          },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "ID" } },
          },
        },
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "rating" },
          },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "Int" } },
          },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "body" } },
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
            name: { kind: "Name", value: "catalogCreateReview" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "businessId" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "businessId" },
                },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "rating" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "rating" },
                },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "body" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "body" },
                },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "businessId" } },
                { kind: "Field", name: { kind: "Name", value: "authorName" } },
                { kind: "Field", name: { kind: "Name", value: "rating" } },
                { kind: "Field", name: { kind: "Name", value: "body" } },
                { kind: "Field", name: { kind: "Name", value: "createdAt" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  CatalogCreateReviewMutation,
  CatalogCreateReviewMutationVariables
>;
export const CatalogToggleFavoriteDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "CatalogToggleFavorite" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "businessId" },
          },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "ID" } },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "catalogToggleFavorite" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "businessId" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "businessId" },
                },
              },
            ],
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  CatalogToggleFavoriteMutation,
  CatalogToggleFavoriteMutationVariables
>;
export const UpdateMyPhoneDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "UpdateMyPhone" },
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
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "phone" },
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
                    {
                      kind: "ObjectField",
                      name: { kind: "Name", value: "phone" },
                      value: {
                        kind: "Variable",
                        name: { kind: "Name", value: "phone" },
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
                { kind: "Field", name: { kind: "Name", value: "phone" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  UpdateMyPhoneMutation,
  UpdateMyPhoneMutationVariables
>;
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
export const IsAppInNamespaceDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "IsAppInNamespace" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "namespaceSlug" },
          },
          type: {
            kind: "NonNullType",
            type: {
              kind: "NamedType",
              name: { kind: "Name", value: "String" },
            },
          },
        },
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "appBundle" },
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
            name: { kind: "Name", value: "isAppInNamespace" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "namespaceSlug" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "namespaceSlug" },
                },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "appBundle" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "appBundle" },
                },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "namespaceID" } },
                { kind: "Field", name: { kind: "Name", value: "appBundle" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  IsAppInNamespaceQuery,
  IsAppInNamespaceQueryVariables
>;
export const NamespacesDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "Namespaces" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "filter" },
          },
          type: {
            kind: "NamedType",
            name: { kind: "Name", value: "DefaultFilterInput" },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "namespaces" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "filter" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "filter" },
                },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                {
                  kind: "Field",
                  name: { kind: "Name", value: "rows" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                      { kind: "Field", name: { kind: "Name", value: "title" } },
                      { kind: "Field", name: { kind: "Name", value: "slug" } },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "description" },
                      },
                      { kind: "Field", name: { kind: "Name", value: "owner" } },
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
} as unknown as DocumentNode<NamespacesQuery, NamespacesQueryVariables>;
export const CatalogBusinessesDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "CatalogBusinesses" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "categoryId" },
          },
          type: { kind: "NamedType", name: { kind: "Name", value: "ID" } },
        },
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "tagId" },
          },
          type: { kind: "NamedType", name: { kind: "Name", value: "ID" } },
        },
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "namespaceSlug" },
          },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "search" },
          },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "page" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "Int" } },
        },
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "length" },
          },
          type: {
            kind: "NamedType",
            name: { kind: "Name", value: "FilterPaginationLengthEnum" },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "catalogBusinesses" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "filter" },
                value: {
                  kind: "ObjectValue",
                  fields: [
                    {
                      kind: "ObjectField",
                      name: { kind: "Name", value: "categoryId" },
                      value: {
                        kind: "Variable",
                        name: { kind: "Name", value: "categoryId" },
                      },
                    },
                    {
                      kind: "ObjectField",
                      name: { kind: "Name", value: "tagId" },
                      value: {
                        kind: "Variable",
                        name: { kind: "Name", value: "tagId" },
                      },
                    },
                    {
                      kind: "ObjectField",
                      name: { kind: "Name", value: "namespaceSlug" },
                      value: {
                        kind: "Variable",
                        name: { kind: "Name", value: "namespaceSlug" },
                      },
                    },
                    {
                      kind: "ObjectField",
                      name: { kind: "Name", value: "data" },
                      value: {
                        kind: "ObjectValue",
                        fields: [
                          {
                            kind: "ObjectField",
                            name: { kind: "Name", value: "search" },
                            value: {
                              kind: "Variable",
                              name: { kind: "Name", value: "search" },
                            },
                          },
                          {
                            kind: "ObjectField",
                            name: { kind: "Name", value: "pagination" },
                            value: {
                              kind: "ObjectValue",
                              fields: [
                                {
                                  kind: "ObjectField",
                                  name: { kind: "Name", value: "page" },
                                  value: {
                                    kind: "Variable",
                                    name: { kind: "Name", value: "page" },
                                  },
                                },
                                {
                                  kind: "ObjectField",
                                  name: { kind: "Name", value: "length" },
                                  value: {
                                    kind: "Variable",
                                    name: { kind: "Name", value: "length" },
                                  },
                                },
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
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                {
                  kind: "Field",
                  name: { kind: "Name", value: "rows" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "namespaceSlug" },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "sourceBranchId" },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "categoryId" },
                      },
                      { kind: "Field", name: { kind: "Name", value: "name" } },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "logoUrl" },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "description" },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "address" },
                      },
                      { kind: "Field", name: { kind: "Name", value: "city" } },
                      { kind: "Field", name: { kind: "Name", value: "lat" } },
                      { kind: "Field", name: { kind: "Name", value: "lng" } },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "isActive" },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "avgRating" },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "reviewCount" },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "source" },
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
} as unknown as DocumentNode<
  CatalogBusinessesQuery,
  CatalogBusinessesQueryVariables
>;
export const CatalogCategoriesDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "CatalogCategories" },
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "catalogCategories" },
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "name" } },
                { kind: "Field", name: { kind: "Name", value: "slug" } },
                { kind: "Field", name: { kind: "Name", value: "icon" } },
                { kind: "Field", name: { kind: "Name", value: "sortOrder" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  CatalogCategoriesQuery,
  CatalogCategoriesQueryVariables
>;
export const CatalogFavoritesDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "CatalogFavorites" },
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          { kind: "Field", name: { kind: "Name", value: "catalogFavorites" } },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  CatalogFavoritesQuery,
  CatalogFavoritesQueryVariables
>;
export const CatalogReviewsDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "CatalogReviews" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "businessId" },
          },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "ID" } },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "catalogReviews" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "businessId" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "businessId" },
                },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "businessId" } },
                { kind: "Field", name: { kind: "Name", value: "authorName" } },
                { kind: "Field", name: { kind: "Name", value: "rating" } },
                { kind: "Field", name: { kind: "Name", value: "body" } },
                { kind: "Field", name: { kind: "Name", value: "createdAt" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<CatalogReviewsQuery, CatalogReviewsQueryVariables>;
export const CatalogTagsDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "CatalogTags" },
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "catalogTags" },
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "name" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "businessCount" },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<CatalogTagsQuery, CatalogTagsQueryVariables>;
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
                { kind: "Field", name: { kind: "Name", value: "phone" } },
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
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "status" },
          },
          type: {
            kind: "NamedType",
            name: { kind: "Name", value: "FriendshipStatus" },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "myFriends" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "filter" },
                value: {
                  kind: "ObjectValue",
                  fields: [
                    {
                      kind: "ObjectField",
                      name: { kind: "Name", value: "status" },
                      value: {
                        kind: "Variable",
                        name: { kind: "Name", value: "status" },
                      },
                    },
                  ],
                },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                {
                  kind: "Field",
                  name: { kind: "Name", value: "rows" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "status" },
                      },
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
