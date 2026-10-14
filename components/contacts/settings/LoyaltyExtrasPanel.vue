<script lang="ts" setup>
// Tiers, promotions, automatic rules and milestones (birthdays, anniversaries) of the loyalty programme.
// One small CRUD surface per section; the forms keep to the plain fields, the JSON ones are filled from presets.
import AppSkeleton from '@/components/ui/AppSkeleton.vue';
import ColorSwatch from '@/components/ui/ColorSwatch.vue';
import { atModalUi, atCardUiFit } from '@/utils/atraceUi';
import { useI18n } from '@/composables/useI18n';
import { useAuth } from '@/composables/useAuth';
import { useContactsToken } from '@/composables/useContactsToken';
import { useConfirm } from '@/composables/useConfirm';
import { logError } from '@/utils/logger';
import { getErrorMessage } from '@/utils/types/errors';
import * as api from '@/api/contacts/loyaltyExtras';

type Section = 'tiers' | 'promotions' | 'rules' | 'milestones';

const { t } = useI18n();
const route = useRoute();
const toast = useToast();
const { token: hubToken } = useAuth();
const { ensure } = useContactsToken();
const { confirm } = useConfirm();
const nsSlug = computed(() => route.params.namespace as string);

const section = ref<Section>('tiers');
const SECTIONS: Array<{ key: Section; icon: string }> = [
  { key: 'tiers', icon: 'lucide:medal' },
  { key: 'promotions', icon: 'lucide:badge-percent' },
  { key: 'rules', icon: 'lucide:workflow' },
  { key: 'milestones', icon: 'lucide:cake' },
];

const loading = ref(true);
const saving = ref(false);
const tiers = ref<api.LoyaltyTier[]>([]);
const promotions = ref<api.LoyaltyPromotion[]>([]);
const rules = ref<api.LoyaltyRule[]>([]);
const templates = ref<api.MilestoneTemplate[]>([]);
const upcoming = ref<api.UpcomingMilestone[]>([]);

async function token(): Promise<string> {
  const tk = hubToken.value && nsSlug.value ? await ensure(nsSlug.value, hubToken.value) : null;
  if (!tk) throw new Error('No contacts token');
  return tk;
}

async function loadAll() {
  loading.value = true;
  try {
    const tk = await token();
    const [a, b, c, d, e] = await Promise.all([
      api.listTiers(tk), api.listPromotions(tk), api.listRules(tk), api.listMilestoneTemplates(tk), api.upcomingMilestones(tk, 30),
    ]);
    tiers.value = a; promotions.value = b; rules.value = c; templates.value = d; upcoming.value = e;
  } catch (e) {
    logError('[contacts/loyaltyExtras] load failed', e);
    toast.add({ title: getErrorMessage(e, t) || t('common.error'), color: 'red' });
  } finally {
    loading.value = false;
  }
}
onMounted(loadAll);

async function guarded(fn: () => Promise<unknown>, okKey?: string) {
  saving.value = true;
  try {
    await fn();
    if (okKey) toast.add({ title: t(okKey), color: 'primary' });
    await loadAll();
    return true;
  } catch (e) {
    logError('[contacts/loyaltyExtras] action failed', e);
    toast.add({ title: getErrorMessage(e, t) || t('common.error'), color: 'red' });
    return false;
  } finally {
    saving.value = false;
  }
}

async function askDelete(message: string, fn: () => Promise<unknown>) {
  if (await confirm({ message, confirmLabel: t('common.delete'), icon: 'lucide:trash-2' })) await guarded(fn);
}

const dateInput = (iso?: string | null) => (iso ? iso.slice(0, 10) : '');
const dateOut = (v: string) => (v ? v : null);

// ---------- tiers ----------
const CRITERIA: Array<{ value: api.TierCriteria; key: string }> = [
  { value: 'TIER_QUALIFICATION_BONUS_EARNED', key: 'loyaltyExtras.critBonus' },
  { value: 'TIER_QUALIFICATION_TOTAL_SPENT', key: 'loyaltyExtras.critSpent' },
  { value: 'TIER_QUALIFICATION_VISIT_COUNT', key: 'loyaltyExtras.critVisits' },
  { value: 'TIER_QUALIFICATION_MANUAL', key: 'loyaltyExtras.critManual' },
];
const criteriaLabel = (c: string) => t(CRITERIA.find((x) => x.value === c)?.key || 'loyaltyExtras.critManual');

const tierOpen = ref(false);
const tierForm = reactive({ id: '', name: '', description: '', level: 0, criteria: 'TIER_QUALIFICATION_BONUS_EARNED' as api.TierCriteria, threshold: 0, multiplier: 1, color: '#3B82F6', active: true });
function openTier(x?: api.LoyaltyTier) {
  Object.assign(tierForm, x
    ? { id: x.id, name: x.name, description: x.description, level: x.level, criteria: x.qualificationCriteria, threshold: x.qualificationThreshold, multiplier: x.bonusMultiplier, color: x.colorHex || '#3B82F6', active: x.status === 'TIER_STATUS_ACTIVE' }
    : { id: '', name: '', description: '', level: tiers.value.length, criteria: 'TIER_QUALIFICATION_BONUS_EARNED', threshold: 0, multiplier: 1, color: '#3B82F6', active: true });
  tierOpen.value = true;
}
async function saveTier() {
  if (!tierForm.name.trim()) return;
  const ok = await guarded(async () => {
    const tk = await token();
    const status: api.TierStatus = tierForm.active ? 'TIER_STATUS_ACTIVE' : 'TIER_STATUS_INACTIVE';
    if (tierForm.id) {
      await api.updateTier(tk, { id: tierForm.id, name: tierForm.name.trim(), description: tierForm.description, status, qualificationThreshold: Number(tierForm.threshold), bonusMultiplier: Number(tierForm.multiplier), colorHex: tierForm.color });
    } else {
      await api.createTier(tk, { name: tierForm.name.trim(), description: tierForm.description, level: Number(tierForm.level), status, qualificationCriteria: tierForm.criteria, qualificationThreshold: Number(tierForm.threshold), bonusMultiplier: Number(tierForm.multiplier), benefitsJson: '{}', colorHex: tierForm.color });
    }
  }, 'loyaltyExtras.saved');
  if (ok) tierOpen.value = false;
}
async function recalc() {
  await guarded(async () => {
    const n = await api.recalculateTiers(await token());
    toast.add({ title: t('loyaltyExtras.recalculated', { n }), color: 'primary' });
  });
}

// ---------- promotions ----------
const PROMO_TYPES: api.PromotionType[] = ['BONUS_MULTIPLIER', 'FIXED_BONUS', 'CASHBACK', 'DISCOUNT', 'FREE_STAMPS', 'CUSTOM'];
const PROMO_STATUS_COLOR: Record<string, string> = { DRAFT: 'gray', ACTIVE: 'green', PAUSED: 'amber', EXPIRED: 'red', ARCHIVED: 'gray' };
const promoOpen = ref(false);
const promoForm = reactive({ id: '', name: '', description: '', type: 'BONUS_MULTIPLIER' as api.PromotionType, target: 'ALL_CLIENTS' as api.PromotionTarget, targetId: '', value: 2, perClient: 0, total: 0, from: '', until: '' });
function openPromo(x?: api.LoyaltyPromotion) {
  Object.assign(promoForm, x
    ? { id: x.id, name: x.name, description: x.description || '', type: x.type, target: x.targetType, targetId: x.targetId || '', value: x.value, perClient: x.usageLimitPerClient, total: x.totalUsageLimit, from: dateInput(x.validFrom), until: dateInput(x.validUntil) }
    : { id: '', name: '', description: '', type: 'BONUS_MULTIPLIER', target: 'ALL_CLIENTS', targetId: '', value: 2, perClient: 0, total: 0, from: '', until: '' });
  promoOpen.value = true;
}
async function savePromo() {
  if (!promoForm.name.trim()) return;
  const ok = await guarded(async () => {
    const tk = await token();
    if (promoForm.id) {
      await api.updatePromotion(tk, { id: promoForm.id, name: promoForm.name.trim(), description: promoForm.description, value: Number(promoForm.value), usageLimitPerClient: Number(promoForm.perClient), totalUsageLimit: Number(promoForm.total), validUntil: dateOut(promoForm.until) });
    } else {
      await api.createPromotion(tk, {
        name: promoForm.name.trim(), description: promoForm.description, type: promoForm.type, status: 'DRAFT', targetType: promoForm.target,
        targetId: promoForm.target === 'ALL_CLIENTS' ? null : promoForm.targetId, value: Number(promoForm.value),
        usageLimitPerClient: Number(promoForm.perClient), totalUsageLimit: Number(promoForm.total), validFrom: dateOut(promoForm.from), validUntil: dateOut(promoForm.until), createdBy: '',
      });
    }
  }, 'loyaltyExtras.saved');
  if (ok) promoOpen.value = false;
}

// ---------- rules ----------
const RULE_TYPES: Array<{ value: api.RuleType; key: string }> = [
  { value: 'RULE_TYPE_BONUS_EARNING', key: 'loyaltyExtras.ruleBonus' },
  { value: 'RULE_TYPE_STAMP_EARNING', key: 'loyaltyExtras.ruleStamps' },
  { value: 'RULE_TYPE_MULTIPLIER', key: 'loyaltyExtras.ruleMultiplier' },
  { value: 'RULE_TYPE_TIER_UPGRADE', key: 'loyaltyExtras.ruleTier' },
];
const RULE_TRIGGERS: Array<{ value: api.RuleTrigger; key: string }> = [
  { value: 'RULE_TRIGGER_PURCHASE', key: 'loyaltyExtras.trigPurchase' },
  { value: 'RULE_TRIGGER_VISIT', key: 'loyaltyExtras.trigVisit' },
  { value: 'RULE_TRIGGER_BIRTHDAY', key: 'loyaltyExtras.trigBirthday' },
  { value: 'RULE_TRIGGER_REGISTRATION', key: 'loyaltyExtras.trigRegistration' },
  { value: 'RULE_TRIGGER_EVENT', key: 'loyaltyExtras.trigEvent' },
];
const labelOf = (list: Array<{ value: string; key: string }>, v: string) => t(list.find((x) => x.value === v)?.key || '');
const ruleOpen = ref(false);
const ruleForm = reactive({ id: '', name: '', type: 'RULE_TYPE_BONUS_EARNING' as api.RuleType, trigger: 'RULE_TRIGGER_PURCHASE' as api.RuleTrigger, priority: 0, active: true, minAmount: 0, points: 0, percent: 5, count: 1, multiplier: 2, tierId: '' });
function openRule(x?: api.LoyaltyRule) {
  if (x) {
    let c: Record<string, any> = {}; let a: Record<string, any> = {};
    try { c = JSON.parse(x.conditionsJson || '{}'); a = JSON.parse(x.actionsJson || '{}'); } catch { /* keep defaults */ }
    Object.assign(ruleForm, { id: x.id, name: x.name, type: x.type, trigger: x.trigger, priority: x.priority, active: x.status === 'RULE_STATUS_ACTIVE', minAmount: c.min_amount || 0, points: a.points || 0, percent: a.percent || 0, count: a.count || 1, multiplier: a.multiplier || 2, tierId: a.tier_id || '' });
  } else {
    Object.assign(ruleForm, { id: '', name: '', type: 'RULE_TYPE_BONUS_EARNING', trigger: 'RULE_TRIGGER_PURCHASE', priority: 0, active: true, minAmount: 0, points: 0, percent: 5, count: 1, multiplier: 2, tierId: '' });
  }
  ruleOpen.value = true;
}
function ruleJson() {
  const conditions: Record<string, number> = {};
  if (Number(ruleForm.minAmount) > 0) conditions.min_amount = Number(ruleForm.minAmount);
  const actions: Record<string, number | string> = {};
  if (ruleForm.type === 'RULE_TYPE_BONUS_EARNING') {
    if (Number(ruleForm.percent) > 0) actions.percent = Number(ruleForm.percent);
    else actions.points = Number(ruleForm.points);
  } else if (ruleForm.type === 'RULE_TYPE_STAMP_EARNING') actions.count = Number(ruleForm.count) || 1;
  else if (ruleForm.type === 'RULE_TYPE_MULTIPLIER') actions.multiplier = Number(ruleForm.multiplier);
  else if (ruleForm.tierId) actions.tier_id = ruleForm.tierId;
  return { conditionsJson: JSON.stringify(conditions), actionsJson: JSON.stringify(actions) };
}
async function saveRule() {
  if (!ruleForm.name.trim()) return;
  const ok = await guarded(async () => {
    const tk = await token();
    const status: api.RuleStatus = ruleForm.active ? 'RULE_STATUS_ACTIVE' : 'RULE_STATUS_INACTIVE';
    const js = ruleJson();
    if (ruleForm.id) await api.updateRule(tk, { id: ruleForm.id, name: ruleForm.name.trim(), status, priority: Number(ruleForm.priority), ...js });
    else await api.createRule(tk, { name: ruleForm.name.trim(), description: '', type: ruleForm.type, trigger: ruleForm.trigger, status, priority: Number(ruleForm.priority), ...js, createdBy: '' });
  }, 'loyaltyExtras.saved');
  if (ok) ruleOpen.value = false;
}
function ruleSummary(r: api.LoyaltyRule): string {
  try {
    const a = JSON.parse(r.actionsJson || '{}'); const c = JSON.parse(r.conditionsJson || '{}');
    const bits: string[] = [];
    if (c.min_amount) bits.push(`≥ ${c.min_amount}`);
    if (a.percent) bits.push(`${a.percent}%`);
    if (a.points) bits.push(`+${a.points}`);
    if (a.count && r.type === 'RULE_TYPE_STAMP_EARNING') bits.push(`+${a.count}`);
    if (a.multiplier) bits.push(`×${a.multiplier}`);
    return bits.join(' · ');
  } catch { return ''; }
}

// ---------- milestones ----------
const TPL_TYPES: Array<{ value: api.MilestoneType; key: string }> = [
  { value: 'MILESTONE_TYPE_BIRTHDAY', key: 'loyaltyExtras.mBirthday' },
  { value: 'MILESTONE_TYPE_ANNIVERSARY', key: 'loyaltyExtras.mAnniversary' },
  { value: 'MILESTONE_TYPE_CUSTOM_DATE', key: 'loyaltyExtras.mCustom' },
];
const tplOpen = ref(false);
const tplForm = reactive({ id: '', name: '', type: 'MILESTONE_TYPE_BIRTHDAY' as api.MilestoneType, fieldKey: '', before: 3, after: 3, bonus: 0, message: '', active: true });
function openTpl(x?: api.MilestoneTemplate) {
  if (x) {
    let bonus = 0; try { bonus = JSON.parse(x.rewardActionsJson || '{}').bonus_points || 0; } catch { /* none */ }
    Object.assign(tplForm, { id: x.id, name: x.name, type: x.type, fieldKey: x.dynamicFieldKey || '', before: x.daysBeforeNotification, after: x.daysAfterCelebration, bonus, message: x.messageTemplate || '', active: x.status === 'MILESTONE_STATUS_ACTIVE' });
  } else {
    Object.assign(tplForm, { id: '', name: '', type: 'MILESTONE_TYPE_BIRTHDAY', fieldKey: '', before: 3, after: 3, bonus: 0, message: '', active: true });
  }
  tplOpen.value = true;
}
async function saveTpl() {
  if (!tplForm.name.trim() || (tplForm.type !== 'MILESTONE_TYPE_BIRTHDAY' && !tplForm.fieldKey.trim())) return;
  const ok = await guarded(async () => {
    const tk = await token();
    const status: api.MilestoneStatus = tplForm.active ? 'MILESTONE_STATUS_ACTIVE' : 'MILESTONE_STATUS_INACTIVE';
    const reward = JSON.stringify(Number(tplForm.bonus) > 0 ? { bonus_points: Number(tplForm.bonus) } : {});
    if (tplForm.id) await api.updateMilestoneTemplate(tk, { id: tplForm.id, name: tplForm.name.trim(), status, daysBeforeNotification: Number(tplForm.before), daysAfterCelebration: Number(tplForm.after), rewardActionsJson: reward, messageTemplate: tplForm.message });
    else await api.createMilestoneTemplate(tk, { name: tplForm.name.trim(), type: tplForm.type, status, dynamicFieldKey: tplForm.fieldKey.trim() || null, daysBeforeNotification: Number(tplForm.before), daysAfterCelebration: Number(tplForm.after), rewardActionsJson: reward, messageTemplate: tplForm.message, createdBy: '' });
  }, 'loyaltyExtras.saved');
  if (ok) tplOpen.value = false;
}
async function syncMilestones() {
  await guarded(async () => api.syncMilestones(await token()), 'loyaltyExtras.synced');
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center gap-2">
      <button v-for="s in SECTIONS" :key="s.key" type="button" class="pill-filter" :class="section === s.key ? 'pill-filter--active' : ''" @click="section = s.key">
        <UIcon :name="s.icon" class="h-4 w-4" />{{ t(`loyaltyExtras.section_${s.key}`) }}
      </button>
    </div>

    <AppSkeleton v-if="loading" variant="panel" :rows="3" />

    <!-- tiers -->
    <section v-else-if="section === 'tiers'" class="at-panel space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div><h3 class="font-semibold">{{ t('loyaltyExtras.section_tiers') }}</h3><p class="at-hint !mt-0.5">{{ t('loyaltyExtras.tiersHint') }}</p></div>
        <div class="flex gap-2">
          <button type="button" class="at-btn !px-3 !py-1.5" :disabled="saving || !tiers.length" @click="recalc"><UIcon name="lucide:refresh-cw" class="h-4 w-4" />{{ t('loyaltyExtras.recalculate') }}</button>
          <button type="button" class="at-btn !px-3 !py-1.5" @click="openTier()"><UIcon name="lucide:plus" class="h-4 w-4" />{{ t('common.add') }}</button>
        </div>
      </div>
      <p v-if="!tiers.length" class="text-sm text-gray-400">{{ t('loyaltyExtras.noTiers') }}</p>
      <div v-for="x in tiers" :key="x.id" class="at-row !py-3 flex items-center gap-3">
        <span class="h-8 w-8 flex-shrink-0 rounded-full" :style="{ background: x.colorHex || '#3B82F6' }" />
        <div class="min-w-0 flex-1">
          <div class="truncate font-semibold">{{ x.name }} <span class="text-xs font-normal text-gray-400">· {{ t('loyaltyExtras.level') }} {{ x.level }}</span></div>
          <div class="text-xs text-slate-500">{{ criteriaLabel(x.qualificationCriteria) }}<template v-if="x.qualificationCriteria !== 'TIER_QUALIFICATION_MANUAL'"> ≥ {{ x.qualificationThreshold }}</template> · ×{{ x.bonusMultiplier }}</div>
        </div>
        <UBadge v-if="x.status !== 'TIER_STATUS_ACTIVE'" color="gray" variant="soft" size="xs">{{ t('common.inactive') }}</UBadge>
        <button type="button" class="text-gray-400 hover:text-primary-600" :aria-label="t('common.edit')" @click="openTier(x)"><UIcon name="lucide:pencil" class="h-4 w-4" /></button>
        <button type="button" class="text-gray-400 hover:text-red-500" :aria-label="t('common.delete')" @click="askDelete(t('loyaltyExtras.deleteTier'), async () => api.deleteTier(await token(), x.id))"><UIcon name="lucide:trash-2" class="h-4 w-4" /></button>
      </div>
    </section>

    <!-- promotions -->
    <section v-else-if="section === 'promotions'" class="at-panel space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div><h3 class="font-semibold">{{ t('loyaltyExtras.section_promotions') }}</h3><p class="at-hint !mt-0.5">{{ t('loyaltyExtras.promotionsHint') }}</p></div>
        <button type="button" class="at-btn !px-3 !py-1.5" @click="openPromo()"><UIcon name="lucide:plus" class="h-4 w-4" />{{ t('common.add') }}</button>
      </div>
      <p v-if="!promotions.length" class="text-sm text-gray-400">{{ t('loyaltyExtras.noPromotions') }}</p>
      <div v-for="x in promotions" :key="x.id" class="at-row !py-3 flex items-center gap-3">
        <div class="min-w-0 flex-1">
          <div class="truncate font-semibold">{{ x.name }}</div>
          <div class="text-xs text-slate-500">{{ t(`loyaltyExtras.ptype_${x.type}`) }} · {{ x.value }} · {{ t(`loyaltyExtras.target_${x.targetType}`) }}<template v-if="x.totalUsageLimit"> · {{ x.currentUsageCount }}/{{ x.totalUsageLimit }}</template><template v-if="x.validUntil"> · {{ dateInput(x.validUntil) }}</template></div>
        </div>
        <UBadge :color="(PROMO_STATUS_COLOR[x.status] as any)" variant="soft" size="xs">{{ t(`loyaltyExtras.pstatus_${x.status}`) }}</UBadge>
        <button v-if="x.status !== 'ACTIVE' && x.status !== 'ARCHIVED' && x.status !== 'EXPIRED'" type="button" class="text-gray-400 hover:text-green-600" :title="t('loyaltyExtras.activate')" @click="guarded(async () => api.setPromotionActive(await token(), x.id, true))"><UIcon name="lucide:play" class="h-4 w-4" /></button>
        <button v-if="x.status === 'ACTIVE'" type="button" class="text-gray-400 hover:text-amber-600" :title="t('loyaltyExtras.pause')" @click="guarded(async () => api.setPromotionActive(await token(), x.id, false))"><UIcon name="lucide:pause" class="h-4 w-4" /></button>
        <button type="button" class="text-gray-400 hover:text-primary-600" :aria-label="t('common.edit')" @click="openPromo(x)"><UIcon name="lucide:pencil" class="h-4 w-4" /></button>
        <button type="button" class="text-gray-400 hover:text-red-500" :aria-label="t('common.delete')" @click="askDelete(t('loyaltyExtras.deletePromotion'), async () => api.deletePromotion(await token(), x.id))"><UIcon name="lucide:trash-2" class="h-4 w-4" /></button>
      </div>
    </section>

    <!-- rules -->
    <section v-else-if="section === 'rules'" class="at-panel space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div><h3 class="font-semibold">{{ t('loyaltyExtras.section_rules') }}</h3><p class="at-hint !mt-0.5">{{ t('loyaltyExtras.rulesHint') }}</p></div>
        <button type="button" class="at-btn !px-3 !py-1.5" @click="openRule()"><UIcon name="lucide:plus" class="h-4 w-4" />{{ t('common.add') }}</button>
      </div>
      <p v-if="!rules.length" class="text-sm text-gray-400">{{ t('loyaltyExtras.noRules') }}</p>
      <div v-for="x in rules" :key="x.id" class="at-row !py-3 flex items-center gap-3">
        <div class="min-w-0 flex-1">
          <div class="truncate font-semibold">{{ x.name }}</div>
          <div class="text-xs text-slate-500">{{ labelOf(RULE_TRIGGERS, x.trigger) }} → {{ labelOf(RULE_TYPES, x.type) }} <template v-if="ruleSummary(x)">({{ ruleSummary(x) }})</template> · {{ t('loyaltyExtras.priority') }} {{ x.priority }}</div>
        </div>
        <UBadge :color="x.status === 'RULE_STATUS_ACTIVE' ? 'green' : 'gray'" variant="soft" size="xs">{{ x.status === 'RULE_STATUS_ACTIVE' ? t('loyaltyExtras.on') : t('loyaltyExtras.off') }}</UBadge>
        <button type="button" class="text-gray-400 hover:text-primary-600" :aria-label="t('common.edit')" @click="openRule(x)"><UIcon name="lucide:pencil" class="h-4 w-4" /></button>
        <button type="button" class="text-gray-400 hover:text-red-500" :aria-label="t('common.delete')" @click="askDelete(t('loyaltyExtras.deleteRule'), async () => api.deleteRule(await token(), x.id))"><UIcon name="lucide:trash-2" class="h-4 w-4" /></button>
      </div>
    </section>

    <!-- milestones -->
    <section v-else class="space-y-4">
      <div class="at-panel space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div><h3 class="font-semibold">{{ t('loyaltyExtras.section_milestones') }}</h3><p class="at-hint !mt-0.5">{{ t('loyaltyExtras.milestonesHint') }}</p></div>
          <div class="flex gap-2">
            <button type="button" class="at-btn !px-3 !py-1.5" :disabled="saving || !templates.length" @click="syncMilestones"><UIcon name="lucide:refresh-cw" class="h-4 w-4" />{{ t('loyaltyExtras.sync') }}</button>
            <button type="button" class="at-btn !px-3 !py-1.5" @click="openTpl()"><UIcon name="lucide:plus" class="h-4 w-4" />{{ t('common.add') }}</button>
          </div>
        </div>
        <p v-if="!templates.length" class="text-sm text-gray-400">{{ t('loyaltyExtras.noTemplates') }}</p>
        <div v-for="x in templates" :key="x.id" class="at-row !py-3 flex items-center gap-3">
          <div class="min-w-0 flex-1">
            <div class="truncate font-semibold">{{ x.name }}</div>
            <div class="text-xs text-slate-500">{{ labelOf(TPL_TYPES, x.type) }}<template v-if="x.dynamicFieldKey"> · {{ x.dynamicFieldKey }}</template> · {{ t('loyaltyExtras.remindDays', { n: x.daysBeforeNotification }) }}</div>
          </div>
          <UBadge v-if="x.status !== 'MILESTONE_STATUS_ACTIVE'" color="gray" variant="soft" size="xs">{{ t('common.inactive') }}</UBadge>
          <button type="button" class="text-gray-400 hover:text-primary-600" :aria-label="t('common.edit')" @click="openTpl(x)"><UIcon name="lucide:pencil" class="h-4 w-4" /></button>
          <button type="button" class="text-gray-400 hover:text-red-500" :aria-label="t('common.delete')" @click="askDelete(t('loyaltyExtras.deleteTemplate'), async () => api.deleteMilestoneTemplate(await token(), x.id))"><UIcon name="lucide:trash-2" class="h-4 w-4" /></button>
        </div>
      </div>
      <div class="at-panel space-y-2">
        <h3 class="font-semibold">{{ t('loyaltyExtras.upcoming') }}</h3>
        <p v-if="!upcoming.length" class="text-sm text-gray-400">{{ t('loyaltyExtras.noUpcoming') }}</p>
        <NuxtLink v-for="m in upcoming" :key="m.id" :to="`/${nsSlug}/contacts/${m.clientId}`" class="at-row !py-2.5 flex items-center justify-between gap-3 hover:text-primary-600">
          <span class="truncate">{{ m.milestoneName }}<span v-if="m.yearsCount" class="text-xs text-gray-400"> · {{ m.yearsCount }}</span></span>
          <span class="flex-shrink-0 text-xs tabular-nums text-gray-500">{{ m.nextOccurrence }}</span>
        </NuxtLink>
      </div>
    </section>

    <!-- tier form -->
    <UModal v-model="tierOpen" class="at-modal" :ui="atModalUi">
      <UCard :ui="atCardUiFit">
        <template #header><h3 class="font-semibold">{{ tierForm.id ? t('common.edit') : t('common.add') }}: {{ t('loyaltyExtras.tier') }}</h3></template>
        <div class="space-y-3">
          <UFormGroup :label="t('common.name')" required><UInput v-model="tierForm.name" /></UFormGroup>
          <UFormGroup :label="t('loyaltyExtras.description')"><UInput v-model="tierForm.description" /></UFormGroup>
          <div class="grid grid-cols-2 gap-3">
            <UFormGroup v-if="!tierForm.id" :label="t('loyaltyExtras.level')"><UInput v-model.number="tierForm.level" type="number" min="0" /></UFormGroup>
            <UFormGroup :label="t('loyaltyExtras.multiplier')"><UInput v-model.number="tierForm.multiplier" type="number" min="0.1" step="0.1" /></UFormGroup>
          </div>
          <UFormGroup v-if="!tierForm.id" :label="t('loyaltyExtras.criteria')">
            <USelectMenu v-model="tierForm.criteria" :options="CRITERIA.map((c) => ({ label: t(c.key), value: c.value }))" value-attribute="value" option-attribute="label" :popper="{ strategy: 'fixed' }" />
          </UFormGroup>
          <UFormGroup v-if="tierForm.criteria !== 'TIER_QUALIFICATION_MANUAL'" :label="t('loyaltyExtras.threshold')"><UInput v-model.number="tierForm.threshold" type="number" min="0" /></UFormGroup>
          <UFormGroup :label="t('loyaltyExtras.color')"><ColorSwatch v-model="tierForm.color" /></UFormGroup>
          <label class="flex items-center gap-2 text-sm"><UToggle v-model="tierForm.active" size="sm" />{{ t('loyaltyExtras.active') }}</label>
        </div>
        <template #footer><div class="flex justify-end gap-2"><UButton color="gray" variant="ghost" @click="tierOpen = false">{{ t('common.cancel') }}</UButton><UButton color="primary" :loading="saving" :disabled="!tierForm.name.trim()" @click="saveTier">{{ t('common.save') }}</UButton></div></template>
      </UCard>
    </UModal>

    <!-- promotion form -->
    <UModal v-model="promoOpen" class="at-modal" :ui="atModalUi">
      <UCard :ui="atCardUiFit">
        <template #header><h3 class="font-semibold">{{ promoForm.id ? t('common.edit') : t('common.add') }}: {{ t('loyaltyExtras.promotion') }}</h3></template>
        <div class="space-y-3">
          <UFormGroup :label="t('common.name')" required><UInput v-model="promoForm.name" /></UFormGroup>
          <UFormGroup :label="t('loyaltyExtras.description')"><UInput v-model="promoForm.description" /></UFormGroup>
          <div v-if="!promoForm.id" class="grid grid-cols-2 gap-3">
            <UFormGroup :label="t('loyaltyExtras.type')"><USelectMenu v-model="promoForm.type" :options="PROMO_TYPES.map((v) => ({ label: t(`loyaltyExtras.ptype_${v}`), value: v }))" value-attribute="value" option-attribute="label" :popper="{ strategy: 'fixed' }" /></UFormGroup>
            <UFormGroup :label="t('loyaltyExtras.audience')"><USelectMenu v-model="promoForm.target" :options="(['ALL_CLIENTS', 'TIER', 'INDIVIDUAL'] as const).map((v) => ({ label: t(`loyaltyExtras.target_${v}`), value: v }))" value-attribute="value" option-attribute="label" :popper="{ strategy: 'fixed' }" /></UFormGroup>
          </div>
          <UFormGroup v-if="!promoForm.id && promoForm.target === 'TIER'" :label="t('loyaltyExtras.tier')"><USelectMenu v-model="promoForm.targetId" :options="tiers.map((x) => ({ label: x.name, value: x.id }))" value-attribute="value" option-attribute="label" :popper="{ strategy: 'fixed' }" /></UFormGroup>
          <UFormGroup v-if="!promoForm.id && promoForm.target === 'INDIVIDUAL'" :label="t('loyaltyExtras.clientId')"><UInput v-model="promoForm.targetId" /></UFormGroup>
          <UFormGroup :label="t('loyaltyExtras.value')"><UInput v-model.number="promoForm.value" type="number" min="0" step="0.1" /></UFormGroup>
          <div class="grid grid-cols-2 gap-3">
            <UFormGroup :label="t('loyaltyExtras.perClient')" :hint="t('loyaltyExtras.zeroUnlimited')"><UInput v-model.number="promoForm.perClient" type="number" min="0" /></UFormGroup>
            <UFormGroup :label="t('loyaltyExtras.totalLimit')" :hint="t('loyaltyExtras.zeroUnlimited')"><UInput v-model.number="promoForm.total" type="number" min="0" /></UFormGroup>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <UFormGroup v-if="!promoForm.id" :label="t('loyaltyExtras.from')"><UInput v-model="promoForm.from" type="date" /></UFormGroup>
            <UFormGroup :label="t('loyaltyExtras.until')"><UInput v-model="promoForm.until" type="date" /></UFormGroup>
          </div>
        </div>
        <template #footer><div class="flex justify-end gap-2"><UButton color="gray" variant="ghost" @click="promoOpen = false">{{ t('common.cancel') }}</UButton><UButton color="primary" :loading="saving" :disabled="!promoForm.name.trim() || (promoForm.target !== 'ALL_CLIENTS' && !promoForm.id && !promoForm.targetId)" @click="savePromo">{{ t('common.save') }}</UButton></div></template>
      </UCard>
    </UModal>

    <!-- rule form -->
    <UModal v-model="ruleOpen" class="at-modal" :ui="atModalUi">
      <UCard :ui="atCardUiFit">
        <template #header><h3 class="font-semibold">{{ ruleForm.id ? t('common.edit') : t('common.add') }}: {{ t('loyaltyExtras.rule') }}</h3></template>
        <div class="space-y-3">
          <UFormGroup :label="t('common.name')" required><UInput v-model="ruleForm.name" /></UFormGroup>
          <div v-if="!ruleForm.id" class="grid grid-cols-2 gap-3">
            <UFormGroup :label="t('loyaltyExtras.trigger')"><USelectMenu v-model="ruleForm.trigger" :options="RULE_TRIGGERS.map((c) => ({ label: t(c.key), value: c.value }))" value-attribute="value" option-attribute="label" :popper="{ strategy: 'fixed' }" /></UFormGroup>
            <UFormGroup :label="t('loyaltyExtras.action')"><USelectMenu v-model="ruleForm.type" :options="RULE_TYPES.map((c) => ({ label: t(c.key), value: c.value }))" value-attribute="value" option-attribute="label" :popper="{ strategy: 'fixed' }" /></UFormGroup>
          </div>
          <UFormGroup v-if="ruleForm.trigger === 'RULE_TRIGGER_PURCHASE'" :label="t('loyaltyExtras.minAmount')" :hint="t('loyaltyExtras.zeroNoMin')"><UInput v-model.number="ruleForm.minAmount" type="number" min="0" /></UFormGroup>
          <div v-if="ruleForm.type === 'RULE_TYPE_BONUS_EARNING'" class="grid grid-cols-2 gap-3">
            <UFormGroup :label="t('loyaltyExtras.percentOfAmount')"><UInput v-model.number="ruleForm.percent" type="number" min="0" step="0.5" /></UFormGroup>
            <UFormGroup :label="t('loyaltyExtras.fixedPoints')" :hint="t('loyaltyExtras.ifNoPercent')"><UInput v-model.number="ruleForm.points" type="number" min="0" /></UFormGroup>
          </div>
          <UFormGroup v-else-if="ruleForm.type === 'RULE_TYPE_STAMP_EARNING'" :label="t('loyaltyExtras.stampCount')"><UInput v-model.number="ruleForm.count" type="number" min="1" /></UFormGroup>
          <UFormGroup v-else-if="ruleForm.type === 'RULE_TYPE_MULTIPLIER'" :label="t('loyaltyExtras.multiplier')"><UInput v-model.number="ruleForm.multiplier" type="number" min="0.1" step="0.1" /></UFormGroup>
          <UFormGroup v-else :label="t('loyaltyExtras.tier')"><USelectMenu v-model="ruleForm.tierId" :options="tiers.map((x) => ({ label: x.name, value: x.id }))" value-attribute="value" option-attribute="label" :popper="{ strategy: 'fixed' }" /></UFormGroup>
          <UFormGroup :label="t('loyaltyExtras.priority')" :hint="t('loyaltyExtras.priorityHint')"><UInput v-model.number="ruleForm.priority" type="number" /></UFormGroup>
          <label class="flex items-center gap-2 text-sm"><UToggle v-model="ruleForm.active" size="sm" />{{ t('loyaltyExtras.active') }}</label>
        </div>
        <template #footer><div class="flex justify-end gap-2"><UButton color="gray" variant="ghost" @click="ruleOpen = false">{{ t('common.cancel') }}</UButton><UButton color="primary" :loading="saving" :disabled="!ruleForm.name.trim()" @click="saveRule">{{ t('common.save') }}</UButton></div></template>
      </UCard>
    </UModal>

    <!-- milestone template form -->
    <UModal v-model="tplOpen" class="at-modal" :ui="atModalUi">
      <UCard :ui="atCardUiFit">
        <template #header><h3 class="font-semibold">{{ tplForm.id ? t('common.edit') : t('common.add') }}: {{ t('loyaltyExtras.milestone') }}</h3></template>
        <div class="space-y-3">
          <UFormGroup :label="t('common.name')" required><UInput v-model="tplForm.name" /></UFormGroup>
          <UFormGroup v-if="!tplForm.id" :label="t('loyaltyExtras.type')"><USelectMenu v-model="tplForm.type" :options="TPL_TYPES.map((c) => ({ label: t(c.key), value: c.value }))" value-attribute="value" option-attribute="label" :popper="{ strategy: 'fixed' }" /></UFormGroup>
          <UFormGroup v-if="!tplForm.id && tplForm.type !== 'MILESTONE_TYPE_BIRTHDAY'" :label="t('loyaltyExtras.fieldKey')" :hint="t('loyaltyExtras.fieldKeyHint')" required><UInput v-model="tplForm.fieldKey" /></UFormGroup>
          <div class="grid grid-cols-2 gap-3">
            <UFormGroup :label="t('loyaltyExtras.daysBefore')"><UInput v-model.number="tplForm.before" type="number" min="0" /></UFormGroup>
            <UFormGroup :label="t('loyaltyExtras.daysAfter')"><UInput v-model.number="tplForm.after" type="number" min="0" /></UFormGroup>
          </div>
          <UFormGroup :label="t('loyaltyExtras.rewardPoints')" :hint="t('loyaltyExtras.zeroNoReward')"><UInput v-model.number="tplForm.bonus" type="number" min="0" /></UFormGroup>
          <UFormGroup :label="t('loyaltyExtras.message')"><UInput v-model="tplForm.message" /></UFormGroup>
          <label class="flex items-center gap-2 text-sm"><UToggle v-model="tplForm.active" size="sm" />{{ t('loyaltyExtras.active') }}</label>
        </div>
        <template #footer><div class="flex justify-end gap-2"><UButton color="gray" variant="ghost" @click="tplOpen = false">{{ t('common.cancel') }}</UButton><UButton color="primary" :loading="saving" :disabled="!tplForm.name.trim()" @click="saveTpl">{{ t('common.save') }}</UButton></div></template>
      </UCard>
    </UModal>
  </div>
</template>
