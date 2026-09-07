<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { parsePlanFeatures, planFeatureLabel, orderedFeatureKeys } from '@/utils/planFeatures';
import FeatureComparisonTable from '@/components/billing/FeatureComparisonTable.vue';
import type { CellValue } from '@/utils/planFeatures';

type PlanLike = {
  id: string;
  code: string;
  name: string;
  interval: 'MONTH' | 'YEAR' | string;
  amountCents: number;
  trialDays: number;
  metadataJson?: string | null;
};

const props = defineProps<{
  plans: PlanLike[];
  activePlanId?: string | null;
  currency?: string;
}>();

const { t } = useI18n();

function formatPrice(amountCents: number): string {
  const amount = amountCents / 100;
  const cur = props.currency || 'KZT';
  if (cur === 'KZT') return `${amount.toLocaleString('ru-KZ')}₸`;
  return `${cur} ${amount.toLocaleString()}`;
}

const columns = computed(() =>
  props.plans.map((p) => ({
    key: p.id,
    title: p.name,
    subtitle:
      p.amountCents === 0
        ? t('app.freeForever') || 'Бесплатно'
        : `${formatPrice(p.amountCents)} / ${p.interval === 'YEAR' ? (t('app.year') || 'год') : (t('app.month') || 'мес')}`,
    highlight: !!props.activePlanId && p.id === props.activePlanId,
  }))
);

const groups = computed(() => {
  const parsed = props.plans.map((p) => ({ plan: p, features: parsePlanFeatures(p.metadataJson) }));
  const keys = orderedFeatureKeys(parsed.map((x) => x.features));

  const rows: Array<{ label: string; values: Record<string, CellValue> }> = [];

  // Trial row first -- it's the thing people scan for.
  rows.push({
    label: t('app.trialPeriod') || 'Пробный период',
    values: Object.fromEntries(
      props.plans.map((p) => [
        p.id,
        p.trialDays > 0 ? `${p.trialDays} ${t('app.daysShort') || 'дн'}` : (p.amountCents === 0 ? true : false),
      ])
    ),
  });

  for (const key of keys) {
    let label = key;
    for (const { features } of parsed) {
      const f = features.find((x) => x.key === key);
      if (f) { label = planFeatureLabel(f, t); break; }
    }
    rows.push({
      label,
      values: Object.fromEntries(
        parsed.map(({ plan, features }) => {
          const f = features.find((x) => x.key === key);
          return [plan.id, f ? f.value : null];
        })
      ),
    });
  }

  return [{ rows }];
});
</script>

<template>
  <FeatureComparisonTable
    v-if="plans.length > 1"
    :columns="columns"
    :groups="groups"
    :subtitle="t('app.comparePlansSubtitle') || 'Выберите тариф под свою нагрузку'"
  />
</template>
