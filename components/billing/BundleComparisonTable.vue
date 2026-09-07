<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from '@/composables/useI18n';
import { ALL_APPS } from '@/config/apps';
import { parsePlanFeatures, planFeatureLabel, orderedFeatureKeys } from '@/utils/planFeatures';
import FeatureComparisonTable from '@/components/billing/FeatureComparisonTable.vue';
import type { CellValue } from '@/utils/planFeatures';
import type { Bundle } from '@/api/capital/bundles';

type PlanLike = { code: string; name: string; metadataJson?: string | null };

const props = defineProps<{
  bundles: Bundle[];
  // planCode -> that per-app plan (carries metadataJson for the limits)
  planLookup: Record<string, PlanLike>;
  activeCodes?: string[];
}>();

const { t } = useI18n();

function appLabel(code: string): string {
  const app = ALL_APPS.find((a) => a.bundle === code);
  return app ? t(app.titleKey) : code;
}

const columns = computed(() =>
  props.bundles.map((b) => ({
    key: b.code,
    title: b.name,
    subtitle: b.trialDays > 0 ? `${b.trialDays} ${t('app.daysShort') || 'дн'} ${t('app.trialLower') || 'триал'}` : undefined,
    highlight: (props.activeCodes || []).includes(b.code),
  }))
);

// Every app referenced by any displayed bundle, in a stable order.
const appCodes = computed(() => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const b of props.bundles) {
    for (const it of b.items) {
      if (!seen.has(it.applicationCode)) {
        seen.add(it.applicationCode);
        out.push(it.applicationCode);
      }
    }
  }
  return out;
});

function itemFor(b: Bundle, appCode: string) {
  return b.items.find((it) => it.applicationCode === appCode);
}

const groups = computed(() => {
  const result: Array<{ label?: string; rows: Array<{ label: string; values: Record<string, CellValue> }> }> = [];

  // 1. Which apps + which tier each bundle grants.
  result.push({
    label: t('app.compareAppsGroup') || 'Приложения',
    rows: appCodes.value.map((appCode) => ({
      label: appLabel(appCode),
      values: Object.fromEntries(
        props.bundles.map((b) => {
          const it = itemFor(b, appCode);
          return [b.code, it ? (it.planName || true) : false];
        })
      ),
    })),
  });

  // 2. Per-app limit/feature breakdown.
  for (const appCode of appCodes.value) {
    const perBundleFeatures = props.bundles.map((b) => {
      const it = itemFor(b, appCode);
      const plan = it ? props.planLookup[it.planCode] : undefined;
      return { code: b.code, has: !!it, features: plan ? parsePlanFeatures(plan.metadataJson) : [] };
    });
    const keys = orderedFeatureKeys(perBundleFeatures.map((x) => x.features));
    if (!keys.length) continue;

    result.push({
      label: appLabel(appCode),
      rows: keys.map((key) => {
        let label = key;
        for (const { features } of perBundleFeatures) {
          const f = features.find((x) => x.key === key);
          if (f) { label = planFeatureLabel(f, t); break; }
        }
        return {
          label,
          values: Object.fromEntries(
            perBundleFeatures.map(({ code, has, features }) => {
              if (!has) return [code, false];
              const f = features.find((x) => x.key === key);
              return [code, f ? f.value : null];
            })
          ),
        };
      }),
    });
  }

  return result;
});
</script>

<template>
  <FeatureComparisonTable
    v-if="bundles.length >= 1"
    :columns="columns"
    :groups="groups"
    :subtitle="t('app.compareBundlesSubtitle') || 'Что входит в каждую сборку и какие лимиты вы получаете'"
  />
</template>
