import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
};

export type AddBonusTransactionInput = {
  amount: Scalars['Float']['input'];
  clientId: Scalars['ID']['input'];
  createdBy: Scalars['String']['input'];
  description?: InputMaybe<Scalars['String']['input']>;
  expiresAt?: InputMaybe<Scalars['String']['input']>;
  pin?: InputMaybe<Scalars['String']['input']>;
  reason: TransactionReason;
  referenceId?: InputMaybe<Scalars['String']['input']>;
  transactionType: TransactionType;
};

export type AddStampInput = {
  addedBy: Scalars['String']['input'];
  clientId: Scalars['ID']['input'];
  pin?: InputMaybe<Scalars['String']['input']>;
  stampCardId: Scalars['ID']['input'];
  stampsToAdd: Scalars['Int']['input'];
};

export type AddTagToClientInput = {
  clientId: Scalars['ID']['input'];
  tagId: Scalars['ID']['input'];
};

export type AddTagToClientResponse = {
  __typename?: 'AddTagToClientResponse';
  success: Scalars['Boolean']['output'];
};

export type AppToken = {
  __typename?: 'AppToken';
  token: Scalars['String']['output'];
};

export type ApplyContactTagsPresetResponse = {
  __typename?: 'ApplyContactTagsPresetResponse';
  tags: Array<Tag>;
};

export type ApproveClientMembershipInput = {
  id: Scalars['ID']['input'];
  pricePaid?: InputMaybe<Scalars['String']['input']>;
  startDate?: InputMaybe<Scalars['String']['input']>;
};

export type AssignTierInput = {
  clientId: Scalars['ID']['input'];
  expiresAt?: InputMaybe<Scalars['String']['input']>;
  tierId: Scalars['ID']['input'];
};

export enum BillingInterval {
  Month = 'MONTH',
  Year = 'YEAR'
}

export type BillingSubscription = {
  __typename?: 'BillingSubscription';
  applicationCode: Scalars['String']['output'];
  endDate?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  namespace: Scalars['String']['output'];
  planCode: Scalars['String']['output'];
  planId: Scalars['String']['output'];
  startDate: Scalars['String']['output'];
  status: Scalars['String']['output'];
  trialEndDate?: Maybe<Scalars['String']['output']>;
};

export type BonusBalance = {
  __typename?: 'BonusBalance';
  availableBonuses: Scalars['Float']['output'];
  clientId: Scalars['ID']['output'];
  expiringSoon: Scalars['Float']['output'];
  hasPin: Scalars['Boolean']['output'];
  totalBonuses: Scalars['Float']['output'];
  updatedAt: Scalars['String']['output'];
};

export type BonusTransaction = {
  __typename?: 'BonusTransaction';
  amount: Scalars['Float']['output'];
  balance: Scalars['Float']['output'];
  clientId: Scalars['ID']['output'];
  createdAt: Scalars['String']['output'];
  createdBy: Scalars['String']['output'];
  description?: Maybe<Scalars['String']['output']>;
  expiresAt?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  reason: TransactionReason;
  referenceId?: Maybe<Scalars['String']['output']>;
  transactionType: TransactionType;
};

export type BonusTransactionList = {
  __typename?: 'BonusTransactionList';
  info: PaginationInfo;
  rows: Array<BonusTransaction>;
};

export type CelebrateMilestoneInput = {
  clientMilestoneId: Scalars['ID']['input'];
};

export type ChangeBonusPinInput = {
  clientId: Scalars['ID']['input'];
  newPin: Scalars['String']['input'];
  oldPin?: InputMaybe<Scalars['String']['input']>;
};

export type ChangeBonusPinResponse = {
  __typename?: 'ChangeBonusPinResponse';
  message?: Maybe<Scalars['String']['output']>;
  success: Scalars['Boolean']['output'];
};

export type CheckPromotionEligibilityInput = {
  clientId: Scalars['ID']['input'];
  promotionId: Scalars['ID']['input'];
};

export type ClaimPromotionInput = {
  claimedBy: Scalars['String']['input'];
  clientId: Scalars['ID']['input'];
  promotionId: Scalars['ID']['input'];
  referenceId?: InputMaybe<Scalars['String']['input']>;
  valueClaimed: Scalars['Float']['input'];
};

export type Client = {
  __typename?: 'Client';
  clientType: ClientType;
  createdAt: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  shortId: Scalars['String']['output'];
  status: ClientStatus;
  updatedAt: Scalars['String']['output'];
};

export type ClientChangedEvent = {
  __typename?: 'ClientChangedEvent';
  action: Scalars['String']['output'];
  changedAt: Scalars['String']['output'];
  changedBy: Scalars['ID']['output'];
  clientId: Scalars['ID']['output'];
};

export type ClientEvent = {
  __typename?: 'ClientEvent';
  clientId: Scalars['ID']['output'];
  createdAt: Scalars['String']['output'];
  eventType: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  payload: Scalars['String']['output'];
};

export type ClientEventList = {
  __typename?: 'ClientEventList';
  info: PaginationInfo;
  rows: Array<ClientEvent>;
};

export type ClientFilterInput = {
  clientType?: InputMaybe<ClientType>;
  pagination?: InputMaybe<DefaultFilterPaginationInput>;
  search?: InputMaybe<Scalars['String']['input']>;
  sort?: InputMaybe<DefaultFilterSortInput>;
  tagIds?: InputMaybe<Array<Scalars['ID']['input']>>;
};

export type ClientIdentity = {
  __typename?: 'ClientIdentity';
  clientId: Scalars['ID']['output'];
  comments?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  isPrimary: Scalars['Boolean']['output'];
  type: Scalars['String']['output'];
  value: Scalars['String']['output'];
  verifiedAt?: Maybe<Scalars['String']['output']>;
};

export type ClientList = {
  __typename?: 'ClientList';
  info: PaginationInfo;
  rows: Array<ClientProfile>;
};

export type ClientMembership = {
  __typename?: 'ClientMembership';
  activatedAt?: Maybe<Scalars['String']['output']>;
  cancelledAt?: Maybe<Scalars['String']['output']>;
  clientId: Scalars['ID']['output'];
  createdAt: Scalars['String']['output'];
  currency: Scalars['String']['output'];
  endDate: Scalars['String']['output'];
  freezeUntil: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  membershipPlanId: Scalars['ID']['output'];
  patronId: Scalars['String']['output'];
  planNameSnapshot: Scalars['String']['output'];
  planPriceSnapshot: Scalars['String']['output'];
  pricePaid: Scalars['String']['output'];
  rejectReason: Scalars['String']['output'];
  requestNote: Scalars['String']['output'];
  source: MembershipSource;
  startDate: Scalars['String']['output'];
  status: ClientMembershipStatus;
  updatedAt: Scalars['String']['output'];
  visitsTotal: Scalars['Int']['output'];
  visitsUsed: Scalars['Int']['output'];
};

export type ClientMembershipList = {
  __typename?: 'ClientMembershipList';
  info: PaginationInfo;
  rows: Array<ClientMembership>;
};

export enum ClientMembershipStatus {
  Active = 'ACTIVE',
  Cancelled = 'CANCELLED',
  Expired = 'EXPIRED',
  Frozen = 'FROZEN',
  Pending = 'PENDING',
  Rejected = 'REJECTED'
}

export type ClientMilestone = {
  __typename?: 'ClientMilestone';
  clientId: Scalars['ID']['output'];
  id: Scalars['ID']['output'];
  lastTriggeredAt?: Maybe<Scalars['String']['output']>;
  milestoneDate: Scalars['String']['output'];
  milestoneName: Scalars['String']['output'];
  nextOccurrence: Scalars['String']['output'];
  notified: Scalars['Boolean']['output'];
  rewarded: Scalars['Boolean']['output'];
  syncedAt?: Maybe<Scalars['String']['output']>;
  templateId: Scalars['ID']['output'];
  yearsCount: Scalars['Int']['output'];
};

export type ClientMilestoneList = {
  __typename?: 'ClientMilestoneList';
  info: PaginationInfo;
  rows: Array<ClientMilestone>;
};

export type ClientProfile = {
  __typename?: 'ClientProfile';
  additionalInfo?: Maybe<Scalars['String']['output']>;
  client: Client;
  contacts: Array<ClientIdentity>;
  individual?: Maybe<Individual>;
  legalEntity?: Maybe<LegalEntity>;
  tags: Array<Tag>;
};

export type ClientStampProgress = {
  __typename?: 'ClientStampProgress';
  clientId: Scalars['ID']['output'];
  completedRounds: Scalars['Int']['output'];
  currentStamps: Scalars['Int']['output'];
  id: Scalars['ID']['output'];
  lastStampAt?: Maybe<Scalars['String']['output']>;
  stampCard?: Maybe<StampCard>;
  stampCardId: Scalars['ID']['output'];
};

export enum ClientStatus {
  Active = 'ACTIVE',
  Archived = 'ARCHIVED',
  Blocked = 'BLOCKED'
}

export type ClientTag = {
  __typename?: 'ClientTag';
  clientId: Scalars['ID']['output'];
  tagId: Scalars['ID']['output'];
};

export type ClientTagsResponse = {
  __typename?: 'ClientTagsResponse';
  tags: Array<Tag>;
};

export type ClientTier = {
  __typename?: 'ClientTier';
  achievedAt: Scalars['String']['output'];
  clientId: Scalars['ID']['output'];
  currentValue: Scalars['Float']['output'];
  id: Scalars['ID']['output'];
  nextTierThreshold: Scalars['Float']['output'];
  tierId: Scalars['ID']['output'];
  updatedAt: Scalars['String']['output'];
};

export type ClientTierHistory = {
  __typename?: 'ClientTierHistory';
  changedAt: Scalars['String']['output'];
  changedBy: Scalars['String']['output'];
  clientId: Scalars['ID']['output'];
  id: Scalars['ID']['output'];
  previousTierId: Scalars['ID']['output'];
  reason: Scalars['String']['output'];
  tierId: Scalars['ID']['output'];
};

export type ClientTierHistoryList = {
  __typename?: 'ClientTierHistoryList';
  info: PaginationInfo;
  rows: Array<ClientTierHistory>;
};

export enum ClientType {
  Individual = 'INDIVIDUAL',
  Legal = 'LEGAL'
}

export type CreateDynamicFieldInput = {
  clientTypeScope: DynamicFieldClientScope;
  createdBy?: InputMaybe<Scalars['String']['input']>;
  dataType: DynamicFieldDataType;
  isRequired?: InputMaybe<Scalars['Boolean']['input']>;
  key: Scalars['String']['input'];
  label: Scalars['String']['input'];
  options?: InputMaybe<Array<Scalars['String']['input']>>;
  searchable?: InputMaybe<Scalars['Boolean']['input']>;
  viewOrder?: InputMaybe<Scalars['Int']['input']>;
};

export type CreateIdentityInput = {
  clientId: Scalars['ID']['input'];
  comments?: InputMaybe<Scalars['String']['input']>;
  isPrimary?: InputMaybe<Scalars['Boolean']['input']>;
  type: Scalars['String']['input'];
  value: Scalars['String']['input'];
};

export type CreateIndividualClientInput = {
  individual: IndividualInput;
  status?: InputMaybe<ClientStatus>;
};

export type CreateLegalEntityClientInput = {
  contactPerson?: InputMaybe<IndividualInput>;
  legalEntity: LegalEntityInput;
  status?: InputMaybe<ClientStatus>;
};

export type CreateMembershipPlanInput = {
  category?: InputMaybe<Scalars['String']['input']>;
  color?: InputMaybe<Scalars['String']['input']>;
  currency?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  durationDays?: InputMaybe<Scalars['Int']['input']>;
  freezeDaysAllowed?: InputMaybe<Scalars['Int']['input']>;
  imageUrl?: InputMaybe<Scalars['String']['input']>;
  listedOnStorefront?: InputMaybe<Scalars['Boolean']['input']>;
  name: Scalars['String']['input'];
  pin?: InputMaybe<Scalars['String']['input']>;
  price?: InputMaybe<Scalars['String']['input']>;
  sortOrder?: InputMaybe<Scalars['Int']['input']>;
  status?: InputMaybe<MembershipPlanStatus>;
  visitLimit?: InputMaybe<Scalars['Int']['input']>;
};

export type CreateMilestoneTemplateInput = {
  createdBy: Scalars['String']['input'];
  daysAfterCelebration: Scalars['Int']['input'];
  daysBeforeNotification: Scalars['Int']['input'];
  description?: InputMaybe<Scalars['String']['input']>;
  dynamicFieldKey?: InputMaybe<Scalars['String']['input']>;
  messageTemplate?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  rewardActionsJson?: InputMaybe<Scalars['String']['input']>;
  status: MilestoneStatus;
  type: MilestoneType;
};

export type CreatePromotionInput = {
  conditionsJson?: InputMaybe<Scalars['String']['input']>;
  createdBy: Scalars['String']['input'];
  description?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  status: PromotionStatus;
  targetId?: InputMaybe<Scalars['String']['input']>;
  targetType: PromotionTargetType;
  totalUsageLimit: Scalars['Int']['input'];
  type: PromotionType;
  usageLimitPerClient: Scalars['Int']['input'];
  validFrom?: InputMaybe<Scalars['String']['input']>;
  validUntil?: InputMaybe<Scalars['String']['input']>;
  value: Scalars['Float']['input'];
};

export type CreateRuleInput = {
  actionsJson: Scalars['String']['input'];
  conditionsJson: Scalars['String']['input'];
  createdBy: Scalars['String']['input'];
  description: Scalars['String']['input'];
  name: Scalars['String']['input'];
  priority: Scalars['Int']['input'];
  segmentId?: InputMaybe<Scalars['String']['input']>;
  status: RuleStatus;
  trigger: RuleTrigger;
  type: RuleType;
  validFrom?: InputMaybe<Scalars['String']['input']>;
  validUntil?: InputMaybe<Scalars['String']['input']>;
};

export type CreateSegmentInput = {
  createdBy: Scalars['String']['input'];
  name: Scalars['String']['input'];
};

export type CreateSegmentRuleInput = {
  fieldKey: Scalars['String']['input'];
  operator: Scalars['String']['input'];
  segmentId: Scalars['ID']['input'];
  value: Scalars['String']['input'];
};

export type CreateStampCardInput = {
  description?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  pin?: InputMaybe<Scalars['String']['input']>;
  rewardDescription: Scalars['String']['input'];
  totalStamps: Scalars['Int']['input'];
  type: StampCardType;
  validFrom?: InputMaybe<Scalars['String']['input']>;
  validUntil?: InputMaybe<Scalars['String']['input']>;
};

export type CreateTagInput = {
  name: Scalars['String']['input'];
};

export type CreateTierInput = {
  benefitsJson: Scalars['String']['input'];
  bonusMultiplier: Scalars['Float']['input'];
  colorHex: Scalars['String']['input'];
  description: Scalars['String']['input'];
  iconUrl: Scalars['String']['input'];
  level: Scalars['Int']['input'];
  name: Scalars['String']['input'];
  qualificationCriteria: TierQualificationCriteria;
  qualificationThreshold: Scalars['Float']['input'];
  status: TierStatus;
};

export type DefaultFilterInput = {
  pagination?: InputMaybe<DefaultFilterPaginationInput>;
  search?: InputMaybe<Scalars['String']['input']>;
  sort?: InputMaybe<DefaultFilterSortInput>;
};

export type DefaultFilterPaginationInput = {
  length?: InputMaybe<FilterPaginationLengthEnum>;
  page?: InputMaybe<Scalars['Int']['input']>;
};

export type DefaultFilterSortInput = {
  by?: InputMaybe<FilterSortByEnum>;
  field?: InputMaybe<Scalars['String']['input']>;
  nullsFirst?: InputMaybe<Scalars['Boolean']['input']>;
};

export type DeleteDynamicFieldResponse = {
  __typename?: 'DeleteDynamicFieldResponse';
  success: Scalars['Boolean']['output'];
};

export type DeleteDynamicFieldValueResponse = {
  __typename?: 'DeleteDynamicFieldValueResponse';
  success: Scalars['Boolean']['output'];
};

export type DeleteIdentityResponse = {
  __typename?: 'DeleteIdentityResponse';
  success: Scalars['Boolean']['output'];
};

export type DeleteMembershipPlanResponse = {
  __typename?: 'DeleteMembershipPlanResponse';
  success: Scalars['Boolean']['output'];
};

export type DeleteMilestoneTemplateResponse = {
  __typename?: 'DeleteMilestoneTemplateResponse';
  success: Scalars['Boolean']['output'];
};

export type DeletePromotionResponse = {
  __typename?: 'DeletePromotionResponse';
  success: Scalars['Boolean']['output'];
};

export type DeleteRuleResponse = {
  __typename?: 'DeleteRuleResponse';
  success: Scalars['Boolean']['output'];
};

export type DeleteSegmentResponse = {
  __typename?: 'DeleteSegmentResponse';
  success: Scalars['Boolean']['output'];
};

export type DeleteSegmentRuleResponse = {
  __typename?: 'DeleteSegmentRuleResponse';
  success: Scalars['Boolean']['output'];
};

export type DeleteStampCardResponse = {
  __typename?: 'DeleteStampCardResponse';
  success: Scalars['Boolean']['output'];
};

export type DeleteTagResponse = {
  __typename?: 'DeleteTagResponse';
  success: Scalars['Boolean']['output'];
};

export type DeleteTierResponse = {
  __typename?: 'DeleteTierResponse';
  success: Scalars['Boolean']['output'];
};

export type DynamicField = {
  __typename?: 'DynamicField';
  clientTypeScope: DynamicFieldClientScope;
  createdAt: Scalars['String']['output'];
  createdBy: Scalars['String']['output'];
  dataType: DynamicFieldDataType;
  deletedAt?: Maybe<Scalars['String']['output']>;
  deletedBy?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  isRequired: Scalars['Boolean']['output'];
  key: Scalars['String']['output'];
  label: Scalars['String']['output'];
  options: Array<Scalars['String']['output']>;
  searchable: Scalars['Boolean']['output'];
  viewOrder: Scalars['Int']['output'];
};

export enum DynamicFieldClientScope {
  All = 'ALL',
  Individual = 'INDIVIDUAL',
  Legal = 'LEGAL'
}

export enum DynamicFieldDataType {
  Boolean = 'BOOLEAN',
  Date = 'DATE',
  Json = 'JSON',
  MultiSelect = 'MULTI_SELECT',
  Number = 'NUMBER',
  Select = 'SELECT',
  String = 'STRING'
}

export type DynamicFieldFilterInput = {
  clientTypeScope?: InputMaybe<DynamicFieldClientScope>;
  dataType?: InputMaybe<DynamicFieldDataType>;
  includeDeleted?: InputMaybe<Scalars['Boolean']['input']>;
  pagination?: InputMaybe<DefaultFilterPaginationInput>;
  search?: InputMaybe<Scalars['String']['input']>;
  sort?: InputMaybe<DefaultFilterSortInput>;
};

export type DynamicFieldList = {
  __typename?: 'DynamicFieldList';
  info: PaginationInfo;
  rows: Array<DynamicField>;
};

export type DynamicFieldValue = {
  __typename?: 'DynamicFieldValue';
  entityId: Scalars['ID']['output'];
  fieldId: Scalars['ID']['output'];
  id: Scalars['ID']['output'];
  updatedAt: Scalars['String']['output'];
  valueBool?: Maybe<Scalars['Boolean']['output']>;
  valueDate?: Maybe<Scalars['String']['output']>;
  valueJson?: Maybe<Scalars['String']['output']>;
  valueNumber?: Maybe<Scalars['Float']['output']>;
  valueString?: Maybe<Scalars['String']['output']>;
};

export type DynamicFieldValueList = {
  __typename?: 'DynamicFieldValueList';
  info: PaginationInfo;
  rows: Array<DynamicFieldValue>;
};

export type EvaluateRulesInput = {
  clientId: Scalars['ID']['input'];
  contextJson: Scalars['String']['input'];
  trigger: RuleTrigger;
};

export type EvaluateRulesResponse = {
  __typename?: 'EvaluateRulesResponse';
  evaluations: Array<RuleEvaluation>;
  rulesMatched: Scalars['Int']['output'];
};

export type ExpireBonusesInput = {
  clientId?: InputMaybe<Scalars['ID']['input']>;
};

export type ExpireBonusesResponse = {
  __typename?: 'ExpireBonusesResponse';
  amountExpired: Scalars['Float']['output'];
  bonusesExpired: Scalars['Int']['output'];
};

export enum FilterPaginationLengthEnum {
  Eighty = 'EIGHTY',
  EightyFive = 'EIGHTY_FIVE',
  Fifteen = 'FIFTEEN',
  Fifty = 'FIFTY',
  FiftyFive = 'FIFTY_FIVE',
  Forty = 'FORTY',
  FortyFive = 'FORTY_FIVE',
  Ninety = 'NINETY',
  NinetyFive = 'NINETY_FIVE',
  OneHundred = 'ONE_HUNDRED',
  Seventy = 'SEVENTY',
  SeventyFive = 'SEVENTY_FIVE',
  Sixty = 'SIXTY',
  SixtyFive = 'SIXTY_FIVE',
  Ten = 'TEN',
  Thirty = 'THIRTY',
  ThirtyFive = 'THIRTY_FIVE',
  Twenty = 'TWENTY',
  TwentyFive = 'TWENTY_FIVE'
}

export enum FilterSortByEnum {
  Asc = 'ASC',
  Desc = 'DESC'
}

export type FreezeClientMembershipInput = {
  id: Scalars['ID']['input'];
  untilDate: Scalars['String']['input'];
};

export type GetClientPromotionsResponse = {
  __typename?: 'GetClientPromotionsResponse';
  promotions: Array<Promotion>;
};

export type GetUpcomingMilestonesInput = {
  clientId?: InputMaybe<Scalars['ID']['input']>;
  daysAhead?: InputMaybe<Scalars['Int']['input']>;
};

export type IdentityList = {
  __typename?: 'IdentityList';
  info: PaginationInfo;
  rows: Array<ClientIdentity>;
};

export type Individual = {
  __typename?: 'Individual';
  birthDate?: Maybe<Scalars['String']['output']>;
  clientId: Scalars['ID']['output'];
  firstName: Scalars['String']['output'];
  gender?: Maybe<Scalars['Boolean']['output']>;
  lastName: Scalars['String']['output'];
  middleName?: Maybe<Scalars['String']['output']>;
};

export type IndividualInput = {
  birthDate?: InputMaybe<Scalars['String']['input']>;
  firstName: Scalars['String']['input'];
  gender?: InputMaybe<Scalars['Boolean']['input']>;
  lastName?: InputMaybe<Scalars['String']['input']>;
  middleName?: InputMaybe<Scalars['String']['input']>;
};

export type IssueClientMembershipInput = {
  clientId: Scalars['ID']['input'];
  membershipPlanId: Scalars['ID']['input'];
  note?: InputMaybe<Scalars['String']['input']>;
  pricePaid?: InputMaybe<Scalars['String']['input']>;
  startDate?: InputMaybe<Scalars['String']['input']>;
};

export type LegalEntity = {
  __typename?: 'LegalEntity';
  binIin?: Maybe<Scalars['String']['output']>;
  brandName?: Maybe<Scalars['String']['output']>;
  clientId: Scalars['ID']['output'];
  legalName: Scalars['String']['output'];
  registrationCountry?: Maybe<Scalars['String']['output']>;
  registrationDate?: Maybe<Scalars['String']['output']>;
};

export type LegalEntityInput = {
  binIin?: InputMaybe<Scalars['String']['input']>;
  brandName?: InputMaybe<Scalars['String']['input']>;
  legalName: Scalars['String']['input'];
  registrationCountry?: InputMaybe<Scalars['String']['input']>;
  registrationDate?: InputMaybe<Scalars['String']['input']>;
};

export type ListBonusTransactionsInput = {
  clientId: Scalars['ID']['input'];
  dateFrom?: InputMaybe<Scalars['String']['input']>;
  dateTo?: InputMaybe<Scalars['String']['input']>;
  transactionType?: InputMaybe<TransactionType>;
};

export type ListClientMilestonesInput = {
  clientId: Scalars['ID']['input'];
  templateId?: InputMaybe<Scalars['ID']['input']>;
};

export type ListClientTierHistoryInput = {
  clientId: Scalars['ID']['input'];
};

export type ListMilestoneTemplatesInput = {
  status?: InputMaybe<MilestoneStatus>;
  type?: InputMaybe<MilestoneType>;
};

export type ListPromotionClaimsInput = {
  clientId?: InputMaybe<Scalars['ID']['input']>;
  promotionId?: InputMaybe<Scalars['ID']['input']>;
};

export type ListPromotionsInput = {
  activeOnly?: InputMaybe<Scalars['Boolean']['input']>;
  status?: InputMaybe<PromotionStatus>;
  targetType?: InputMaybe<PromotionTargetType>;
  type?: InputMaybe<PromotionType>;
};

export type ListRulesInput = {
  status?: InputMaybe<RuleStatus>;
  trigger?: InputMaybe<RuleTrigger>;
  type?: InputMaybe<RuleType>;
};

export type LoyaltyRule = {
  __typename?: 'LoyaltyRule';
  actionsJson: Scalars['String']['output'];
  conditionsJson: Scalars['String']['output'];
  createdAt: Scalars['String']['output'];
  createdBy: Scalars['String']['output'];
  description: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  priority: Scalars['Int']['output'];
  segmentId?: Maybe<Scalars['String']['output']>;
  status: RuleStatus;
  trigger: RuleTrigger;
  type: RuleType;
  updatedAt: Scalars['String']['output'];
  validFrom?: Maybe<Scalars['String']['output']>;
  validUntil?: Maybe<Scalars['String']['output']>;
};

export enum MemberAccessRole {
  Admin = 'ADMIN',
  Editor = 'EDITOR',
  Viewer = 'VIEWER'
}

export type MemberRoleInfo = {
  __typename?: 'MemberRoleInfo';
  role: MemberAccessRole;
  userId: Scalars['ID']['output'];
};

export type MembershipBrandSettings = {
  __typename?: 'MembershipBrandSettings';
  acceptRequests: Scalars['Boolean']['output'];
  address: Scalars['String']['output'];
  autoApproveRequests: Scalars['Boolean']['output'];
  city: Scalars['String']['output'];
  coverImageUrl: Scalars['String']['output'];
  currencyCode: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  lat: Scalars['Float']['output'];
  listedInCatalog: Scalars['Boolean']['output'];
  lng: Scalars['Float']['output'];
  logoUrl: Scalars['String']['output'];
  name: Scalars['String']['output'];
  phone: Scalars['String']['output'];
  primaryColor: Scalars['String']['output'];
  secondaryColor: Scalars['String']['output'];
  seoDescription: Scalars['String']['output'];
  seoTitle: Scalars['String']['output'];
  socialLinks: Scalars['String']['output'];
  welcomeMessage: Scalars['String']['output'];
};

export type MembershipPlan = {
  __typename?: 'MembershipPlan';
  category: Scalars['String']['output'];
  color: Scalars['String']['output'];
  createdAt: Scalars['String']['output'];
  currency: Scalars['String']['output'];
  description: Scalars['String']['output'];
  durationDays: Scalars['Int']['output'];
  freezeDaysAllowed: Scalars['Int']['output'];
  hasPin: Scalars['Boolean']['output'];
  id: Scalars['ID']['output'];
  imageUrl: Scalars['String']['output'];
  listedOnStorefront: Scalars['Boolean']['output'];
  name: Scalars['String']['output'];
  price: Scalars['String']['output'];
  sortOrder: Scalars['Int']['output'];
  status: MembershipPlanStatus;
  updatedAt: Scalars['String']['output'];
  visitLimit: Scalars['Int']['output'];
};

export type MembershipPlanList = {
  __typename?: 'MembershipPlanList';
  info: PaginationInfo;
  rows: Array<MembershipPlan>;
};

export enum MembershipPlanStatus {
  Active = 'ACTIVE',
  Archived = 'ARCHIVED',
  Inactive = 'INACTIVE'
}

export enum MembershipSource {
  Admin = 'ADMIN',
  Storefront = 'STOREFRONT'
}

export type MembershipStorefront = {
  __typename?: 'MembershipStorefront';
  brand: MembershipBrandSettings;
  plans: Array<MembershipPlan>;
};

export type MembershipVisit = {
  __typename?: 'MembershipVisit';
  checkedInAt: Scalars['String']['output'];
  checkedInBy: Scalars['String']['output'];
  clientMembershipId: Scalars['ID']['output'];
  id: Scalars['ID']['output'];
  note: Scalars['String']['output'];
};

export type MembershipVisitList = {
  __typename?: 'MembershipVisitList';
  info: PaginationInfo;
  rows: Array<MembershipVisit>;
};

export enum MilestoneStatus {
  MilestoneStatusActive = 'MILESTONE_STATUS_ACTIVE',
  MilestoneStatusInactive = 'MILESTONE_STATUS_INACTIVE',
  MilestoneStatusUnspecified = 'MILESTONE_STATUS_UNSPECIFIED'
}

export type MilestoneTemplate = {
  __typename?: 'MilestoneTemplate';
  createdAt: Scalars['String']['output'];
  createdBy: Scalars['String']['output'];
  daysAfterCelebration: Scalars['Int']['output'];
  daysBeforeNotification: Scalars['Int']['output'];
  description?: Maybe<Scalars['String']['output']>;
  dynamicFieldKey?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  messageTemplate?: Maybe<Scalars['String']['output']>;
  name: Scalars['String']['output'];
  rewardActionsJson?: Maybe<Scalars['String']['output']>;
  status: MilestoneStatus;
  type: MilestoneType;
  updatedAt: Scalars['String']['output'];
};

export type MilestoneTemplateList = {
  __typename?: 'MilestoneTemplateList';
  info: PaginationInfo;
  rows: Array<MilestoneTemplate>;
};

export enum MilestoneType {
  MilestoneTypeAnniversary = 'MILESTONE_TYPE_ANNIVERSARY',
  MilestoneTypeBirthday = 'MILESTONE_TYPE_BIRTHDAY',
  MilestoneTypeCustomDate = 'MILESTONE_TYPE_CUSTOM_DATE',
  MilestoneTypeUnspecified = 'MILESTONE_TYPE_UNSPECIFIED'
}

export type Mutation = {
  __typename?: 'Mutation';
  activatePromotion: Promotion;
  addBonusTransaction: BonusTransaction;
  addStamp: ClientStampProgress;
  addTagToClient: AddTagToClientResponse;
  applyContactTagsPreset: ApplyContactTagsPresetResponse;
  approveClientMembership: ClientMembership;
  assignTier: ClientTier;
  cancelClientMembership: ClientMembership;
  celebrateMilestone: ClientMilestone;
  changeBonusPin: ChangeBonusPinResponse;
  claimPromotion: PromotionClaim;
  contactsSetMemberRole: MemberRoleInfo;
  createDynamicField: DynamicField;
  createIdentity: ClientIdentity;
  createIndividualClient: ClientProfile;
  createLegalEntityClient: ClientProfile;
  createMembershipPlan: MembershipPlan;
  createMilestoneTemplate: MilestoneTemplate;
  createPromotion: Promotion;
  createRule: LoyaltyRule;
  createSegment: Segment;
  createSegmentRule: SegmentRule;
  createStampCard: StampCard;
  createTag: Tag;
  createTier: Tier;
  deactivatePromotion: Promotion;
  deleteDynamicField: DeleteDynamicFieldResponse;
  deleteDynamicFieldValue: DeleteDynamicFieldValueResponse;
  deleteIdentity: DeleteIdentityResponse;
  deleteMembershipPlan: DeleteMembershipPlanResponse;
  deleteMilestoneTemplate: DeleteMilestoneTemplateResponse;
  deletePromotion: DeletePromotionResponse;
  deleteRule: DeleteRuleResponse;
  deleteSegment: DeleteSegmentResponse;
  deleteSegmentRule: DeleteSegmentRuleResponse;
  deleteStampCard: DeleteStampCardResponse;
  deleteTag: DeleteTagResponse;
  deleteTier: DeleteTierResponse;
  expireBonuses: ExpireBonusesResponse;
  freezeClientMembership: ClientMembership;
  getAppToken?: Maybe<AppToken>;
  issueClientMembership: ClientMembership;
  recalculateClientTiers: RecalculateClientTiersResponse;
  recordMembershipVisit: ClientMembership;
  redeemStampCard: StampRedemption;
  rejectClientMembership: ClientMembership;
  removeTagFromClient: RemoveTagFromClientResponse;
  requestMembership: ClientMembership;
  restoreDynamicField: DynamicField;
  restoreTag: RestoreTagResponse;
  setDynamicFieldValue: DynamicFieldValue;
  setPrimaryIdentity: ClientIdentity;
  subscribePlan: BillingSubscription;
  syncClientMilestones: SyncClientMilestonesResponse;
  unfreezeClientMembership: ClientMembership;
  updateClientStatus: Client;
  updateClientTier: ClientTier;
  updateDynamicField: DynamicField;
  updateIdentity: ClientIdentity;
  updateIndividualClient: ClientProfile;
  updateLegalEntityClient: ClientProfile;
  updateMembershipPlan: MembershipPlan;
  updateMilestoneTemplate: MilestoneTemplate;
  updatePromotion: Promotion;
  updateRule: LoyaltyRule;
  updateSegment: Segment;
  updateSegmentRule: SegmentRule;
  updateStampCard: StampCard;
  updateTag: Tag;
  updateTier: Tier;
  upsertMembershipBrandSettings: MembershipBrandSettings;
  verifyIdentity: VerifyIdentityResponse;
};


export type MutationActivatePromotionArgs = {
  id: Scalars['ID']['input'];
};


export type MutationAddBonusTransactionArgs = {
  input: AddBonusTransactionInput;
};


export type MutationAddStampArgs = {
  input: AddStampInput;
};


export type MutationAddTagToClientArgs = {
  input: AddTagToClientInput;
};


export type MutationApplyContactTagsPresetArgs = {
  businessType: Scalars['String']['input'];
  locale: Scalars['String']['input'];
};


export type MutationApproveClientMembershipArgs = {
  input: ApproveClientMembershipInput;
};


export type MutationAssignTierArgs = {
  input: AssignTierInput;
};


export type MutationCancelClientMembershipArgs = {
  id: Scalars['ID']['input'];
};


export type MutationCelebrateMilestoneArgs = {
  input: CelebrateMilestoneInput;
};


export type MutationChangeBonusPinArgs = {
  input: ChangeBonusPinInput;
};


export type MutationClaimPromotionArgs = {
  input: ClaimPromotionInput;
};


export type MutationContactsSetMemberRoleArgs = {
  role: MemberAccessRole;
  userId: Scalars['ID']['input'];
};


export type MutationCreateDynamicFieldArgs = {
  input: CreateDynamicFieldInput;
};


export type MutationCreateIdentityArgs = {
  input: CreateIdentityInput;
};


export type MutationCreateIndividualClientArgs = {
  input: CreateIndividualClientInput;
};


export type MutationCreateLegalEntityClientArgs = {
  input: CreateLegalEntityClientInput;
};


export type MutationCreateMembershipPlanArgs = {
  input: CreateMembershipPlanInput;
};


export type MutationCreateMilestoneTemplateArgs = {
  input: CreateMilestoneTemplateInput;
};


export type MutationCreatePromotionArgs = {
  input: CreatePromotionInput;
};


export type MutationCreateRuleArgs = {
  input: CreateRuleInput;
};


export type MutationCreateSegmentArgs = {
  input: CreateSegmentInput;
};


export type MutationCreateSegmentRuleArgs = {
  input: CreateSegmentRuleInput;
};


export type MutationCreateStampCardArgs = {
  input: CreateStampCardInput;
};


export type MutationCreateTagArgs = {
  input: CreateTagInput;
};


export type MutationCreateTierArgs = {
  input: CreateTierInput;
};


export type MutationDeactivatePromotionArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteDynamicFieldArgs = {
  deletedBy?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
};


export type MutationDeleteDynamicFieldValueArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteIdentityArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteMembershipPlanArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteMilestoneTemplateArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeletePromotionArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteRuleArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteSegmentArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteSegmentRuleArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteStampCardArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteTagArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteTierArgs = {
  id: Scalars['ID']['input'];
};


export type MutationExpireBonusesArgs = {
  input: ExpireBonusesInput;
};


export type MutationFreezeClientMembershipArgs = {
  input: FreezeClientMembershipInput;
};


export type MutationIssueClientMembershipArgs = {
  input: IssueClientMembershipInput;
};


export type MutationRecalculateClientTiersArgs = {
  input: RecalculateClientTiersInput;
};


export type MutationRecordMembershipVisitArgs = {
  input: RecordMembershipVisitInput;
};


export type MutationRedeemStampCardArgs = {
  input: RedeemStampCardInput;
};


export type MutationRejectClientMembershipArgs = {
  input: RejectClientMembershipInput;
};


export type MutationRemoveTagFromClientArgs = {
  input: RemoveTagFromClientInput;
};


export type MutationRequestMembershipArgs = {
  input: RequestMembershipInput;
};


export type MutationRestoreDynamicFieldArgs = {
  id: Scalars['ID']['input'];
};


export type MutationRestoreTagArgs = {
  id: Scalars['ID']['input'];
};


export type MutationSetDynamicFieldValueArgs = {
  input: SetDynamicFieldValueInput;
};


export type MutationSetPrimaryIdentityArgs = {
  input: SetPrimaryIdentityInput;
};


export type MutationSubscribePlanArgs = {
  appBundle: Scalars['String']['input'];
  planCode: Scalars['String']['input'];
};


export type MutationSyncClientMilestonesArgs = {
  input: SyncClientMilestonesInput;
};


export type MutationUnfreezeClientMembershipArgs = {
  id: Scalars['ID']['input'];
};


export type MutationUpdateClientStatusArgs = {
  id: Scalars['ID']['input'];
  status: ClientStatus;
};


export type MutationUpdateClientTierArgs = {
  input: UpdateClientTierInput;
};


export type MutationUpdateDynamicFieldArgs = {
  input: UpdateDynamicFieldInput;
};


export type MutationUpdateIdentityArgs = {
  input: UpdateIdentityInput;
};


export type MutationUpdateIndividualClientArgs = {
  id: Scalars['ID']['input'];
  input: IndividualInput;
};


export type MutationUpdateLegalEntityClientArgs = {
  id: Scalars['ID']['input'];
  input: LegalEntityInput;
};


export type MutationUpdateMembershipPlanArgs = {
  input: UpdateMembershipPlanInput;
};


export type MutationUpdateMilestoneTemplateArgs = {
  input: UpdateMilestoneTemplateInput;
};


export type MutationUpdatePromotionArgs = {
  input: UpdatePromotionInput;
};


export type MutationUpdateRuleArgs = {
  input: UpdateRuleInput;
};


export type MutationUpdateSegmentArgs = {
  input: UpdateSegmentInput;
};


export type MutationUpdateSegmentRuleArgs = {
  input: UpdateSegmentRuleInput;
};


export type MutationUpdateStampCardArgs = {
  input: UpdateStampCardInput;
};


export type MutationUpdateTagArgs = {
  input: UpdateTagInput;
};


export type MutationUpdateTierArgs = {
  input: UpdateTierInput;
};


export type MutationUpsertMembershipBrandSettingsArgs = {
  input: UpsertMembershipBrandSettingsInput;
};


export type MutationVerifyIdentityArgs = {
  input: VerifyIdentityInput;
};

export type PaginationInfo = {
  __typename?: 'PaginationInfo';
  count: Scalars['Int']['output'];
};

export type PatronLoyaltyCard = {
  __typename?: 'PatronLoyaltyCard';
  bonusBalance?: Maybe<BonusBalance>;
  clientId: Scalars['ID']['output'];
};

export type Plan = {
  __typename?: 'Plan';
  amountCents: Scalars['Int']['output'];
  code: Scalars['String']['output'];
  currency: Scalars['String']['output'];
  description: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  includedSeats: Scalars['Int']['output'];
  includedUnits: Scalars['Int']['output'];
  interval: BillingInterval;
  metadataJson: Scalars['String']['output'];
  name: Scalars['String']['output'];
  overagePriceCents: Scalars['Int']['output'];
  status: PlanStatus;
  trialDays: Scalars['Int']['output'];
};

export type PlanLimits = {
  __typename?: 'PlanLimits';
  currentPeriodEnd: Scalars['String']['output'];
  isSubscriptionActive: Scalars['Boolean']['output'];
  limitsJson: Scalars['String']['output'];
  planCode: Scalars['String']['output'];
  planName: Scalars['String']['output'];
  subscriptionStatus: SubscriptionStatus;
  trialEndsAt?: Maybe<Scalars['String']['output']>;
};

export enum PlanStatus {
  PlanActive = 'PLAN_ACTIVE',
  PlanArchived = 'PLAN_ARCHIVED'
}

export type PlansResponse = {
  __typename?: 'PlansResponse';
  plans: Array<Plan>;
  total: Scalars['Int']['output'];
};

export type Promotion = {
  __typename?: 'Promotion';
  conditionsJson?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['String']['output'];
  createdBy: Scalars['String']['output'];
  currentUsageCount: Scalars['Int']['output'];
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  status: PromotionStatus;
  targetId?: Maybe<Scalars['String']['output']>;
  targetType: PromotionTargetType;
  totalUsageLimit: Scalars['Int']['output'];
  type: PromotionType;
  updatedAt: Scalars['String']['output'];
  usageLimitPerClient: Scalars['Int']['output'];
  validFrom?: Maybe<Scalars['String']['output']>;
  validUntil?: Maybe<Scalars['String']['output']>;
  value: Scalars['Float']['output'];
};

export type PromotionClaim = {
  __typename?: 'PromotionClaim';
  claimedAt: Scalars['String']['output'];
  claimedBy: Scalars['String']['output'];
  clientId: Scalars['ID']['output'];
  id: Scalars['ID']['output'];
  promotionId: Scalars['ID']['output'];
  referenceId?: Maybe<Scalars['String']['output']>;
  valueClaimed: Scalars['Float']['output'];
};

export type PromotionClaimList = {
  __typename?: 'PromotionClaimList';
  info: PaginationInfo;
  rows: Array<PromotionClaim>;
};

export type PromotionEligibilityResult = {
  __typename?: 'PromotionEligibilityResult';
  eligible: Scalars['Boolean']['output'];
  promotion?: Maybe<Promotion>;
  reason?: Maybe<Scalars['String']['output']>;
};

export type PromotionList = {
  __typename?: 'PromotionList';
  info: PaginationInfo;
  rows: Array<Promotion>;
};

export enum PromotionStatus {
  Active = 'ACTIVE',
  Archived = 'ARCHIVED',
  Draft = 'DRAFT',
  Expired = 'EXPIRED',
  Paused = 'PAUSED'
}

export enum PromotionTargetType {
  AllClients = 'ALL_CLIENTS',
  Individual = 'INDIVIDUAL',
  Segment = 'SEGMENT',
  Tier = 'TIER'
}

export enum PromotionType {
  BonusMultiplier = 'BONUS_MULTIPLIER',
  Cashback = 'CASHBACK',
  Custom = 'CUSTOM',
  Discount = 'DISCOUNT',
  FixedBonus = 'FIXED_BONUS',
  FreeStamps = 'FREE_STAMPS'
}

export type Query = {
  __typename?: 'Query';
  bonusBalance?: Maybe<BonusBalance>;
  checkPromotionEligibility: PromotionEligibilityResult;
  client?: Maybe<ClientProfile>;
  clientByIdentity?: Maybe<ClientProfile>;
  clientByShortId?: Maybe<ClientProfile>;
  clientEvents: ClientEventList;
  clientIdentities: IdentityList;
  clientMembership?: Maybe<ClientMembership>;
  clientMemberships: ClientMembershipList;
  clientMilestones: ClientMilestoneList;
  clientPromotions: GetClientPromotionsResponse;
  clientStampProgress?: Maybe<ClientStampProgress>;
  clientTags: ClientTagsResponse;
  clientTier?: Maybe<ClientTier>;
  clientTierHistory?: Maybe<ClientTierHistoryList>;
  clients: ClientList;
  contactsMemberRoles: Array<MemberRoleInfo>;
  dynamicField?: Maybe<DynamicField>;
  dynamicFieldValue?: Maybe<DynamicFieldValue>;
  dynamicFieldValues: DynamicFieldValueList;
  dynamicFields: DynamicFieldList;
  evaluateRules?: Maybe<EvaluateRulesResponse>;
  evaluateTierUpgrade?: Maybe<TierUpgradeResult>;
  getActiveSubscription?: Maybe<BillingSubscription>;
  getPlanLimits?: Maybe<PlanLimits>;
  getPlans: PlansResponse;
  identity?: Maybe<ClientIdentity>;
  membershipBrandSettings?: Maybe<MembershipBrandSettings>;
  membershipPlan?: Maybe<MembershipPlan>;
  membershipPlans: MembershipPlanList;
  membershipRequests: ClientMembershipList;
  membershipStorefront?: Maybe<MembershipStorefront>;
  membershipVisits: MembershipVisitList;
  milestoneTemplate?: Maybe<MilestoneTemplate>;
  milestoneTemplates: MilestoneTemplateList;
  patronLoyaltyCard?: Maybe<PatronLoyaltyCard>;
  patronMemberships: Array<ClientMembership>;
  promotion?: Maybe<Promotion>;
  promotionClaims: PromotionClaimList;
  promotions: PromotionList;
  rule?: Maybe<LoyaltyRule>;
  rules?: Maybe<RuleList>;
  segment?: Maybe<Segment>;
  segmentRules: SegmentRuleList;
  segments: SegmentList;
  stampCard?: Maybe<StampCard>;
  stampCards: StampCardList;
  tag?: Maybe<Tag>;
  tags: TagList;
  tier?: Maybe<Tier>;
  tiers?: Maybe<TierList>;
  upcomingMilestones: UpcomingMilestonesList;
};


export type QueryBonusBalanceArgs = {
  clientId: Scalars['ID']['input'];
};


export type QueryCheckPromotionEligibilityArgs = {
  input: CheckPromotionEligibilityInput;
};


export type QueryClientArgs = {
  id: Scalars['ID']['input'];
};


export type QueryClientByIdentityArgs = {
  type: Scalars['String']['input'];
  value: Scalars['String']['input'];
};


export type QueryClientByShortIdArgs = {
  shortId: Scalars['String']['input'];
};


export type QueryClientEventsArgs = {
  clientId: Scalars['ID']['input'];
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryClientIdentitiesArgs = {
  clientId: Scalars['ID']['input'];
};


export type QueryClientMembershipArgs = {
  id: Scalars['ID']['input'];
};


export type QueryClientMembershipsArgs = {
  clientId?: InputMaybe<Scalars['ID']['input']>;
  filter?: InputMaybe<DefaultFilterInput>;
  membershipPlanId?: InputMaybe<Scalars['ID']['input']>;
  status?: InputMaybe<ClientMembershipStatus>;
};


export type QueryClientMilestonesArgs = {
  input: ListClientMilestonesInput;
};


export type QueryClientPromotionsArgs = {
  clientId: Scalars['ID']['input'];
  type?: InputMaybe<PromotionType>;
};


export type QueryClientStampProgressArgs = {
  clientId: Scalars['ID']['input'];
  stampCardId: Scalars['ID']['input'];
};


export type QueryClientTagsArgs = {
  clientId: Scalars['ID']['input'];
};


export type QueryClientTierArgs = {
  clientId: Scalars['ID']['input'];
};


export type QueryClientTierHistoryArgs = {
  input: ListClientTierHistoryInput;
};


export type QueryClientsArgs = {
  filter?: InputMaybe<ClientFilterInput>;
};


export type QueryDynamicFieldArgs = {
  id: Scalars['ID']['input'];
};


export type QueryDynamicFieldValueArgs = {
  entityId: Scalars['ID']['input'];
  fieldId: Scalars['ID']['input'];
};


export type QueryDynamicFieldValuesArgs = {
  entityId: Scalars['ID']['input'];
  fieldId?: InputMaybe<Scalars['ID']['input']>;
  filter?: InputMaybe<DefaultFilterInput>;
};


export type QueryDynamicFieldsArgs = {
  filter?: InputMaybe<DynamicFieldFilterInput>;
};


export type QueryEvaluateRulesArgs = {
  input: EvaluateRulesInput;
};


export type QueryEvaluateTierUpgradeArgs = {
  clientId: Scalars['ID']['input'];
};


export type QueryGetActiveSubscriptionArgs = {
  appBundle: Scalars['String']['input'];
};


export type QueryGetPlanLimitsArgs = {
  appBundle: Scalars['String']['input'];
};


export type QueryGetPlansArgs = {
  includeArchived?: InputMaybe<Scalars['Boolean']['input']>;
};


export type QueryIdentityArgs = {
  id: Scalars['ID']['input'];
};


export type QueryMembershipPlanArgs = {
  id: Scalars['ID']['input'];
};


export type QueryMembershipPlansArgs = {
  filter?: InputMaybe<DefaultFilterInput>;
};


export type QueryMembershipRequestsArgs = {
  filter?: InputMaybe<DefaultFilterInput>;
};


export type QueryMembershipVisitsArgs = {
  clientMembershipId: Scalars['ID']['input'];
  filter?: InputMaybe<DefaultFilterInput>;
};


export type QueryMilestoneTemplateArgs = {
  id: Scalars['ID']['input'];
};


export type QueryMilestoneTemplatesArgs = {
  input?: InputMaybe<ListMilestoneTemplatesInput>;
};


export type QueryPromotionArgs = {
  id: Scalars['ID']['input'];
};


export type QueryPromotionClaimsArgs = {
  filter?: InputMaybe<ListPromotionClaimsInput>;
  pagination?: InputMaybe<DefaultFilterInput>;
};


export type QueryPromotionsArgs = {
  filter?: InputMaybe<ListPromotionsInput>;
  pagination?: InputMaybe<DefaultFilterInput>;
};


export type QueryRuleArgs = {
  id: Scalars['ID']['input'];
};


export type QueryRulesArgs = {
  input?: InputMaybe<ListRulesInput>;
};


export type QuerySegmentArgs = {
  id: Scalars['ID']['input'];
};


export type QuerySegmentRulesArgs = {
  segmentId: Scalars['ID']['input'];
};


export type QuerySegmentsArgs = {
  filter?: InputMaybe<DefaultFilterInput>;
};


export type QueryStampCardArgs = {
  id: Scalars['ID']['input'];
};


export type QueryStampCardsArgs = {
  filter?: InputMaybe<DefaultFilterInput>;
};


export type QueryTagArgs = {
  id: Scalars['ID']['input'];
};


export type QueryTagsArgs = {
  filter?: InputMaybe<DefaultFilterInput>;
};


export type QueryTierArgs = {
  id: Scalars['ID']['input'];
};


export type QueryUpcomingMilestonesArgs = {
  input: GetUpcomingMilestonesInput;
};

export type RecalculateClientTiersInput = {
  clientId?: InputMaybe<Scalars['ID']['input']>;
};

export type RecalculateClientTiersResponse = {
  __typename?: 'RecalculateClientTiersResponse';
  clientsUpdated: Scalars['Int']['output'];
};

export type RecordMembershipVisitInput = {
  clientMembershipId: Scalars['ID']['input'];
  note?: InputMaybe<Scalars['String']['input']>;
  pin?: InputMaybe<Scalars['String']['input']>;
};

export type RedeemStampCardInput = {
  clientId: Scalars['ID']['input'];
  redeemedBy: Scalars['String']['input'];
  stampCardId: Scalars['ID']['input'];
};

export type RejectClientMembershipInput = {
  id: Scalars['ID']['input'];
  reason?: InputMaybe<Scalars['String']['input']>;
};

export type RemoveTagFromClientInput = {
  clientId: Scalars['ID']['input'];
  tagId: Scalars['ID']['input'];
};

export type RemoveTagFromClientResponse = {
  __typename?: 'RemoveTagFromClientResponse';
  success: Scalars['Boolean']['output'];
};

export type RequestMembershipInput = {
  membershipPlanId: Scalars['ID']['input'];
  name: Scalars['String']['input'];
  note?: InputMaybe<Scalars['String']['input']>;
  phone: Scalars['String']['input'];
};

export type RestoreTagResponse = {
  __typename?: 'RestoreTagResponse';
  success: Scalars['Boolean']['output'];
};

export type RuleEvaluation = {
  __typename?: 'RuleEvaluation';
  actionsAppliedJson: Scalars['String']['output'];
  matched: Scalars['Boolean']['output'];
  ruleId: Scalars['ID']['output'];
  ruleName: Scalars['String']['output'];
};

export type RuleList = {
  __typename?: 'RuleList';
  info: PaginationInfo;
  rows: Array<LoyaltyRule>;
};

export enum RuleStatus {
  RuleStatusActive = 'RULE_STATUS_ACTIVE',
  RuleStatusInactive = 'RULE_STATUS_INACTIVE',
  RuleStatusScheduled = 'RULE_STATUS_SCHEDULED',
  RuleStatusUnspecified = 'RULE_STATUS_UNSPECIFIED'
}

export enum RuleTrigger {
  RuleTriggerBirthday = 'RULE_TRIGGER_BIRTHDAY',
  RuleTriggerEvent = 'RULE_TRIGGER_EVENT',
  RuleTriggerPurchase = 'RULE_TRIGGER_PURCHASE',
  RuleTriggerRegistration = 'RULE_TRIGGER_REGISTRATION',
  RuleTriggerUnspecified = 'RULE_TRIGGER_UNSPECIFIED',
  RuleTriggerVisit = 'RULE_TRIGGER_VISIT'
}

export enum RuleType {
  RuleTypeBonusEarning = 'RULE_TYPE_BONUS_EARNING',
  RuleTypeMultiplier = 'RULE_TYPE_MULTIPLIER',
  RuleTypeStampEarning = 'RULE_TYPE_STAMP_EARNING',
  RuleTypeTierUpgrade = 'RULE_TYPE_TIER_UPGRADE',
  RuleTypeUnspecified = 'RULE_TYPE_UNSPECIFIED'
}

export type Segment = {
  __typename?: 'Segment';
  createdBy: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
};

export type SegmentList = {
  __typename?: 'SegmentList';
  info: PaginationInfo;
  rows: Array<Segment>;
};

export type SegmentRule = {
  __typename?: 'SegmentRule';
  fieldKey: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  operator: Scalars['String']['output'];
  segmentId: Scalars['ID']['output'];
  value: Scalars['String']['output'];
};

export type SegmentRuleList = {
  __typename?: 'SegmentRuleList';
  info: PaginationInfo;
  rows: Array<SegmentRule>;
};

export type SetDynamicFieldValueInput = {
  entityId: Scalars['ID']['input'];
  fieldId: Scalars['ID']['input'];
  valueBool?: InputMaybe<Scalars['Boolean']['input']>;
  valueDate?: InputMaybe<Scalars['String']['input']>;
  valueJson?: InputMaybe<Scalars['String']['input']>;
  valueNumber?: InputMaybe<Scalars['Float']['input']>;
  valueString?: InputMaybe<Scalars['String']['input']>;
};

export type SetPrimaryIdentityInput = {
  id: Scalars['ID']['input'];
};

export type StampCard = {
  __typename?: 'StampCard';
  createdAt: Scalars['String']['output'];
  description?: Maybe<Scalars['String']['output']>;
  hasPin: Scalars['Boolean']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  rewardDescription: Scalars['String']['output'];
  status: StampCardStatus;
  totalStamps: Scalars['Int']['output'];
  type: StampCardType;
  updatedAt: Scalars['String']['output'];
  validFrom?: Maybe<Scalars['String']['output']>;
  validUntil?: Maybe<Scalars['String']['output']>;
};

export type StampCardList = {
  __typename?: 'StampCardList';
  info: PaginationInfo;
  rows: Array<StampCard>;
};

export enum StampCardStatus {
  Active = 'ACTIVE',
  Archived = 'ARCHIVED',
  Inactive = 'INACTIVE'
}

export enum StampCardType {
  Coffee = 'COFFEE',
  Custom = 'CUSTOM',
  Meal = 'MEAL',
  Visit = 'VISIT'
}

export type StampRedemption = {
  __typename?: 'StampRedemption';
  clientId: Scalars['ID']['output'];
  id: Scalars['ID']['output'];
  redeemedAt: Scalars['String']['output'];
  rewardDescription: Scalars['String']['output'];
  stampCardId: Scalars['ID']['output'];
  stampsUsed: Scalars['Int']['output'];
};

export type StampRedemptionList = {
  __typename?: 'StampRedemptionList';
  info: PaginationInfo;
  rows: Array<StampRedemption>;
};

export type Subscription = {
  __typename?: 'Subscription';
  clientChanged: ClientChangedEvent;
};

export enum SubscriptionStatus {
  SubscriptionActive = 'SUBSCRIPTION_ACTIVE',
  SubscriptionCanceled = 'SUBSCRIPTION_CANCELED',
  SubscriptionExpired = 'SUBSCRIPTION_EXPIRED',
  SubscriptionIncomplete = 'SUBSCRIPTION_INCOMPLETE',
  SubscriptionPastDue = 'SUBSCRIPTION_PAST_DUE',
  SubscriptionTrialing = 'SUBSCRIPTION_TRIALING'
}

export type SyncClientMilestonesInput = {
  clientId: Scalars['ID']['input'];
};

export type SyncClientMilestonesResponse = {
  __typename?: 'SyncClientMilestonesResponse';
  createdCount: Scalars['Int']['output'];
  syncedCount: Scalars['Int']['output'];
  updatedCount: Scalars['Int']['output'];
};

export type Tag = {
  __typename?: 'Tag';
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
};

export type TagList = {
  __typename?: 'TagList';
  info: PaginationInfo;
  rows: Array<Tag>;
};

export type Tier = {
  __typename?: 'Tier';
  benefitsJson: Scalars['String']['output'];
  bonusMultiplier: Scalars['Float']['output'];
  colorHex: Scalars['String']['output'];
  createdAt: Scalars['String']['output'];
  description: Scalars['String']['output'];
  iconUrl: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  level: Scalars['Int']['output'];
  name: Scalars['String']['output'];
  qualificationCriteria: TierQualificationCriteria;
  qualificationThreshold: Scalars['Float']['output'];
  status: TierStatus;
  updatedAt: Scalars['String']['output'];
};

export type TierList = {
  __typename?: 'TierList';
  info: PaginationInfo;
  rows: Array<Tier>;
};

export enum TierQualificationCriteria {
  TierQualificationBonusEarned = 'TIER_QUALIFICATION_BONUS_EARNED',
  TierQualificationManual = 'TIER_QUALIFICATION_MANUAL',
  TierQualificationTotalSpent = 'TIER_QUALIFICATION_TOTAL_SPENT',
  TierQualificationUnspecified = 'TIER_QUALIFICATION_UNSPECIFIED',
  TierQualificationVisitCount = 'TIER_QUALIFICATION_VISIT_COUNT'
}

export enum TierStatus {
  TierStatusActive = 'TIER_STATUS_ACTIVE',
  TierStatusInactive = 'TIER_STATUS_INACTIVE',
  TierStatusUnspecified = 'TIER_STATUS_UNSPECIFIED'
}

export type TierUpgradeResult = {
  __typename?: 'TierUpgradeResult';
  newTier?: Maybe<Tier>;
  previousTier?: Maybe<Tier>;
  upgraded: Scalars['Boolean']['output'];
};

export enum TransactionReason {
  Birthday = 'BIRTHDAY',
  Expiration = 'EXPIRATION',
  Manual = 'MANUAL',
  Promotion = 'PROMOTION',
  Purchase = 'PURCHASE',
  Registration = 'REGISTRATION',
  TierBonus = 'TIER_BONUS',
  Visit = 'VISIT'
}

export enum TransactionType {
  AdminAdjustment = 'ADMIN_ADJUSTMENT',
  Earned = 'EARNED',
  Expired = 'EXPIRED',
  Spent = 'SPENT'
}

export type UpcomingMilestonesList = {
  __typename?: 'UpcomingMilestonesList';
  rows: Array<ClientMilestone>;
};

export type UpdateClientTierInput = {
  changedBy: Scalars['String']['input'];
  clientId: Scalars['ID']['input'];
  reason: Scalars['String']['input'];
  tierId: Scalars['ID']['input'];
};

export type UpdateDynamicFieldInput = {
  id: Scalars['ID']['input'];
  isRequired: Scalars['Boolean']['input'];
  label: Scalars['String']['input'];
  options?: InputMaybe<Array<Scalars['String']['input']>>;
  searchable: Scalars['Boolean']['input'];
  viewOrder?: InputMaybe<Scalars['Int']['input']>;
};

export type UpdateIdentityInput = {
  comments?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
  value: Scalars['String']['input'];
};

export type UpdateMembershipPlanInput = {
  category?: InputMaybe<Scalars['String']['input']>;
  clearPin?: InputMaybe<Scalars['Boolean']['input']>;
  color?: InputMaybe<Scalars['String']['input']>;
  currency?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  durationDays?: InputMaybe<Scalars['Int']['input']>;
  freezeDaysAllowed?: InputMaybe<Scalars['Int']['input']>;
  id: Scalars['ID']['input'];
  imageUrl?: InputMaybe<Scalars['String']['input']>;
  listedOnStorefront?: InputMaybe<Scalars['Boolean']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  pin?: InputMaybe<Scalars['String']['input']>;
  price?: InputMaybe<Scalars['String']['input']>;
  sortOrder?: InputMaybe<Scalars['Int']['input']>;
  status?: InputMaybe<MembershipPlanStatus>;
  visitLimit?: InputMaybe<Scalars['Int']['input']>;
};

export type UpdateMilestoneTemplateInput = {
  daysAfterCelebration?: InputMaybe<Scalars['Int']['input']>;
  daysBeforeNotification?: InputMaybe<Scalars['Int']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
  messageTemplate?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  rewardActionsJson?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<MilestoneStatus>;
};

export type UpdatePromotionInput = {
  conditionsJson?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
  name?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<PromotionStatus>;
  totalUsageLimit?: InputMaybe<Scalars['Int']['input']>;
  usageLimitPerClient?: InputMaybe<Scalars['Int']['input']>;
  validUntil?: InputMaybe<Scalars['String']['input']>;
  value?: InputMaybe<Scalars['Float']['input']>;
};

export type UpdateRuleInput = {
  actionsJson?: InputMaybe<Scalars['String']['input']>;
  conditionsJson?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
  name?: InputMaybe<Scalars['String']['input']>;
  priority?: InputMaybe<Scalars['Int']['input']>;
  segmentId?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<RuleStatus>;
  validUntil?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateSegmentInput = {
  id: Scalars['ID']['input'];
  name: Scalars['String']['input'];
};

export type UpdateSegmentRuleInput = {
  fieldKey: Scalars['String']['input'];
  id: Scalars['ID']['input'];
  operator: Scalars['String']['input'];
  value: Scalars['String']['input'];
};

export type UpdateStampCardInput = {
  clearPin?: InputMaybe<Scalars['Boolean']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
  name?: InputMaybe<Scalars['String']['input']>;
  pin?: InputMaybe<Scalars['String']['input']>;
  rewardDescription?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<StampCardStatus>;
  totalStamps?: InputMaybe<Scalars['Int']['input']>;
  validFrom?: InputMaybe<Scalars['String']['input']>;
  validUntil?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateTagInput = {
  id: Scalars['ID']['input'];
  name: Scalars['String']['input'];
};

export type UpdateTierInput = {
  benefitsJson?: InputMaybe<Scalars['String']['input']>;
  bonusMultiplier?: InputMaybe<Scalars['Float']['input']>;
  colorHex?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  iconUrl?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
  name?: InputMaybe<Scalars['String']['input']>;
  qualificationThreshold?: InputMaybe<Scalars['Float']['input']>;
  status?: InputMaybe<TierStatus>;
};

export type UpsertMembershipBrandSettingsInput = {
  acceptRequests?: InputMaybe<Scalars['Boolean']['input']>;
  address?: InputMaybe<Scalars['String']['input']>;
  autoApproveRequests?: InputMaybe<Scalars['Boolean']['input']>;
  city?: InputMaybe<Scalars['String']['input']>;
  coverImageUrl?: InputMaybe<Scalars['String']['input']>;
  currencyCode?: InputMaybe<Scalars['String']['input']>;
  lat?: InputMaybe<Scalars['Float']['input']>;
  listedInCatalog?: InputMaybe<Scalars['Boolean']['input']>;
  lng?: InputMaybe<Scalars['Float']['input']>;
  logoUrl?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  phone?: InputMaybe<Scalars['String']['input']>;
  primaryColor?: InputMaybe<Scalars['String']['input']>;
  secondaryColor?: InputMaybe<Scalars['String']['input']>;
  seoDescription?: InputMaybe<Scalars['String']['input']>;
  seoTitle?: InputMaybe<Scalars['String']['input']>;
  socialLinks?: InputMaybe<Scalars['String']['input']>;
  welcomeMessage?: InputMaybe<Scalars['String']['input']>;
};

export type VerifyIdentityInput = {
  id: Scalars['ID']['input'];
};

export type VerifyIdentityResponse = {
  __typename?: 'VerifyIdentityResponse';
  success: Scalars['Boolean']['output'];
};

export type ListClientsQueryVariables = Exact<{
  filter?: InputMaybe<ClientFilterInput>;
}>;


export type ListClientsQuery = { __typename?: 'Query', clients: { __typename?: 'ClientList', rows: Array<{ __typename?: 'ClientProfile', client: { __typename?: 'Client', id: string, clientType: ClientType, status: ClientStatus, createdAt: string, updatedAt: string }, individual?: { __typename?: 'Individual', firstName: string, lastName: string, middleName?: string | null, birthDate?: string | null, gender?: boolean | null } | null, legalEntity?: { __typename?: 'LegalEntity', legalName: string, brandName?: string | null, binIin?: string | null, registrationCountry?: string | null, registrationDate?: string | null } | null }>, info: { __typename?: 'PaginationInfo', count: number } } };


export const ListClientsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ListClients"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"filter"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"ClientFilterInput"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"clients"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"Variable","name":{"kind":"Name","value":"filter"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"rows"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"client"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"clientType"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}},{"kind":"Field","name":{"kind":"Name","value":"individual"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"firstName"}},{"kind":"Field","name":{"kind":"Name","value":"lastName"}},{"kind":"Field","name":{"kind":"Name","value":"middleName"}},{"kind":"Field","name":{"kind":"Name","value":"birthDate"}},{"kind":"Field","name":{"kind":"Name","value":"gender"}}]}},{"kind":"Field","name":{"kind":"Name","value":"legalEntity"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"legalName"}},{"kind":"Field","name":{"kind":"Name","value":"brandName"}},{"kind":"Field","name":{"kind":"Name","value":"binIin"}},{"kind":"Field","name":{"kind":"Name","value":"registrationCountry"}},{"kind":"Field","name":{"kind":"Name","value":"registrationDate"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"info"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"count"}}]}}]}}]}}]} as unknown as DocumentNode<ListClientsQuery, ListClientsQueryVariables>;