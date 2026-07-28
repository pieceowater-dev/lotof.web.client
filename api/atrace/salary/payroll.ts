import { atraceClient } from '@/api/clients';
import { getDeviceHeaders } from '@/utils/device';
import { atraceRequestWithRefresh } from '@/api/atrace/atraceRequestWithRefresh';
import { useRoute } from 'vue-router';

export type AtraceOvertimeCalcType = 'multiplier' | 'fixed';

export type AtraceOvertimeRate = {
  id: string;
  name: string;
  calcType: AtraceOvertimeCalcType;
  multiplier: number;
  fixedAmountPerHour: number;
  currency: string;
  comment?: string;
};

export type AtracePenaltyRuleType = 'absence' | 'late_threshold';
export type AtracePenaltyCalcType = 'percent' | 'fixed';

export type AtracePenaltyRule = {
  id: string;
  name: string;
  type: AtracePenaltyRuleType;
  calcType: AtracePenaltyCalcType;
  percentOfSalary: number;
  amount: number;
  lateThresholdCount: number;
  currency: string;
  comment?: string;
};

export type AtraceSalaryCalculationResult = {
  userId: string;
  baseAmount: number;
  overtimeAmount: number;
  penaltyAmount: number;
  totalAmount: number;
  workedHours: number;
  requiredHours: number;
  overtimeHours: number;
  violationDays: number;
  lateDays: number;
  lateThresholdTriggered: boolean;
  currency: string;
};

function resolveNsSlug(nsSlug?: string): string {
  if (nsSlug) return nsSlug;
  try {
    const routeNs = useRoute().params.namespace;
    if (typeof routeNs === 'string' && routeNs) return routeNs;
  } catch {}
  throw new Error('Namespace slug is required');
}

async function headers(namespace: string) {
  const devHeaders = await getDeviceHeaders();
  return { Namespace: namespace, ...devHeaders };
}

const OVERTIME_FIELDS = `id name calcType multiplier fixedAmountPerHour currency comment`;
const PENALTY_FIELDS = `id name type calcType percentOfSalary amount lateThresholdCount currency comment`;

const GET_OVERTIME_RATES = `
  query GetOvertimeRates($filter: DefaultFilterInput!) {
    getOvertimeRates(filter: $filter) { rates { ${OVERTIME_FIELDS} } paginationInfo { count } }
  }
`;

export async function atraceGetOvertimeRates(nsSlug?: string): Promise<AtraceOvertimeRate[]> {
  const namespace = resolveNsSlug(nsSlug);
  return atraceRequestWithRefresh(async () => {
    const response = await atraceClient.request<{ getOvertimeRates: { rates: AtraceOvertimeRate[] } }>(
      GET_OVERTIME_RATES,
      { filter: { pagination: { page: 1, length: 'ONE_HUNDRED' }, sort: { by: 'ASC', field: 'name' } } },
      { headers: await headers(namespace) }
    );
    return response.getOvertimeRates.rates;
  }, namespace);
}

const CREATE_OVERTIME_RATE = `
  mutation CreateOvertimeRate($input: CreateOvertimeRateInput!) {
    createOvertimeRate(input: $input) { ${OVERTIME_FIELDS} }
  }
`;
const UPDATE_OVERTIME_RATE = `
  mutation UpdateOvertimeRate($input: UpdateOvertimeRateInput!) {
    updateOvertimeRate(input: $input) { ${OVERTIME_FIELDS} }
  }
`;
const DELETE_OVERTIME_RATE = `
  mutation DeleteOvertimeRate($id: ID!) {
    deleteOvertimeRate(input: { id: $id }) { id }
  }
`;

export async function atraceCreateOvertimeRate(input: Omit<AtraceOvertimeRate, 'id'>, nsSlug?: string): Promise<AtraceOvertimeRate> {
  const namespace = resolveNsSlug(nsSlug);
  return atraceRequestWithRefresh(async () => {
    const response = await atraceClient.request<{ createOvertimeRate: AtraceOvertimeRate }>(
      CREATE_OVERTIME_RATE, { input }, { headers: await headers(namespace) }
    );
    return response.createOvertimeRate;
  }, namespace);
}

export async function atraceUpdateOvertimeRate(input: AtraceOvertimeRate, nsSlug?: string): Promise<AtraceOvertimeRate> {
  const namespace = resolveNsSlug(nsSlug);
  return atraceRequestWithRefresh(async () => {
    const response = await atraceClient.request<{ updateOvertimeRate: AtraceOvertimeRate }>(
      UPDATE_OVERTIME_RATE, { input }, { headers: await headers(namespace) }
    );
    return response.updateOvertimeRate;
  }, namespace);
}

export async function atraceDeleteOvertimeRate(id: string, nsSlug?: string): Promise<void> {
  const namespace = resolveNsSlug(nsSlug);
  return atraceRequestWithRefresh(async () => {
    await atraceClient.request(DELETE_OVERTIME_RATE, { id }, { headers: await headers(namespace) });
  }, namespace);
}

const GET_PENALTY_RULES = `
  query GetPenaltyRules($filter: DefaultFilterInput!) {
    getPenaltyRules(filter: $filter) { rules { ${PENALTY_FIELDS} } paginationInfo { count } }
  }
`;

export async function atraceGetPenaltyRules(nsSlug?: string): Promise<AtracePenaltyRule[]> {
  const namespace = resolveNsSlug(nsSlug);
  return atraceRequestWithRefresh(async () => {
    const response = await atraceClient.request<{ getPenaltyRules: { rules: AtracePenaltyRule[] } }>(
      GET_PENALTY_RULES,
      { filter: { pagination: { page: 1, length: 'ONE_HUNDRED' }, sort: { by: 'ASC', field: 'name' } } },
      { headers: await headers(namespace) }
    );
    return response.getPenaltyRules.rules;
  }, namespace);
}

const CREATE_PENALTY_RULE = `
  mutation CreatePenaltyRule($input: CreatePenaltyRuleInput!) {
    createPenaltyRule(input: $input) { ${PENALTY_FIELDS} }
  }
`;
const UPDATE_PENALTY_RULE = `
  mutation UpdatePenaltyRule($input: UpdatePenaltyRuleInput!) {
    updatePenaltyRule(input: $input) { ${PENALTY_FIELDS} }
  }
`;
const DELETE_PENALTY_RULE = `
  mutation DeletePenaltyRule($id: ID!) {
    deletePenaltyRule(input: { id: $id }) { id }
  }
`;

export async function atraceCreatePenaltyRule(input: Omit<AtracePenaltyRule, 'id'>, nsSlug?: string): Promise<AtracePenaltyRule> {
  const namespace = resolveNsSlug(nsSlug);
  return atraceRequestWithRefresh(async () => {
    const response = await atraceClient.request<{ createPenaltyRule: AtracePenaltyRule }>(
      CREATE_PENALTY_RULE, { input }, { headers: await headers(namespace) }
    );
    return response.createPenaltyRule;
  }, namespace);
}

export async function atraceUpdatePenaltyRule(input: AtracePenaltyRule, nsSlug?: string): Promise<AtracePenaltyRule> {
  const namespace = resolveNsSlug(nsSlug);
  return atraceRequestWithRefresh(async () => {
    const response = await atraceClient.request<{ updatePenaltyRule: AtracePenaltyRule }>(
      UPDATE_PENALTY_RULE, { input }, { headers: await headers(namespace) }
    );
    return response.updatePenaltyRule;
  }, namespace);
}

export async function atraceDeletePenaltyRule(id: string, nsSlug?: string): Promise<void> {
  const namespace = resolveNsSlug(nsSlug);
  return atraceRequestWithRefresh(async () => {
    await atraceClient.request(DELETE_PENALTY_RULE, { id }, { headers: await headers(namespace) });
  }, namespace);
}

const CALCULATE_SALARY = `
  query CalculateSalary($userId: ID, $startDate: String!, $endDate: String!) {
    calculateSalary(input: { userId: $userId, startDate: $startDate, endDate: $endDate }) {
      userId
      baseAmount
      overtimeAmount
      penaltyAmount
      totalAmount
      workedHours
      requiredHours
      overtimeHours
      violationDays
      lateDays
      lateThresholdTriggered
      currency
    }
  }
`;

export async function atraceCalculateSalary(
  startDate: string,
  endDate: string,
  userId?: string,
  nsSlug?: string
): Promise<AtraceSalaryCalculationResult> {
  const namespace = resolveNsSlug(nsSlug);
  return atraceRequestWithRefresh(async () => {
    const response = await atraceClient.request<{ calculateSalary: AtraceSalaryCalculationResult }>(
      CALCULATE_SALARY,
      { userId: userId ?? null, startDate, endDate },
      { headers: await headers(namespace) }
    );
    return response.calculateSalary;
  }, namespace);
}

export type AtraceSalaryHistoryEntry = {
  userId: string;
  year: number;
  month: number;
  baseAmount: number;
  overtimeAmount: number;
  penaltyAmount: number;
  totalAmount: number;
  workedHours: number;
  requiredHours: number;
  overtimeHours: number;
  violationDays: number;
  lateDays: number;
  lateThresholdTriggered: boolean;
  currency: string;
  calculatedAt: number;
};

const GET_SALARY_HISTORY = `
  query GetSalaryHistory($userId: ID, $monthsBack: Int) {
    getSalaryHistory(input: { userId: $userId, monthsBack: $monthsBack }) {
      userId
      year
      month
      baseAmount
      overtimeAmount
      penaltyAmount
      totalAmount
      workedHours
      requiredHours
      overtimeHours
      violationDays
      lateDays
      lateThresholdTriggered
      currency
      calculatedAt
    }
  }
`;

// userId omitted means "my own". Never includes the current in-progress
// month -- use atraceCalculateSalary for a live/projected figure.
export async function atraceGetSalaryHistory(
  monthsBack: number = 6,
  userId?: string,
  nsSlug?: string
): Promise<AtraceSalaryHistoryEntry[]> {
  const namespace = resolveNsSlug(nsSlug);
  return atraceRequestWithRefresh(async () => {
    const response = await atraceClient.request<{ getSalaryHistory: AtraceSalaryHistoryEntry[] }>(
      GET_SALARY_HISTORY,
      { userId: userId ?? null, monthsBack },
      { headers: await headers(namespace) }
    );
    return response.getSalaryHistory;
  }, namespace);
}
