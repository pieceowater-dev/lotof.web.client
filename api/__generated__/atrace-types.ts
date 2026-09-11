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

export type AppToken = {
  __typename?: 'AppToken';
  token: Scalars['String']['output'];
};

export type ApplyShiftPatternPresetResponse = {
  __typename?: 'ApplyShiftPatternPresetResponse';
  patterns: Array<ShiftPattern>;
};

export type ApproveLeaveInput = {
  id: Scalars['ID']['input'];
};

export type ApproveShiftCoverageInput = {
  id: Scalars['ID']['input'];
};

export type AssignMemberToPostInput = {
  comment?: InputMaybe<Scalars['String']['input']>;
  effectiveFrom: Scalars['String']['input'];
  effectiveTo?: InputMaybe<Scalars['String']['input']>;
  postId: Scalars['ID']['input'];
  userId: Scalars['ID']['input'];
};

/** Input for assigning permissions to a role (maps to AssignPermissionsRequest) */
export type AssignPermissionsInput = {
  permissionIds: Array<Scalars['ID']['input']>;
  roleId: Scalars['ID']['input'];
};

export type AssignPostScheduleInput = {
  comment?: InputMaybe<Scalars['String']['input']>;
  effectiveFrom: Scalars['String']['input'];
  effectiveTo?: InputMaybe<Scalars['String']['input']>;
  postId: Scalars['ID']['input'];
  shiftPatternId: Scalars['ID']['input'];
};

/** Input for assigning a role to a member (maps to AssignRoleToMemberRequest) */
export type AssignRoleToMemberInput = {
  memberId: Scalars['ID']['input'];
  roleId: Scalars['ID']['input'];
};

export type AssignScheduleInput = {
  comment?: InputMaybe<Scalars['String']['input']>;
  effectiveFrom: Scalars['String']['input'];
  effectiveTo?: InputMaybe<Scalars['String']['input']>;
  shiftPatternId: Scalars['ID']['input'];
  userId: Scalars['ID']['input'];
};

export type AttendanceReport = {
  __typename?: 'AttendanceReport';
  attendances: Array<DailyAttendance>;
  endDate: Scalars['String']['output'];
  missedDates?: Maybe<Array<Scalars['String']['output']>>;
  startDate: Scalars['String']['output'];
  userId: Scalars['ID']['output'];
};

export type AttendanceSettings = {
  __typename?: 'AttendanceSettings';
  allowLatenessMakeup: Scalars['Boolean']['output'];
  earlyLeaveThreshold: Scalars['String']['output'];
  lateArrivalThreshold: Scalars['String']['output'];
  roundingMinutes: Scalars['Int']['output'];
};

export type AttendanceSummary = {
  __typename?: 'AttendanceSummary';
  attendedDays: Scalars['Int']['output'];
  averageHoursPerDay: Scalars['Float']['output'];
  earlyLeaveDays: Scalars['Int']['output'];
  id: Scalars['ID']['output'];
  lateDays: Scalars['Int']['output'];
  lateMadeUpDays: Scalars['Int']['output'];
  legitimateAbsences: Scalars['Int']['output'];
  missedDays: Scalars['Int']['output'];
  month: Scalars['Int']['output'];
  requiredDays: Scalars['Int']['output'];
  totalWorkedHours: Scalars['Float']['output'];
  userId: Scalars['ID']['output'];
  year: Scalars['Int']['output'];
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

export type CalculateSalaryInput = {
  endDate: Scalars['String']['input'];
  startDate: Scalars['String']['input'];
  userId?: InputMaybe<Scalars['ID']['input']>;
};

export type CancelLeaveInput = {
  id: Scalars['ID']['input'];
};

export type CancelShiftCoverageInput = {
  id: Scalars['ID']['input'];
};

export type CheckInput = {
  latitude?: InputMaybe<Scalars['Float']['input']>;
  longitude?: InputMaybe<Scalars['Float']['input']>;
  method: RecordMethod;
  postId: Scalars['ID']['input'];
  secret: Scalars['String']['input'];
};

export type CreateMassExcuseInput = {
  applyToAll: Scalars['Boolean']['input'];
  date: Scalars['String']['input'];
  description?: InputMaybe<Scalars['String']['input']>;
  reason: Scalars['String']['input'];
  userIds?: InputMaybe<Array<Scalars['ID']['input']>>;
};

export type CreateOvertimeRateInput = {
  calcType: Scalars['String']['input'];
  comment?: InputMaybe<Scalars['String']['input']>;
  currency?: InputMaybe<Scalars['String']['input']>;
  fixedAmountPerHour?: InputMaybe<Scalars['Float']['input']>;
  multiplier?: InputMaybe<Scalars['Float']['input']>;
  name: Scalars['String']['input'];
};

export type CreatePenaltyRuleInput = {
  amount?: InputMaybe<Scalars['Float']['input']>;
  calcType: Scalars['String']['input'];
  comment?: InputMaybe<Scalars['String']['input']>;
  currency?: InputMaybe<Scalars['String']['input']>;
  lateThresholdCount?: InputMaybe<Scalars['Int']['input']>;
  name: Scalars['String']['input'];
  percentOfSalary?: InputMaybe<Scalars['Float']['input']>;
  type: Scalars['String']['input'];
};

export type CreatePermissionInput = {
  accesabilities: Scalars['String']['input'];
  name: Scalars['String']['input'];
};

export type CreatePostInput = {
  description?: InputMaybe<Scalars['String']['input']>;
  location?: InputMaybe<PostLocationInput>;
  phrase: Scalars['String']['input'];
  title: Scalars['String']['input'];
};

export type CreateRecordInput = {
  latitude?: InputMaybe<Scalars['Float']['input']>;
  longitude?: InputMaybe<Scalars['Float']['input']>;
  method: RecordMethod;
  postId: Scalars['ID']['input'];
  userId: Scalars['ID']['input'];
};

/** Input for creating a role (maps to CreateRoleRequest) */
export type CreateRoleInput = {
  name: Scalars['String']['input'];
  permissionIds?: InputMaybe<Array<Scalars['ID']['input']>>;
};

export type CreateRouteInput = {
  milestones: Array<CreateRouteMilestoneInput>;
  title: Scalars['String']['input'];
};

export type CreateRouteMilestoneInput = {
  postId: Scalars['ID']['input'];
  priority: Scalars['Int']['input'];
};

export type CreateScheduleInput = {
  comment?: InputMaybe<Scalars['String']['input']>;
  month: Scalars['Int']['input'];
  shouldAttendDaysPerMonth: Scalars['Int']['input'];
  shouldAttendHoursPerDay: Scalars['Int']['input'];
  userId: Scalars['ID']['input'];
  year: Scalars['Int']['input'];
};

export type CreateShiftPatternInput = {
  comment?: InputMaybe<Scalars['String']['input']>;
  earlyLeaveThreshold?: InputMaybe<Scalars['String']['input']>;
  lateThreshold?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  requiredHoursPerDay: Scalars['Float']['input'];
  rotationAnchorDate: Scalars['String']['input'];
  rotationOffDays: Scalars['Int']['input'];
  rotationWorkDays: Scalars['Int']['input'];
  shiftEndTime: Scalars['String']['input'];
  shiftStartTime: Scalars['String']['input'];
  type: ShiftPatternType;
  workDaysOfWeek?: InputMaybe<Array<Scalars['Int']['input']>>;
};

export type DailyAttendance = {
  __typename?: 'DailyAttendance';
  attended: Scalars['Boolean']['output'];
  autoClosedCheckout: Scalars['Boolean']['output'];
  checkCount: Scalars['Int']['output'];
  date: Scalars['String']['output'];
  earlyLeave: Scalars['Boolean']['output'];
  firstCheckIn: Scalars['Int']['output'];
  firstRecordId: Scalars['ID']['output'];
  id: Scalars['ID']['output'];
  incompleteCheckout: Scalars['Boolean']['output'];
  lastCheckOut: Scalars['Int']['output'];
  lastRecordId: Scalars['ID']['output'];
  late: Scalars['Boolean']['output'];
  lateMadeUp: Scalars['Boolean']['output'];
  legitimate: Scalars['Boolean']['output'];
  postBreakdown?: Maybe<Array<PostWorkedHours>>;
  processedAt: Scalars['Int']['output'];
  reason?: Maybe<Scalars['String']['output']>;
  requiredHours: Scalars['Int']['output'];
  timezone?: Maybe<Scalars['String']['output']>;
  userId: Scalars['ID']['output'];
  workedHours: Scalars['Float']['output'];
};

export type DailyAttendanceReprocessResult = {
  __typename?: 'DailyAttendanceReprocessResult';
  autoClosedCheckout: Scalars['Boolean']['output'];
  checkCount: Scalars['Int']['output'];
  date: Scalars['String']['output'];
  firstCheckIn: Scalars['Int']['output'];
  lastCheckOut: Scalars['Int']['output'];
  userId: Scalars['ID']['output'];
  workedHours: Scalars['Float']['output'];
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

export type DeleteOvertimeRateInput = {
  id: Scalars['ID']['input'];
};

export type DeletePenaltyRuleInput = {
  id: Scalars['ID']['input'];
};

export type DeleteShiftPatternDayOverrideInput = {
  id: Scalars['ID']['input'];
};

export type DeleteShiftPatternInput = {
  id: Scalars['ID']['input'];
};

export type EndMemberPostAssignmentInput = {
  effectiveTo: Scalars['String']['input'];
  id: Scalars['ID']['input'];
};

export type EndPostScheduleAssignmentInput = {
  effectiveTo: Scalars['String']['input'];
  id: Scalars['ID']['input'];
};

export type EndScheduleAssignmentInput = {
  effectiveTo: Scalars['String']['input'];
  id: Scalars['ID']['input'];
};

export type ExportAllUsersStatsInput = {
  endDate: Scalars['String']['input'];
  postId?: InputMaybe<Scalars['String']['input']>;
  startDate: Scalars['String']['input'];
};

export type ExportDailyAttendanceInput = {
  endDate: Scalars['String']['input'];
  startDate: Scalars['String']['input'];
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

export type GetActiveMemberPostAssignmentInput = {
  date?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['ID']['input']>;
};

export type GetActivePostScheduleAssignmentInput = {
  date?: InputMaybe<Scalars['String']['input']>;
  postId: Scalars['ID']['input'];
};

export type GetActiveScheduleAssignmentInput = {
  date?: InputMaybe<Scalars['String']['input']>;
  userId: Scalars['ID']['input'];
};

export type GetAllUsersStatsInput = {
  endDate: Scalars['String']['input'];
  onlyGeoVerified?: InputMaybe<Scalars['Boolean']['input']>;
  postId?: InputMaybe<Scalars['String']['input']>;
  startDate: Scalars['String']['input'];
};

export type GetAttendanceReportInput = {
  endDate: Scalars['String']['input'];
  startDate: Scalars['String']['input'];
  userId: Scalars['ID']['input'];
};

export type GetByPostIdInput = {
  pagination?: InputMaybe<DefaultFilterPaginationInput>;
  postId: Scalars['ID']['input'];
  sort?: InputMaybe<DefaultFilterSortInput>;
  userId?: InputMaybe<Scalars['ID']['input']>;
};

export type GetLeaveRequestsInput = {
  endDate?: InputMaybe<Scalars['String']['input']>;
  pagination?: InputMaybe<DefaultFilterPaginationInput>;
  sort?: InputMaybe<DefaultFilterSortInput>;
  startDate?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['ID']['input']>;
};

export type GetMemberPostAssignmentsInput = {
  pagination?: InputMaybe<DefaultFilterPaginationInput>;
  postId?: InputMaybe<Scalars['ID']['input']>;
  sort?: InputMaybe<DefaultFilterSortInput>;
  userId?: InputMaybe<Scalars['ID']['input']>;
};

export type GetMemberSalaryInput = {
  userId?: InputMaybe<Scalars['ID']['input']>;
};

export type GetMembersRolesAndSchedulesInput = {
  memberIds: Array<Scalars['ID']['input']>;
  month: Scalars['Int']['input'];
  year: Scalars['Int']['input'];
};

export type GetMonthlySummaryInput = {
  month: Scalars['Int']['input'];
  userId: Scalars['ID']['input'];
  year: Scalars['Int']['input'];
};

export type GetPostScheduleAssignmentsInput = {
  pagination?: InputMaybe<DefaultFilterPaginationInput>;
  postId?: InputMaybe<Scalars['ID']['input']>;
  sort?: InputMaybe<DefaultFilterSortInput>;
};

export type GetSalaryHistoryInput = {
  monthsBack?: InputMaybe<Scalars['Int']['input']>;
  userId?: InputMaybe<Scalars['ID']['input']>;
};

export type GetScheduleAssignmentsInput = {
  pagination?: InputMaybe<DefaultFilterPaginationInput>;
  sort?: InputMaybe<DefaultFilterSortInput>;
  userId?: InputMaybe<Scalars['ID']['input']>;
};

export type GetScheduleInput = {
  month: Scalars['Int']['input'];
  userId: Scalars['ID']['input'];
  year: Scalars['Int']['input'];
};

export type GetShiftCoveragesInput = {
  endDate?: InputMaybe<Scalars['String']['input']>;
  pagination?: InputMaybe<DefaultFilterPaginationInput>;
  sort?: InputMaybe<DefaultFilterSortInput>;
  startDate?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['ID']['input']>;
};

export type GetShiftPatternDayOverridesInput = {
  endDate?: InputMaybe<Scalars['String']['input']>;
  shiftPatternId: Scalars['ID']['input'];
  startDate?: InputMaybe<Scalars['String']['input']>;
};

export type GetShiftPatternInput = {
  id: Scalars['ID']['input'];
};

export type GetSummaryRangeInput = {
  endMonth: Scalars['Int']['input'];
  endYear: Scalars['Int']['input'];
  startMonth: Scalars['Int']['input'];
  startYear: Scalars['Int']['input'];
  userId: Scalars['ID']['input'];
};

export type LeaveRequest = {
  __typename?: 'LeaveRequest';
  comment?: Maybe<Scalars['String']['output']>;
  endDate: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  requestedByUserId: Scalars['ID']['output'];
  startDate: Scalars['String']['output'];
  status: Scalars['String']['output'];
  type: Scalars['String']['output'];
  userId: Scalars['ID']['output'];
};

export type MarkDayLegitimateInput = {
  date: Scalars['String']['input'];
  reason: Scalars['String']['input'];
  userId: Scalars['ID']['input'];
};

export type MassExcuse = {
  __typename?: 'MassExcuse';
  applyToAll: Scalars['Boolean']['output'];
  date: Scalars['String']['output'];
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  reason: Scalars['String']['output'];
  userIds?: Maybe<Array<Scalars['ID']['output']>>;
};

export type Member = {
  __typename?: 'Member';
  createdAt: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  isActive: Scalars['Boolean']['output'];
  updatedAt: Scalars['String']['output'];
  userId: Scalars['ID']['output'];
};

export type MemberPostAssignment = {
  __typename?: 'MemberPostAssignment';
  comment?: Maybe<Scalars['String']['output']>;
  effectiveFrom: Scalars['String']['output'];
  effectiveTo?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  postId: Scalars['ID']['output'];
  userId: Scalars['ID']['output'];
};

/**
 * One member's role + schedule, as returned by getMembersRolesAndSchedules.
 * role/schedule are nullable rather than the batch call failing outright --
 * mirrors the per-member try/catch the frontend used to do when it fetched
 * these one member at a time (a lookup failure for one member shouldn't blank
 * the rest of the list).
 */
export type MemberRoleAndScheduleEntry = {
  __typename?: 'MemberRoleAndScheduleEntry';
  memberId: Scalars['ID']['output'];
  role?: Maybe<Role>;
  schedule?: Maybe<Schedule>;
};

export type MemberSalary = {
  __typename?: 'MemberSalary';
  amount: Scalars['Float']['output'];
  comment?: Maybe<Scalars['String']['output']>;
  currency: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  overtimeRateId?: Maybe<Scalars['ID']['output']>;
  penaltyRuleIds: Array<Scalars['ID']['output']>;
  updatedAt: Scalars['Int']['output'];
  userId: Scalars['ID']['output'];
};

export type MemberSalaryList = {
  __typename?: 'MemberSalaryList';
  paginationInfo: PaginationInfo;
  salaries: Array<MemberSalary>;
};

export type Mutation = {
  __typename?: 'Mutation';
  _placeholder?: Maybe<Scalars['String']['output']>;
  applyShiftPatternPreset: ApplyShiftPatternPresetResponse;
  approveLeave: LeaveRequest;
  approveShiftCoverage: ShiftCoverage;
  assignMemberToPost: MemberPostAssignment;
  assignPermissions: Role;
  assignPostSchedule: PostScheduleAssignment;
  assignRoleToMember: Scalars['Boolean']['output'];
  assignSchedule: ScheduleAssignment;
  cancelLeave: LeaveRequest;
  cancelShiftCoverage: ShiftCoverage;
  check: Record;
  createMassExcuse: MassExcuse;
  createOvertimeRate: OvertimeRate;
  createPenaltyRule: PenaltyRule;
  createPermission: Permission;
  createPost: Post;
  createRole: Role;
  createRoute: Route;
  createSchedule: Schedule;
  createShiftPattern: ShiftPattern;
  decideOnboardingRequest: OnboardingRequestItem;
  deleteOvertimeRate: OvertimeRate;
  deletePenaltyRule: PenaltyRule;
  deletePermission: Scalars['Boolean']['output'];
  deletePost: Post;
  deleteRole: Scalars['Boolean']['output'];
  deleteRoute: Route;
  deleteShiftPattern: ShiftPattern;
  deleteShiftPatternDayOverride: ShiftPatternDayOverride;
  endMemberPostAssignment: MemberPostAssignment;
  endPostScheduleAssignment: PostScheduleAssignment;
  endScheduleAssignment: ScheduleAssignment;
  getAppToken?: Maybe<AppToken>;
  markDayLegitimate: DailyAttendance;
  rejectLeave: LeaveRequest;
  rejectShiftCoverage: ShiftCoverage;
  removeRoleFromMember: Scalars['Boolean']['output'];
  reprocessDailyAttendance: DailyAttendanceReprocessResult;
  requestLeave: LeaveRequest;
  requestOnboarding?: Maybe<OnboardingRequestItem>;
  requestShiftCoverage: ShiftCoverage;
  setMemberActive: Member;
  setMemberSalary: MemberSalary;
  setShiftPatternDayOverride: ShiftPatternDayOverride;
  subscribePlan: BillingSubscription;
  updateAttendanceSettings: AttendanceSettings;
  updateMemberPostAssignment: MemberPostAssignment;
  updateOvertimeRate: OvertimeRate;
  updatePenaltyRule: PenaltyRule;
  updatePermission: Permission;
  updatePost: Post;
  updatePostScheduleAssignment: PostScheduleAssignment;
  updateRole: Role;
  updateSchedule: Schedule;
  updateScheduleAssignment: ScheduleAssignment;
  updateShiftPattern: ShiftPattern;
};


export type MutationApplyShiftPatternPresetArgs = {
  businessType: Scalars['String']['input'];
  locale: Scalars['String']['input'];
};


export type MutationApproveLeaveArgs = {
  input: ApproveLeaveInput;
};


export type MutationApproveShiftCoverageArgs = {
  input: ApproveShiftCoverageInput;
};


export type MutationAssignMemberToPostArgs = {
  input: AssignMemberToPostInput;
};


export type MutationAssignPermissionsArgs = {
  input: AssignPermissionsInput;
};


export type MutationAssignPostScheduleArgs = {
  input: AssignPostScheduleInput;
};


export type MutationAssignRoleToMemberArgs = {
  input: AssignRoleToMemberInput;
};


export type MutationAssignScheduleArgs = {
  input: AssignScheduleInput;
};


export type MutationCancelLeaveArgs = {
  input: CancelLeaveInput;
};


export type MutationCancelShiftCoverageArgs = {
  input: CancelShiftCoverageInput;
};


export type MutationCheckArgs = {
  input: CheckInput;
};


export type MutationCreateMassExcuseArgs = {
  input: CreateMassExcuseInput;
};


export type MutationCreateOvertimeRateArgs = {
  input: CreateOvertimeRateInput;
};


export type MutationCreatePenaltyRuleArgs = {
  input: CreatePenaltyRuleInput;
};


export type MutationCreatePermissionArgs = {
  input: CreatePermissionInput;
};


export type MutationCreatePostArgs = {
  input: CreatePostInput;
};


export type MutationCreateRoleArgs = {
  input: CreateRoleInput;
};


export type MutationCreateRouteArgs = {
  input: CreateRouteInput;
};


export type MutationCreateScheduleArgs = {
  input: CreateScheduleInput;
};


export type MutationCreateShiftPatternArgs = {
  input: CreateShiftPatternInput;
};


export type MutationDecideOnboardingRequestArgs = {
  approve: Scalars['Boolean']['input'];
  id: Scalars['ID']['input'];
};


export type MutationDeleteOvertimeRateArgs = {
  input: DeleteOvertimeRateInput;
};


export type MutationDeletePenaltyRuleArgs = {
  input: DeletePenaltyRuleInput;
};


export type MutationDeletePermissionArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeletePostArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteRoleArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteRouteArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteShiftPatternArgs = {
  input: DeleteShiftPatternInput;
};


export type MutationDeleteShiftPatternDayOverrideArgs = {
  input: DeleteShiftPatternDayOverrideInput;
};


export type MutationEndMemberPostAssignmentArgs = {
  input: EndMemberPostAssignmentInput;
};


export type MutationEndPostScheduleAssignmentArgs = {
  input: EndPostScheduleAssignmentInput;
};


export type MutationEndScheduleAssignmentArgs = {
  input: EndScheduleAssignmentInput;
};


export type MutationMarkDayLegitimateArgs = {
  input: MarkDayLegitimateInput;
};


export type MutationRejectLeaveArgs = {
  input: RejectLeaveInput;
};


export type MutationRejectShiftCoverageArgs = {
  input: RejectShiftCoverageInput;
};


export type MutationRemoveRoleFromMemberArgs = {
  input: RemoveRoleFromMemberInput;
};


export type MutationReprocessDailyAttendanceArgs = {
  date: Scalars['String']['input'];
  userId: Scalars['ID']['input'];
};


export type MutationRequestLeaveArgs = {
  input: RequestLeaveInput;
};


export type MutationRequestOnboardingArgs = {
  input: RequestOnboardingInput;
};


export type MutationRequestShiftCoverageArgs = {
  input: RequestShiftCoverageInput;
};


export type MutationSetMemberActiveArgs = {
  input: SetMemberActiveInput;
};


export type MutationSetMemberSalaryArgs = {
  input: SetMemberSalaryInput;
};


export type MutationSetShiftPatternDayOverrideArgs = {
  input: SetShiftPatternDayOverrideInput;
};


export type MutationSubscribePlanArgs = {
  appBundle: Scalars['String']['input'];
  planCode: Scalars['String']['input'];
};


export type MutationUpdateAttendanceSettingsArgs = {
  input: UpdateAttendanceSettingsInput;
};


export type MutationUpdateMemberPostAssignmentArgs = {
  input: UpdateMemberPostAssignmentInput;
};


export type MutationUpdateOvertimeRateArgs = {
  input: UpdateOvertimeRateInput;
};


export type MutationUpdatePenaltyRuleArgs = {
  input: UpdatePenaltyRuleInput;
};


export type MutationUpdatePermissionArgs = {
  id: Scalars['ID']['input'];
  input: UpdatePermissionInput;
};


export type MutationUpdatePostArgs = {
  input: UpdatePostInput;
};


export type MutationUpdatePostScheduleAssignmentArgs = {
  input: UpdatePostScheduleAssignmentInput;
};


export type MutationUpdateRoleArgs = {
  id: Scalars['ID']['input'];
  input: UpdateRoleInput;
};


export type MutationUpdateScheduleArgs = {
  input: UpdateScheduleInput;
};


export type MutationUpdateScheduleAssignmentArgs = {
  input: UpdateScheduleAssignmentInput;
};


export type MutationUpdateShiftPatternArgs = {
  input: UpdateShiftPatternInput;
};

export type OnboardingRequestItem = {
  __typename?: 'OnboardingRequestItem';
  decidedAt?: Maybe<Scalars['String']['output']>;
  decidedByUserId?: Maybe<Scalars['String']['output']>;
  email?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  postId?: Maybe<Scalars['ID']['output']>;
  postTitle?: Maybe<Scalars['String']['output']>;
  requestedAt: Scalars['String']['output'];
  status: Scalars['String']['output'];
  userId: Scalars['ID']['output'];
  username: Scalars['String']['output'];
};

export type OvertimeRate = {
  __typename?: 'OvertimeRate';
  calcType: Scalars['String']['output'];
  comment?: Maybe<Scalars['String']['output']>;
  currency: Scalars['String']['output'];
  fixedAmountPerHour: Scalars['Float']['output'];
  id: Scalars['ID']['output'];
  multiplier: Scalars['Float']['output'];
  name: Scalars['String']['output'];
};

export type OvertimeRateList = {
  __typename?: 'OvertimeRateList';
  paginationInfo: PaginationInfo;
  rates: Array<OvertimeRate>;
};

export type PaginatedLeaveRequestList = {
  __typename?: 'PaginatedLeaveRequestList';
  paginationInfo: PaginationInfo;
  requests: Array<LeaveRequest>;
};

export type PaginatedMemberPostAssignmentList = {
  __typename?: 'PaginatedMemberPostAssignmentList';
  assignments: Array<MemberPostAssignment>;
  paginationInfo: PaginationInfo;
};

export type PaginatedPostList = {
  __typename?: 'PaginatedPostList';
  paginationInfo: PaginationInfo;
  posts: Array<Post>;
};

export type PaginatedPostScheduleAssignmentList = {
  __typename?: 'PaginatedPostScheduleAssignmentList';
  assignments: Array<PostScheduleAssignment>;
  paginationInfo: PaginationInfo;
};

export type PaginatedRecordList = {
  __typename?: 'PaginatedRecordList';
  paginationInfo: PaginationInfo;
  records: Array<Record>;
};

export type PaginatedRouteList = {
  __typename?: 'PaginatedRouteList';
  paginationInfo: PaginationInfo;
  routes: Array<Route>;
};

export type PaginatedScheduleAssignmentList = {
  __typename?: 'PaginatedScheduleAssignmentList';
  assignments: Array<ScheduleAssignment>;
  paginationInfo: PaginationInfo;
};

export type PaginatedShiftCoverageList = {
  __typename?: 'PaginatedShiftCoverageList';
  coverages: Array<ShiftCoverage>;
  paginationInfo: PaginationInfo;
};

export type PaginatedShiftPatternList = {
  __typename?: 'PaginatedShiftPatternList';
  paginationInfo: PaginationInfo;
  patterns: Array<ShiftPattern>;
};

export type PaginationInfo = {
  __typename?: 'PaginationInfo';
  count: Scalars['Int']['output'];
};

export type PenaltyRule = {
  __typename?: 'PenaltyRule';
  amount: Scalars['Float']['output'];
  calcType: Scalars['String']['output'];
  comment?: Maybe<Scalars['String']['output']>;
  currency: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  lateThresholdCount: Scalars['Int']['output'];
  name: Scalars['String']['output'];
  percentOfSalary: Scalars['Float']['output'];
  type: Scalars['String']['output'];
};

export type PenaltyRuleList = {
  __typename?: 'PenaltyRuleList';
  paginationInfo: PaginationInfo;
  rules: Array<PenaltyRule>;
};

export type Permission = {
  __typename?: 'Permission';
  accesabilities: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
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

export type Post = {
  __typename?: 'Post';
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  location?: Maybe<PostLocation>;
  title: Scalars['String']['output'];
};

export type PostLocation = {
  __typename?: 'PostLocation';
  address?: Maybe<Scalars['String']['output']>;
  city?: Maybe<Scalars['String']['output']>;
  comment?: Maybe<Scalars['String']['output']>;
  country?: Maybe<Scalars['String']['output']>;
  latitude?: Maybe<Scalars['Float']['output']>;
  longitude?: Maybe<Scalars['Float']['output']>;
  requireGeoOnCheckIn: Scalars['Boolean']['output'];
  timezone?: Maybe<Scalars['String']['output']>;
};

export type PostLocationInput = {
  address?: InputMaybe<Scalars['String']['input']>;
  city?: InputMaybe<Scalars['String']['input']>;
  comment?: InputMaybe<Scalars['String']['input']>;
  country?: InputMaybe<Scalars['String']['input']>;
  latitude?: InputMaybe<Scalars['Float']['input']>;
  longitude?: InputMaybe<Scalars['Float']['input']>;
  requireGeoOnCheckIn?: InputMaybe<Scalars['Boolean']['input']>;
  timezone?: InputMaybe<Scalars['String']['input']>;
};

export type PostScheduleAssignment = {
  __typename?: 'PostScheduleAssignment';
  comment?: Maybe<Scalars['String']['output']>;
  effectiveFrom: Scalars['String']['output'];
  effectiveTo?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  postId: Scalars['ID']['output'];
  shiftPatternId: Scalars['ID']['output'];
};

export type PostWorkedHours = {
  __typename?: 'PostWorkedHours';
  checkCount: Scalars['Int']['output'];
  firstCheckIn: Scalars['Int']['output'];
  lastCheckOut: Scalars['Int']['output'];
  postId: Scalars['ID']['output'];
  workedHours: Scalars['Float']['output'];
};

export type Qr = {
  __typename?: 'QR';
  postFullAddress: Scalars['String']['output'];
  postTitle: Scalars['String']['output'];
  qr: Scalars['String']['output'];
};

export type QrGenInput = {
  method: RecordMethod;
  namespaceSlug?: InputMaybe<Scalars['String']['input']>;
  postId: Scalars['ID']['input'];
  secret?: InputMaybe<Scalars['String']['input']>;
};

export type Query = {
  __typename?: 'Query';
  _placeholder?: Maybe<Scalars['String']['output']>;
  calculateSalary: SalaryCalculationResult;
  exportAllUsersStats: Array<UserAttendanceStats>;
  exportDailyAttendance: Array<UserDailyAttendanceRecord>;
  getActiveMemberPostAssignment?: Maybe<MemberPostAssignment>;
  getActiveMembers: Array<Member>;
  getActiveMembersCount: Scalars['Int']['output'];
  getActivePostScheduleAssignment?: Maybe<PostScheduleAssignment>;
  getActiveScheduleAssignment?: Maybe<ScheduleAssignment>;
  getActiveSubscription?: Maybe<BillingSubscription>;
  getAllMemberSalaries: MemberSalaryList;
  getAllUsersStats: Array<UserAttendanceStats>;
  getAttendanceReport: AttendanceReport;
  getAttendanceSettings: AttendanceSettings;
  getLeaveRequests: PaginatedLeaveRequestList;
  getMemberPostAssignments: PaginatedMemberPostAssignmentList;
  getMemberRole?: Maybe<Role>;
  getMemberSalary?: Maybe<MemberSalary>;
  getMembersRolesAndSchedules: Array<MemberRoleAndScheduleEntry>;
  getMonthlySummary: AttendanceSummary;
  getMyPermissions: Array<Scalars['String']['output']>;
  getOnboardingRequests: Array<OnboardingRequestItem>;
  getOvertimeRates: OvertimeRateList;
  getPenaltyRules: PenaltyRuleList;
  getPermission?: Maybe<Permission>;
  getPermissionsDict: Scalars['String']['output'];
  getPlanLimits?: Maybe<PlanLimits>;
  getPlans: PlansResponse;
  getPost?: Maybe<Post>;
  getPostScheduleAssignments: PaginatedPostScheduleAssignmentList;
  getPosts: PaginatedPostList;
  getRecordByPostId?: Maybe<PaginatedRecordList>;
  getRecords: PaginatedRecordList;
  getRole: Role;
  getRoles: Array<Role>;
  getRoute?: Maybe<Route>;
  getRoutePasses: Array<RoutePass>;
  getRoutes: PaginatedRouteList;
  getSalaryHistory: Array<SalaryHistoryEntry>;
  getSchedule: Schedule;
  getScheduleAssignments: PaginatedScheduleAssignmentList;
  getShiftCoverages: PaginatedShiftCoverageList;
  getShiftPattern?: Maybe<ShiftPattern>;
  getShiftPatternDayOverrides: Array<ShiftPatternDayOverride>;
  getShiftPatterns: PaginatedShiftPatternList;
  getSummaryRange: Array<AttendanceSummary>;
  qrGen: Qr;
  validateRoutePass?: Maybe<RoutePass>;
};


export type QueryCalculateSalaryArgs = {
  input: CalculateSalaryInput;
};


export type QueryExportAllUsersStatsArgs = {
  input: ExportAllUsersStatsInput;
};


export type QueryExportDailyAttendanceArgs = {
  input: ExportDailyAttendanceInput;
};


export type QueryGetActiveMemberPostAssignmentArgs = {
  input: GetActiveMemberPostAssignmentInput;
};


export type QueryGetActiveMembersArgs = {
  page: Scalars['Int']['input'];
  pageSize: Scalars['Int']['input'];
};


export type QueryGetActivePostScheduleAssignmentArgs = {
  input: GetActivePostScheduleAssignmentInput;
};


export type QueryGetActiveScheduleAssignmentArgs = {
  input: GetActiveScheduleAssignmentInput;
};


export type QueryGetActiveSubscriptionArgs = {
  appBundle: Scalars['String']['input'];
};


export type QueryGetAllMemberSalariesArgs = {
  filter: DefaultFilterInput;
};


export type QueryGetAllUsersStatsArgs = {
  input: GetAllUsersStatsInput;
};


export type QueryGetAttendanceReportArgs = {
  input: GetAttendanceReportInput;
};


export type QueryGetLeaveRequestsArgs = {
  input: GetLeaveRequestsInput;
};


export type QueryGetMemberPostAssignmentsArgs = {
  input: GetMemberPostAssignmentsInput;
};


export type QueryGetMemberRoleArgs = {
  memberId: Scalars['ID']['input'];
};


export type QueryGetMemberSalaryArgs = {
  input?: InputMaybe<GetMemberSalaryInput>;
};


export type QueryGetMembersRolesAndSchedulesArgs = {
  input: GetMembersRolesAndSchedulesInput;
};


export type QueryGetMonthlySummaryArgs = {
  input: GetMonthlySummaryInput;
};


export type QueryGetOnboardingRequestsArgs = {
  status?: InputMaybe<Scalars['String']['input']>;
};


export type QueryGetOvertimeRatesArgs = {
  filter: DefaultFilterInput;
};


export type QueryGetPenaltyRulesArgs = {
  filter: DefaultFilterInput;
};


export type QueryGetPermissionArgs = {
  id: Scalars['ID']['input'];
};


export type QueryGetPlanLimitsArgs = {
  appBundle: Scalars['String']['input'];
};


export type QueryGetPlansArgs = {
  includeArchived?: InputMaybe<Scalars['Boolean']['input']>;
};


export type QueryGetPostArgs = {
  id: Scalars['ID']['input'];
};


export type QueryGetPostScheduleAssignmentsArgs = {
  input: GetPostScheduleAssignmentsInput;
};


export type QueryGetPostsArgs = {
  filter: DefaultFilterInput;
};


export type QueryGetRecordByPostIdArgs = {
  filter: GetByPostIdInput;
};


export type QueryGetRecordsArgs = {
  filter: DefaultFilterInput;
};


export type QueryGetRoleArgs = {
  id: Scalars['ID']['input'];
};


export type QueryGetRouteArgs = {
  id: Scalars['ID']['input'];
};


export type QueryGetRoutePassesArgs = {
  endDate?: InputMaybe<Scalars['String']['input']>;
  routeId: Scalars['ID']['input'];
  startDate?: InputMaybe<Scalars['String']['input']>;
  userId?: InputMaybe<Scalars['ID']['input']>;
};


export type QueryGetRoutesArgs = {
  filter: DefaultFilterInput;
};


export type QueryGetSalaryHistoryArgs = {
  input: GetSalaryHistoryInput;
};


export type QueryGetScheduleArgs = {
  input: GetScheduleInput;
};


export type QueryGetScheduleAssignmentsArgs = {
  input: GetScheduleAssignmentsInput;
};


export type QueryGetShiftCoveragesArgs = {
  input: GetShiftCoveragesInput;
};


export type QueryGetShiftPatternArgs = {
  input: GetShiftPatternInput;
};


export type QueryGetShiftPatternDayOverridesArgs = {
  input: GetShiftPatternDayOverridesInput;
};


export type QueryGetShiftPatternsArgs = {
  filter: DefaultFilterInput;
};


export type QueryGetSummaryRangeArgs = {
  input: GetSummaryRangeInput;
};


export type QueryQrGenArgs = {
  input: QrGenInput;
};


export type QueryValidateRoutePassArgs = {
  date: Scalars['String']['input'];
  routeId: Scalars['ID']['input'];
  userId: Scalars['ID']['input'];
};

export type Record = {
  __typename?: 'Record';
  email: Scalars['String']['output'];
  geoConfirmed?: Maybe<Scalars['Boolean']['output']>;
  id: Scalars['ID']['output'];
  latitude?: Maybe<Scalars['Float']['output']>;
  localDate?: Maybe<Scalars['String']['output']>;
  longitude?: Maybe<Scalars['Float']['output']>;
  method: RecordMethod;
  postId: Scalars['ID']['output'];
  suspicious: Scalars['Boolean']['output'];
  timestamp: Scalars['Int']['output'];
  timezone?: Maybe<Scalars['String']['output']>;
  userId: Scalars['ID']['output'];
  username: Scalars['String']['output'];
};

export enum RecordMethod {
  MethodPostPhrase = 'METHOD_POST_PHRASE',
  MethodQr = 'METHOD_QR',
  MethodQrStatic = 'METHOD_QR_STATIC',
  MethodUnknown = 'METHOD_UNKNOWN'
}

export type RejectLeaveInput = {
  id: Scalars['ID']['input'];
};

export type RejectShiftCoverageInput = {
  id: Scalars['ID']['input'];
};

/** Input for removing a role from a member (maps to RemoveRoleFromMemberRequest) */
export type RemoveRoleFromMemberInput = {
  memberId: Scalars['ID']['input'];
  roleId: Scalars['ID']['input'];
};

export type RequestLeaveInput = {
  comment?: InputMaybe<Scalars['String']['input']>;
  endDate: Scalars['String']['input'];
  startDate: Scalars['String']['input'];
  type: Scalars['String']['input'];
  userId: Scalars['ID']['input'];
};

export type RequestOnboardingInput = {
  email?: InputMaybe<Scalars['String']['input']>;
  postId?: InputMaybe<Scalars['ID']['input']>;
  username: Scalars['String']['input'];
};

export type RequestShiftCoverageInput = {
  comment?: InputMaybe<Scalars['String']['input']>;
  coveringUserId: Scalars['ID']['input'];
  date: Scalars['String']['input'];
  originalUserId: Scalars['ID']['input'];
};

/** Role domain model */
export type Role = {
  __typename?: 'Role';
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  permissionIds: Array<Scalars['ID']['output']>;
};

export type Route = {
  __typename?: 'Route';
  id: Scalars['ID']['output'];
  milestones: Array<RouteMilestone>;
  title: Scalars['String']['output'];
};

export type RouteMilestone = {
  __typename?: 'RouteMilestone';
  postId: Scalars['ID']['output'];
  priority: Scalars['Int']['output'];
};

export type RouteMilestoneDetail = {
  __typename?: 'RouteMilestoneDetail';
  isCorrectOrder: Scalars['Boolean']['output'];
  postId: Scalars['ID']['output'];
  priority: Scalars['Int']['output'];
  recordId?: Maybe<Scalars['ID']['output']>;
  timestamp?: Maybe<Scalars['Int']['output']>;
};

export type RoutePass = {
  __typename?: 'RoutePass';
  date: Scalars['String']['output'];
  details: Array<RouteMilestoneDetail>;
  firstRecordId?: Maybe<Scalars['ID']['output']>;
  id: Scalars['ID']['output'];
  lastRecordId?: Maybe<Scalars['ID']['output']>;
  processedAt: Scalars['Int']['output'];
  routeId: Scalars['ID']['output'];
  status: Scalars['String']['output'];
  userId: Scalars['ID']['output'];
};

export type SalaryCalculationResult = {
  __typename?: 'SalaryCalculationResult';
  baseAmount: Scalars['Float']['output'];
  currency: Scalars['String']['output'];
  lateDays: Scalars['Int']['output'];
  lateThresholdTriggered: Scalars['Boolean']['output'];
  overtimeAmount: Scalars['Float']['output'];
  overtimeHours: Scalars['Float']['output'];
  penaltyAmount: Scalars['Float']['output'];
  requiredHours: Scalars['Float']['output'];
  totalAmount: Scalars['Float']['output'];
  userId: Scalars['ID']['output'];
  violationDays: Scalars['Int']['output'];
  workedHours: Scalars['Float']['output'];
};

export type SalaryHistoryEntry = {
  __typename?: 'SalaryHistoryEntry';
  baseAmount: Scalars['Float']['output'];
  calculatedAt: Scalars['Int']['output'];
  currency: Scalars['String']['output'];
  lateDays: Scalars['Int']['output'];
  lateThresholdTriggered: Scalars['Boolean']['output'];
  month: Scalars['Int']['output'];
  overtimeAmount: Scalars['Float']['output'];
  overtimeHours: Scalars['Float']['output'];
  penaltyAmount: Scalars['Float']['output'];
  requiredHours: Scalars['Float']['output'];
  totalAmount: Scalars['Float']['output'];
  userId: Scalars['ID']['output'];
  violationDays: Scalars['Int']['output'];
  workedHours: Scalars['Float']['output'];
  year: Scalars['Int']['output'];
};

export type Schedule = {
  __typename?: 'Schedule';
  comment?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  month: Scalars['Int']['output'];
  shouldAttendDaysPerMonth: Scalars['Int']['output'];
  shouldAttendHoursPerDay: Scalars['Int']['output'];
  userId: Scalars['ID']['output'];
  year: Scalars['Int']['output'];
};

export type ScheduleAssignment = {
  __typename?: 'ScheduleAssignment';
  comment?: Maybe<Scalars['String']['output']>;
  effectiveFrom: Scalars['String']['output'];
  effectiveTo?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  shiftPatternId: Scalars['ID']['output'];
  userId: Scalars['ID']['output'];
};

export type SetMemberActiveInput = {
  isActive: Scalars['Boolean']['input'];
  userId: Scalars['ID']['input'];
};

export type SetMemberSalaryInput = {
  amount: Scalars['Float']['input'];
  comment?: InputMaybe<Scalars['String']['input']>;
  currency: Scalars['String']['input'];
  overtimeRateId?: InputMaybe<Scalars['ID']['input']>;
  penaltyRuleIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  userId: Scalars['ID']['input'];
};

export type SetShiftPatternDayOverrideInput = {
  comment?: InputMaybe<Scalars['String']['input']>;
  date: Scalars['String']['input'];
  isWorkDay: Scalars['Boolean']['input'];
  shiftPatternId: Scalars['ID']['input'];
};

export type ShiftCoverage = {
  __typename?: 'ShiftCoverage';
  comment?: Maybe<Scalars['String']['output']>;
  coveringUserId: Scalars['ID']['output'];
  date: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  originalUserId: Scalars['ID']['output'];
  requestedByUserId: Scalars['ID']['output'];
  status: Scalars['String']['output'];
};

export type ShiftPattern = {
  __typename?: 'ShiftPattern';
  comment?: Maybe<Scalars['String']['output']>;
  earlyLeaveThreshold?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  lateThreshold?: Maybe<Scalars['String']['output']>;
  name: Scalars['String']['output'];
  requiredHoursPerDay: Scalars['Float']['output'];
  rotationAnchorDate: Scalars['String']['output'];
  rotationOffDays: Scalars['Int']['output'];
  rotationWorkDays: Scalars['Int']['output'];
  shiftEndTime: Scalars['String']['output'];
  shiftStartTime: Scalars['String']['output'];
  type: ShiftPatternType;
  workDaysOfWeek?: Maybe<Array<Scalars['Int']['output']>>;
};

export type ShiftPatternDayOverride = {
  __typename?: 'ShiftPatternDayOverride';
  comment?: Maybe<Scalars['String']['output']>;
  date: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  isWorkDay: Scalars['Boolean']['output'];
  shiftPatternId: Scalars['ID']['output'];
};

export enum ShiftPatternType {
  FixedWeekdays = 'FIXED_WEEKDAYS',
  Rotating = 'ROTATING'
}

export enum SubscriptionStatus {
  SubscriptionActive = 'SUBSCRIPTION_ACTIVE',
  SubscriptionCanceled = 'SUBSCRIPTION_CANCELED',
  SubscriptionExpired = 'SUBSCRIPTION_EXPIRED',
  SubscriptionIncomplete = 'SUBSCRIPTION_INCOMPLETE',
  SubscriptionPastDue = 'SUBSCRIPTION_PAST_DUE',
  SubscriptionTrialing = 'SUBSCRIPTION_TRIALING'
}

export type UpdateAttendanceSettingsInput = {
  allowLatenessMakeup: Scalars['Boolean']['input'];
  earlyLeaveThreshold: Scalars['String']['input'];
  lateArrivalThreshold: Scalars['String']['input'];
  roundingMinutes: Scalars['Int']['input'];
};

export type UpdateMemberPostAssignmentInput = {
  comment?: InputMaybe<Scalars['String']['input']>;
  effectiveFrom: Scalars['String']['input'];
  effectiveTo?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
  postId: Scalars['ID']['input'];
};

export type UpdateOvertimeRateInput = {
  calcType: Scalars['String']['input'];
  comment?: InputMaybe<Scalars['String']['input']>;
  currency?: InputMaybe<Scalars['String']['input']>;
  fixedAmountPerHour?: InputMaybe<Scalars['Float']['input']>;
  id: Scalars['ID']['input'];
  multiplier?: InputMaybe<Scalars['Float']['input']>;
  name: Scalars['String']['input'];
};

export type UpdatePenaltyRuleInput = {
  amount?: InputMaybe<Scalars['Float']['input']>;
  calcType: Scalars['String']['input'];
  comment?: InputMaybe<Scalars['String']['input']>;
  currency?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
  lateThresholdCount?: InputMaybe<Scalars['Int']['input']>;
  name: Scalars['String']['input'];
  percentOfSalary?: InputMaybe<Scalars['Float']['input']>;
  type: Scalars['String']['input'];
};

export type UpdatePermissionInput = {
  accesabilities?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
};

export type UpdatePostInput = {
  description?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
  location?: InputMaybe<PostLocationInput>;
  phrase?: InputMaybe<Scalars['String']['input']>;
  title?: InputMaybe<Scalars['String']['input']>;
};

export type UpdatePostScheduleAssignmentInput = {
  comment?: InputMaybe<Scalars['String']['input']>;
  effectiveFrom: Scalars['String']['input'];
  effectiveTo?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
  shiftPatternId: Scalars['ID']['input'];
};

/** Input for updating a role (maps to UpdateRoleRequest without id) */
export type UpdateRoleInput = {
  name?: InputMaybe<Scalars['String']['input']>;
  permissionIds?: InputMaybe<Array<Scalars['ID']['input']>>;
};

export type UpdateScheduleAssignmentInput = {
  comment?: InputMaybe<Scalars['String']['input']>;
  effectiveFrom: Scalars['String']['input'];
  effectiveTo?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
  shiftPatternId: Scalars['ID']['input'];
};

export type UpdateScheduleInput = {
  comment?: InputMaybe<Scalars['String']['input']>;
  month: Scalars['Int']['input'];
  shouldAttendDaysPerMonth: Scalars['Int']['input'];
  shouldAttendHoursPerDay: Scalars['Int']['input'];
  userId: Scalars['ID']['input'];
  year: Scalars['Int']['input'];
};

export type UpdateShiftPatternInput = {
  comment?: InputMaybe<Scalars['String']['input']>;
  earlyLeaveThreshold?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['ID']['input'];
  lateThreshold?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  requiredHoursPerDay: Scalars['Float']['input'];
  rotationAnchorDate: Scalars['String']['input'];
  rotationOffDays: Scalars['Int']['input'];
  rotationWorkDays: Scalars['Int']['input'];
  shiftEndTime: Scalars['String']['input'];
  shiftStartTime: Scalars['String']['input'];
  type: ShiftPatternType;
  workDaysOfWeek?: InputMaybe<Array<Scalars['Int']['input']>>;
};

export type UserAttendanceStats = {
  __typename?: 'UserAttendanceStats';
  attendedDays: Scalars['Int']['output'];
  earlyLeaveDays: Scalars['Int']['output'];
  geoConfirmedDays: Scalars['Int']['output'];
  hasScheduleAssignment: Scalars['Boolean']['output'];
  lateDays: Scalars['Int']['output'];
  lateMadeUpDays: Scalars['Int']['output'];
  legitimateAbsences: Scalars['Int']['output'];
  suspiciousDays: Scalars['Int']['output'];
  totalWorkedHours: Scalars['Float']['output'];
  userId: Scalars['ID']['output'];
  username: Scalars['String']['output'];
  violationDays: Scalars['Int']['output'];
  workDays: Scalars['Int']['output'];
};

export type UserDailyAttendanceRecord = {
  __typename?: 'UserDailyAttendanceRecord';
  attended: Scalars['Boolean']['output'];
  date: Scalars['String']['output'];
  earlyLeave: Scalars['Boolean']['output'];
  firstCheckIn: Scalars['Int']['output'];
  lastCheckOut: Scalars['Int']['output'];
  late: Scalars['Boolean']['output'];
  lateMadeUp: Scalars['Boolean']['output'];
  legitimate: Scalars['Boolean']['output'];
  reason?: Maybe<Scalars['String']['output']>;
  timezone?: Maybe<Scalars['String']['output']>;
  userId: Scalars['ID']['output'];
  username: Scalars['String']['output'];
  workedHours: Scalars['Float']['output'];
};

export type GetAppTokenMutationVariables = Exact<{ [key: string]: never; }>;


export type GetAppTokenMutation = { __typename?: 'Mutation', getAppToken?: { __typename?: 'AppToken', token: string } | null };

export type GetPlansQueryVariables = Exact<{
  includeArchived: Scalars['Boolean']['input'];
}>;


export type GetPlansQuery = { __typename?: 'Query', getPlans: { __typename?: 'PlansResponse', total: number, plans: Array<{ __typename?: 'Plan', id: string, code: string, name: string, description: string, currency: string, interval: BillingInterval, amountCents: number, trialDays: number, includedSeats: number, includedUnits: number, overagePriceCents: number, status: PlanStatus }> } };

export type AtraceCreatePostMutationVariables = Exact<{
  input: CreatePostInput;
}>;


export type AtraceCreatePostMutation = { __typename?: 'Mutation', createPost: { __typename?: 'Post', id: string, title: string, description?: string | null, location?: { __typename?: 'PostLocation', comment?: string | null, country?: string | null, city?: string | null, address?: string | null, latitude?: number | null, longitude?: number | null } | null } };

export type AtraceDeletePostMutationVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type AtraceDeletePostMutation = { __typename?: 'Mutation', deletePost: { __typename?: 'Post', id: string } };

export type AtracePostsQueryVariables = Exact<{
  filter: DefaultFilterInput;
}>;


export type AtracePostsQuery = { __typename?: 'Query', getPosts: { __typename?: 'PaginatedPostList', posts: Array<{ __typename?: 'Post', id: string, title: string, description?: string | null, location?: { __typename?: 'PostLocation', comment?: string | null, country?: string | null, city?: string | null, address?: string | null, latitude?: number | null, longitude?: number | null } | null }>, paginationInfo: { __typename?: 'PaginationInfo', count: number } } };

export type AtraceUpdatePostMutationVariables = Exact<{
  input: UpdatePostInput;
}>;


export type AtraceUpdatePostMutation = { __typename?: 'Mutation', updatePost: { __typename?: 'Post', id: string, title: string, description?: string | null, location?: { __typename?: 'PostLocation', comment?: string | null, country?: string | null, city?: string | null, address?: string | null, latitude?: number | null, longitude?: number | null } | null } };


export const GetAppTokenDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"GetAppToken"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"getAppToken"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"token"}}]}}]}}]} as unknown as DocumentNode<GetAppTokenMutation, GetAppTokenMutationVariables>;
export const GetPlansDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetPlans"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"includeArchived"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"getPlans"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"includeArchived"},"value":{"kind":"Variable","name":{"kind":"Name","value":"includeArchived"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"total"}},{"kind":"Field","name":{"kind":"Name","value":"plans"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"currency"}},{"kind":"Field","name":{"kind":"Name","value":"interval"}},{"kind":"Field","name":{"kind":"Name","value":"amountCents"}},{"kind":"Field","name":{"kind":"Name","value":"trialDays"}},{"kind":"Field","name":{"kind":"Name","value":"includedSeats"}},{"kind":"Field","name":{"kind":"Name","value":"includedUnits"}},{"kind":"Field","name":{"kind":"Name","value":"overagePriceCents"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}}]}}]} as unknown as DocumentNode<GetPlansQuery, GetPlansQueryVariables>;
export const AtraceCreatePostDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"AtraceCreatePost"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreatePostInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createPost"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"location"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"comment"}},{"kind":"Field","name":{"kind":"Name","value":"country"}},{"kind":"Field","name":{"kind":"Name","value":"city"}},{"kind":"Field","name":{"kind":"Name","value":"address"}},{"kind":"Field","name":{"kind":"Name","value":"latitude"}},{"kind":"Field","name":{"kind":"Name","value":"longitude"}}]}}]}}]}}]} as unknown as DocumentNode<AtraceCreatePostMutation, AtraceCreatePostMutationVariables>;
export const AtraceDeletePostDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"AtraceDeletePost"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deletePost"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<AtraceDeletePostMutation, AtraceDeletePostMutationVariables>;
export const AtracePostsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"AtracePosts"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"filter"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"DefaultFilterInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"getPosts"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"filter"},"value":{"kind":"Variable","name":{"kind":"Name","value":"filter"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"posts"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"location"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"comment"}},{"kind":"Field","name":{"kind":"Name","value":"country"}},{"kind":"Field","name":{"kind":"Name","value":"city"}},{"kind":"Field","name":{"kind":"Name","value":"address"}},{"kind":"Field","name":{"kind":"Name","value":"latitude"}},{"kind":"Field","name":{"kind":"Name","value":"longitude"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"paginationInfo"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"count"}}]}}]}}]}}]} as unknown as DocumentNode<AtracePostsQuery, AtracePostsQueryVariables>;
export const AtraceUpdatePostDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"AtraceUpdatePost"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdatePostInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updatePost"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"location"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"comment"}},{"kind":"Field","name":{"kind":"Name","value":"country"}},{"kind":"Field","name":{"kind":"Name","value":"city"}},{"kind":"Field","name":{"kind":"Name","value":"address"}},{"kind":"Field","name":{"kind":"Name","value":"latitude"}},{"kind":"Field","name":{"kind":"Name","value":"longitude"}}]}}]}}]}}]} as unknown as DocumentNode<AtraceUpdatePostMutation, AtraceUpdatePostMutationVariables>;