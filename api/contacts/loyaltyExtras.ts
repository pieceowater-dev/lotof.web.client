import { gql } from 'graphql-request';
import { contactsClient, setContactsAppToken } from '../clients';

// Tiers, promotions, automatic rules and milestones of the Contacts loyalty programme.

export type TierStatus = 'TIER_STATUS_ACTIVE' | 'TIER_STATUS_INACTIVE';
export type TierCriteria = 'TIER_QUALIFICATION_BONUS_EARNED' | 'TIER_QUALIFICATION_TOTAL_SPENT' | 'TIER_QUALIFICATION_VISIT_COUNT' | 'TIER_QUALIFICATION_MANUAL';

export interface LoyaltyTier {
  id: string; name: string; description: string; level: number; status: TierStatus; qualificationCriteria: TierCriteria;
  qualificationThreshold: number; bonusMultiplier: number; benefitsJson: string; colorHex: string; iconUrl: string;
}

export type PromotionType = 'BONUS_MULTIPLIER' | 'FIXED_BONUS' | 'CASHBACK' | 'DISCOUNT' | 'FREE_STAMPS' | 'CUSTOM';
export type PromotionStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'EXPIRED' | 'ARCHIVED';
export type PromotionTarget = 'ALL_CLIENTS' | 'SEGMENT' | 'TIER' | 'INDIVIDUAL';

export interface LoyaltyPromotion {
  id: string; name: string; description?: string | null; type: PromotionType; status: PromotionStatus; targetType: PromotionTarget;
  targetId?: string | null; value: number; usageLimitPerClient: number; totalUsageLimit: number; currentUsageCount: number;
  validFrom?: string | null; validUntil?: string | null;
}

export type RuleType = 'RULE_TYPE_BONUS_EARNING' | 'RULE_TYPE_STAMP_EARNING' | 'RULE_TYPE_MULTIPLIER' | 'RULE_TYPE_TIER_UPGRADE';
export type RuleTrigger = 'RULE_TRIGGER_PURCHASE' | 'RULE_TRIGGER_VISIT' | 'RULE_TRIGGER_BIRTHDAY' | 'RULE_TRIGGER_REGISTRATION' | 'RULE_TRIGGER_EVENT';
export type RuleStatus = 'RULE_STATUS_ACTIVE' | 'RULE_STATUS_INACTIVE' | 'RULE_STATUS_SCHEDULED';

export interface LoyaltyRule {
  id: string; name: string; description: string; type: RuleType; trigger: RuleTrigger; status: RuleStatus; priority: number;
  conditionsJson: string; actionsJson: string; validFrom?: string | null; validUntil?: string | null; segmentId?: string | null;
}

export type MilestoneType = 'MILESTONE_TYPE_BIRTHDAY' | 'MILESTONE_TYPE_ANNIVERSARY' | 'MILESTONE_TYPE_CUSTOM_DATE';
export type MilestoneStatus = 'MILESTONE_STATUS_ACTIVE' | 'MILESTONE_STATUS_INACTIVE';

export interface MilestoneTemplate {
  id: string; name: string; description?: string | null; type: MilestoneType; status: MilestoneStatus; dynamicFieldKey?: string | null;
  daysBeforeNotification: number; daysAfterCelebration: number; rewardActionsJson?: string | null; messageTemplate?: string | null;
}

export interface UpcomingMilestone {
  id: string; clientId: string; templateId: string; milestoneName: string; milestoneDate: string; nextOccurrence: string;
  yearsCount: number; notified: boolean; rewarded: boolean;
}

async function run<T>(token: string, query: string, variables?: Record<string, unknown>): Promise<T> {
  if (!token) throw new Error('Token is required');
  setContactsAppToken(token);
  return contactsClient.request<T>(query, variables);
}

const TIER_FIELDS = 'id name description level status qualificationCriteria qualificationThreshold bonusMultiplier benefitsJson colorHex iconUrl';
const PROMO_FIELDS = 'id name description type status targetType targetId value usageLimitPerClient totalUsageLimit currentUsageCount validFrom validUntil';
const RULE_FIELDS = 'id name description type trigger status priority conditionsJson actionsJson validFrom validUntil segmentId';
const TPL_FIELDS = 'id name description type status dynamicFieldKey daysBeforeNotification daysAfterCelebration rewardActionsJson messageTemplate';

// --- tiers ---
export async function listTiers(token: string): Promise<LoyaltyTier[]> {
  const r = await run<{ tiers: { rows: LoyaltyTier[] } | null }>(token, gql`query Tiers { tiers { rows { ${TIER_FIELDS} } } }`);
  return r.tiers?.rows ?? [];
}
export async function createTier(token: string, input: Omit<LoyaltyTier, 'id' | 'iconUrl'> & { iconUrl?: string }) {
  const r = await run<{ createTier: LoyaltyTier }>(token, gql`mutation CreateTier($input: CreateTierInput!) { createTier(input: $input) { ${TIER_FIELDS} } }`, { input: { iconUrl: '', ...input } });
  return r.createTier;
}
export async function updateTier(token: string, input: Partial<LoyaltyTier> & { id: string }) {
  const r = await run<{ updateTier: LoyaltyTier }>(token, gql`mutation UpdateTier($input: UpdateTierInput!) { updateTier(input: $input) { ${TIER_FIELDS} } }`, { input });
  return r.updateTier;
}
export async function deleteTier(token: string, id: string) {
  await run(token, gql`mutation DeleteTier($id: ID!) { deleteTier(id: $id) { success } }`, { id });
}
export async function recalculateTiers(token: string): Promise<number> {
  const r = await run<{ recalculateClientTiers: { clientsUpdated: number } }>(token, gql`mutation Recalc($input: RecalculateClientTiersInput!) { recalculateClientTiers(input: $input) { clientsUpdated } }`, { input: {} });
  return r.recalculateClientTiers.clientsUpdated;
}

// --- promotions ---
export async function listPromotions(token: string): Promise<LoyaltyPromotion[]> {
  const r = await run<{ promotions: { rows: LoyaltyPromotion[] } }>(token, gql`query Promotions { promotions { rows { ${PROMO_FIELDS} } } }`);
  return r.promotions.rows;
}
export async function createPromotion(token: string, input: Record<string, unknown>) {
  const r = await run<{ createPromotion: LoyaltyPromotion }>(token, gql`mutation CreatePromotion($input: CreatePromotionInput!) { createPromotion(input: $input) { ${PROMO_FIELDS} } }`, { input });
  return r.createPromotion;
}
export async function updatePromotion(token: string, input: Record<string, unknown> & { id: string }) {
  const r = await run<{ updatePromotion: LoyaltyPromotion }>(token, gql`mutation UpdatePromotion($input: UpdatePromotionInput!) { updatePromotion(input: $input) { ${PROMO_FIELDS} } }`, { input });
  return r.updatePromotion;
}
export async function deletePromotion(token: string, id: string) {
  await run(token, gql`mutation DeletePromotion($id: ID!) { deletePromotion(id: $id) { success } }`, { id });
}
export async function setPromotionActive(token: string, id: string, active: boolean) {
  const q = active
    ? gql`mutation Activate($id: ID!) { activatePromotion(id: $id) { ${PROMO_FIELDS} } }`
    : gql`mutation Deactivate($id: ID!) { deactivatePromotion(id: $id) { ${PROMO_FIELDS} } }`;
  const r = await run<Record<string, LoyaltyPromotion>>(token, q, { id });
  return Object.values(r)[0];
}

// --- rules ---
export async function listRules(token: string): Promise<LoyaltyRule[]> {
  const r = await run<{ rules: { rows: LoyaltyRule[] } }>(token, gql`query Rules { rules { rows { ${RULE_FIELDS} } } }`);
  return r.rules.rows;
}
export async function createRule(token: string, input: Record<string, unknown>) {
  const r = await run<{ createRule: LoyaltyRule }>(token, gql`mutation CreateRule($input: CreateRuleInput!) { createRule(input: $input) { ${RULE_FIELDS} } }`, { input });
  return r.createRule;
}
export async function updateRule(token: string, input: Record<string, unknown> & { id: string }) {
  const r = await run<{ updateRule: LoyaltyRule }>(token, gql`mutation UpdateRule($input: UpdateRuleInput!) { updateRule(input: $input) { ${RULE_FIELDS} } }`, { input });
  return r.updateRule;
}
export async function deleteRule(token: string, id: string) {
  await run(token, gql`mutation DeleteRule($id: ID!) { deleteRule(id: $id) { success } }`, { id });
}

// --- milestones ---
export async function listMilestoneTemplates(token: string): Promise<MilestoneTemplate[]> {
  const r = await run<{ milestoneTemplates: { rows: MilestoneTemplate[] } }>(token, gql`query MilestoneTemplates { milestoneTemplates { rows { ${TPL_FIELDS} } } }`);
  return r.milestoneTemplates.rows;
}
export async function createMilestoneTemplate(token: string, input: Record<string, unknown>) {
  const r = await run<{ createMilestoneTemplate: MilestoneTemplate }>(token, gql`mutation CreateMilestoneTemplate($input: CreateMilestoneTemplateInput!) { createMilestoneTemplate(input: $input) { ${TPL_FIELDS} } }`, { input });
  return r.createMilestoneTemplate;
}
export async function updateMilestoneTemplate(token: string, input: Record<string, unknown> & { id: string }) {
  const r = await run<{ updateMilestoneTemplate: MilestoneTemplate }>(token, gql`mutation UpdateMilestoneTemplate($input: UpdateMilestoneTemplateInput!) { updateMilestoneTemplate(input: $input) { ${TPL_FIELDS} } }`, { input });
  return r.updateMilestoneTemplate;
}
export async function deleteMilestoneTemplate(token: string, id: string) {
  await run(token, gql`mutation DeleteMilestoneTemplate($id: ID!) { deleteMilestoneTemplate(id: $id) { success } }`, { id });
}
export async function upcomingMilestones(token: string, daysAhead = 30): Promise<UpcomingMilestone[]> {
  const r = await run<{ upcomingMilestones: { rows: UpcomingMilestone[] } }>(token, gql`query Upcoming($input: GetUpcomingMilestonesInput!) { upcomingMilestones(input: $input) { rows { id clientId templateId milestoneName milestoneDate nextOccurrence yearsCount notified rewarded } } }`, { input: { daysAhead } });
  return r.upcomingMilestones.rows;
}

/** Refreshes every client's dates for all active templates (an empty client id means all clients). */
export async function syncMilestones(token: string) {
  await run(token, gql`mutation SyncMilestones($input: SyncClientMilestonesInput!) { syncClientMilestones(input: $input) { syncedCount createdCount updatedCount } }`, { input: { clientId: '' } });
}
