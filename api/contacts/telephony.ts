import { crmRequest } from './crmRequest';

export type CallDirection = 'IN' | 'OUT';
export type CallStatus = 'ACCEPTED' | 'MISSED' | 'BUSY' | 'CANCELLED' | 'NOT_AVAILABLE' | 'NOT_ALLOWED' | 'NOT_FOUND';

export interface Call {
  id: string;
  provider: string;
  providerCallId: string;
  direction?: CallDirection | null;
  clientPhone: string;
  lineNumber: string;
  extension: string;
  operatorUserId?: string | null;
  status?: CallStatus | null;
  inProgress: boolean;
  startedAt: string;
  durationSec: number;
  clientId?: string | null;
  clientName?: string | null;
  recordingRef?: string | null;
  source?: string | null;
  operatorRating: number;
  clientRating: number;
  favourite: boolean;
  commentTemplateId?: string | null;
  comment: string;
  callbackDone: boolean;
  firstFromNumber: boolean;
  orderIds: string[];
}

export interface CallList {
  rows: Call[];
  info: { count: number };
  minDurationSec: number;
  avgDurationSec: number;
  maxDurationSec: number;
  totalDurationSec: number;
}

export interface CallFilter {
  clientId?: string;
  orderId?: string;
  search?: string;
  direction?: CallDirection;
  statuses?: CallStatus[];
  operatorUserId?: string;
  from?: string;
  to?: string;
  favouritesOnly?: boolean;
  pagination?: { page?: number; length?: string };
}

export interface CallCardEvent {
  eventType: string;
  call: Call;
  clientName?: string | null;
  clientKnown: boolean;
}

export interface TelephonyAdapter {
  code: string;
  title: string;
  canMakeCall: boolean;
  canProvideRecording: boolean;
  canAnswerContactQuery: boolean;
}

export interface TelephonyProviderConfig {
  provider: string;
  enabled: boolean;
  hasApiKey: boolean;
  apiKeyHint: string;
  hasApiSecret: boolean;
  apiSecretHint: string;
  webhookToken: string;
  baseUrl: string;
  extraJson: string;
  updatedAt: string;
}

export interface CallOperator { id: string; provider: string; extension: string; userId: string }
export interface CallCommentTemplate { id: string; text: string }

export interface CallStats {
  total: number; incoming: number; outgoing: number; missed: number; missedUnreturned: number; callbacksDone: number;
  minDurationSec: number; avgDurationSec: number; maxDurationSec: number;
  byOperator: Array<{ operatorUserId: string; acceptedIn: number; outgoing: number; talkSeconds: number }>;
  byDay: Array<{ day: string; total: number; missed: number }>;
  byLine: Array<{ lineNumber: string; source: string; total: number }>;
}

export const CALL_FIELDS = `
  id provider providerCallId direction clientPhone lineNumber extension operatorUserId status inProgress
  startedAt durationSec clientId clientName recordingRef source operatorRating clientRating favourite
  commentTemplateId comment callbackDone firstFromNumber orderIds
`;
const LIST_FIELDS = `rows { ${CALL_FIELDS} } info { count } minDurationSec avgDurationSec maxDurationSec totalDurationSec`;

export async function listCalls(token: string, ns: string, filter: CallFilter = {}) {
  const data = await crmRequest<{ calls: CallList }>(
    token, ns, `query Calls($filter: CallFilterInput) { calls(filter: $filter) { ${LIST_FIELDS} } }`, { filter },
  );
  return data.calls;
}

export async function getCall(token: string, ns: string, id: string) {
  const data = await crmRequest<{ call: Call }>(token, ns, `query Call($id: ID!) { call(id: $id) { ${CALL_FIELDS} } }`, { id });
  return data.call;
}

export async function listMissedCallbacks(token: string, ns: string, page = 1) {
  const data = await crmRequest<{ missedCallbacks: CallList }>(
    token, ns,
    `query Missed($p: DefaultFilterPaginationInput) { missedCallbacks(pagination: $p) { ${LIST_FIELDS} } }`,
    { p: { page, length: 'FIFTY' } },
  );
  return data.missedCallbacks;
}

export async function getCallStats(token: string, ns: string, from?: string, to?: string) {
  const data = await crmRequest<{ callStats: CallStats }>(
    token, ns,
    `query CallStats($from: String, $to: String) {
      callStats(from: $from, to: $to) {
        total incoming outgoing missed missedUnreturned callbacksDone minDurationSec avgDurationSec maxDurationSec
        byOperator { operatorUserId acceptedIn outgoing talkSeconds }
        byDay { day total missed }
        byLine { lineNumber source total }
      }
    }`,
    { from, to },
  );
  return data.callStats;
}

export async function updateCall(
  token: string, ns: string,
  input: { id: string; comment?: string; commentTemplateId?: string; operatorRating?: number; favourite?: boolean },
) {
  const data = await crmRequest<{ updateCall: Call }>(
    token, ns, `mutation UpdateCall($input: UpdateCallInput!) { updateCall(input: $input) { ${CALL_FIELDS} } }`, { input },
  );
  return data.updateCall;
}

export async function markCallbackDone(token: string, ns: string, callId: string) {
  await crmRequest(token, ns, `mutation Done($id: ID!) { markCallbackDone(callId: $id) { id } }`, { id: callId });
}

export async function makeCall(token: string, ns: string, phone: string, clientId?: string) {
  const data = await crmRequest<{ makeCall: { supported: boolean; providerCallId?: string; call?: Call } }>(
    token, ns,
    `mutation MakeCall($phone: String!, $clientId: ID) { makeCall(phone: $phone, clientId: $clientId) { supported providerCallId call { ${CALL_FIELDS} } } }`,
    { phone, clientId },
  );
  return data.makeCall;
}

export async function linkCallToOrder(token: string, ns: string, callId: string, orderId: string) {
  await crmRequest(token, ns, `mutation L($c: ID!, $o: ID!) { linkCallToOrder(callId: $c, orderId: $o) { id } }`, { c: callId, o: orderId });
}

export async function unlinkCall(token: string, ns: string, callId: string, orderId?: string) {
  await crmRequest(token, ns, `mutation U($c: ID!, $o: ID) { unlinkCall(callId: $c, orderId: $o) { id } }`, { c: callId, o: orderId });
}

export async function listCommentTemplates(token: string, ns: string) {
  const data = await crmRequest<{ callCommentTemplates: CallCommentTemplate[] }>(
    token, ns, `query T { callCommentTemplates { id text } }`,
  );
  return data.callCommentTemplates;
}

export async function createCommentTemplate(token: string, ns: string, text: string) {
  const data = await crmRequest<{ createCallCommentTemplate: CallCommentTemplate }>(
    token, ns, `mutation C($text: String!) { createCallCommentTemplate(text: $text) { id text } }`, { text },
  );
  return data.createCallCommentTemplate;
}

export async function deleteCommentTemplate(token: string, ns: string, id: string) {
  await crmRequest(token, ns, `mutation D($id: ID!) { deleteCallCommentTemplate(id: $id) }`, { id });
}

export async function getTelephonySettings(token: string, ns: string) {
  const data = await crmRequest<{ telephonySettings: { adapters: TelephonyAdapter[]; configs: TelephonyProviderConfig[] } }>(
    token, ns,
    `query TelephonySettings {
      telephonySettings {
        adapters { code title canMakeCall canProvideRecording canAnswerContactQuery }
        configs { provider enabled hasApiKey apiKeyHint hasApiSecret apiSecretHint webhookToken baseUrl extraJson updatedAt }
      }
    }`,
  );
  return data.telephonySettings;
}

export async function saveTelephonyProvider(
  token: string, ns: string,
  input: { provider: string; enabled: boolean; apiKey?: string; apiSecret?: string; baseUrl?: string; extraJson?: string; rotateToken?: boolean },
) {
  const data = await crmRequest<{ saveTelephonyProvider: TelephonyProviderConfig }>(
    token, ns,
    `mutation Save($input: SaveTelephonyProviderInput!) {
      saveTelephonyProvider(input: $input) { provider enabled hasApiKey apiKeyHint hasApiSecret apiSecretHint webhookToken baseUrl extraJson updatedAt }
    }`,
    { input },
  );
  return data.saveTelephonyProvider;
}

export async function listCallOperators(token: string, ns: string) {
  const data = await crmRequest<{ callOperators: CallOperator[] }>(token, ns, `query Ops { callOperators { id provider extension userId } }`);
  return data.callOperators;
}

export async function upsertCallOperator(token: string, ns: string, provider: string, extension: string, userId: string) {
  const data = await crmRequest<{ upsertCallOperator: CallOperator }>(
    token, ns,
    `mutation Op($p: String!, $e: String!, $u: ID!) { upsertCallOperator(provider: $p, extension: $e, userId: $u) { id provider extension userId } }`,
    { p: provider, e: extension, u: userId },
  );
  return data.upsertCallOperator;
}

export async function deleteCallOperator(token: string, ns: string, id: string) {
  await crmRequest(token, ns, `mutation DelOp($id: ID!) { deleteCallOperator(id: $id) }`, { id });
}

/** Public URL the provider must call; the token is the tenant's webhook secret. */
export function webhookUrl(origin: string, provider: string, namespace: string, token: string): string {
  return `${origin}/api-contacts/webhooks/telephony/${provider}/${namespace}/${token}`;
}

export function statusKey(c: Pick<Call, 'status' | 'inProgress'>): string {
  if (c.inProgress && !c.status) return 'IN_PROGRESS';
  return c.status || 'UNKNOWN';
}
