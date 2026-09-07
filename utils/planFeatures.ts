// Shared parsing/labelling for the `metadata_json` blob every billing plan
// carries: {"features":[{"key":"max_employees","label":"...","value":30}]}.
// `label` is usually an i18n key under the `app.` namespace (seeded plans),
// but console-created plans store literal text -- both are handled by
// planFeatureLabel below.

export type PlanFeature = {
  key: string;
  label?: string;
  value: number | string | boolean;
};

// One cell in the comparison table: a raw value, a boolean (rendered as
// check / dash), or null/undefined ("—").
export type CellValue = string | number | boolean | null | undefined;

export function parsePlanFeatures(metadataJson?: string | null): PlanFeature[] {
  if (!metadataJson) return [];
  try {
    const parsed = JSON.parse(metadataJson);
    if (Array.isArray(parsed?.features)) {
      return parsed.features.filter(
        (f: any) => f && typeof f.key === 'string' && f.value !== undefined && f.value !== null
      );
    }
  } catch {
    // Malformed/legacy metadata -> no features rather than a crash.
  }
  return [];
}

export function planFeatureLabel(f: PlanFeature, t: (k: string, ...a: any[]) => string): string {
  const raw = (f.label || '').trim();
  if (raw) return t('app.' + raw) || raw;
  return f.key;
}

// Stable display order + de-dup for a set of feature keys drawn from several
// plans: keeps first-seen order so tiers of the same app line up.
export function orderedFeatureKeys(featureLists: PlanFeature[][]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of featureLists) {
    for (const f of list) {
      if (!seen.has(f.key)) {
        seen.add(f.key);
        out.push(f.key);
      }
    }
  }
  return out;
}
