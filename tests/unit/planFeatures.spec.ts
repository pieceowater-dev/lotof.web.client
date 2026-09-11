import { describe, expect, it } from 'vitest';
import { orderedFeatureKeys, parsePlanFeatures, planFeatureLabel, type PlanFeature } from '@/utils/planFeatures';

describe('parsePlanFeatures', () => {
  it('returns [] for null/undefined/empty input', () => {
    expect(parsePlanFeatures(null)).toEqual([]);
    expect(parsePlanFeatures(undefined)).toEqual([]);
    expect(parsePlanFeatures('')).toEqual([]);
  });

  it('returns [] for malformed JSON instead of throwing', () => {
    expect(parsePlanFeatures('{not json')).toEqual([]);
  });

  it('returns [] when the parsed value has no features array', () => {
    expect(parsePlanFeatures('{"other":1}')).toEqual([]);
    expect(parsePlanFeatures('{"features":"not-an-array"}')).toEqual([]);
  });

  it('parses valid features', () => {
    const json = JSON.stringify({ features: [{ key: 'max_employees', label: 'Employees', value: 30 }] });
    expect(parsePlanFeatures(json)).toEqual([{ key: 'max_employees', label: 'Employees', value: 30 }]);
  });

  it('drops entries missing a key or a value', () => {
    const json = JSON.stringify({
      features: [
        { key: 'max_employees', value: 30 },
        { value: 30 }, // no key
        { key: 'no_value' }, // no value
        { key: 'null_value', value: null },
      ],
    });
    expect(parsePlanFeatures(json)).toEqual([{ key: 'max_employees', value: 30 }]);
  });

  it('keeps a falsy-but-defined value like 0 or false', () => {
    const json = JSON.stringify({
      features: [
        { key: 'max_seats', value: 0 },
        { key: 'has_sso', value: false },
      ],
    });
    expect(parsePlanFeatures(json)).toEqual([
      { key: 'max_seats', value: 0 },
      { key: 'has_sso', value: false },
    ]);
  });
});

describe('planFeatureLabel', () => {
  // A minimal stand-in for useI18n()'s t(): returns '' on a miss, exactly
  // like the real implementation (see FRONTEND_AUDIT.md I1) -- planFeatureLabel
  // is written to fall through that '' rather than display it, so the test
  // fixture has to reproduce the miss behavior, not just the hit behavior.
  function fakeT(dict: Record<string, string>) {
    return (key: string, params?: Record<string, string | number>) => {
      const template = dict[key];
      if (!template) return '';
      return params ? template.replace(/\{value\}/g, String(params.value)) : template;
    };
  }

  it('prefers a localized app.planFeature.<key> template when present', () => {
    const t = fakeT({ 'app.planFeature.max_employees': 'Up to {value} employees' });
    const feature: PlanFeature = { key: 'max_employees', value: 30 };
    expect(planFeatureLabel(feature, t)).toBe('Up to 30 employees');
  });

  it('falls back to a non-namespaced metadata label, translated, as "<label>: <value>"', () => {
    const t = fakeT({ 'app.Boards': 'Доски' });
    const feature: PlanFeature = { key: 'max_boards', label: 'Boards', value: 5 };
    expect(planFeatureLabel(feature, t)).toBe('Доски: 5');
  });

  it('falls back to the raw metadata label when it has no translation either', () => {
    const t = fakeT({});
    const feature: PlanFeature = { key: 'max_boards', label: 'Boards', value: 5 };
    expect(planFeatureLabel(feature, t)).toBe('Boards: 5');
  });

  it('ignores a namespaced (dotted) metadata label -- humanizes the key instead', () => {
    // The exact scenario the comment in planFeatures.ts documents: some
    // seeded plans store a label like "pieceowater.issues.start.feature.max_boards"
    // that has no real translation and shouldn't be shown verbatim.
    const t = fakeT({});
    const feature: PlanFeature = {
      key: 'max_boards',
      label: 'pieceowater.issues.start.feature.max_boards',
      value: 5,
    };
    expect(planFeatureLabel(feature, t)).toBe('Boards: 5');
  });

  it('humanizes an unlabeled key: strips the max_ prefix, underscores to spaces, capitalizes', () => {
    const t = fakeT({});
    const feature: PlanFeature = { key: 'max_active_orders', value: 100 };
    expect(planFeatureLabel(feature, t)).toBe('Active orders: 100');
  });
});

describe('orderedFeatureKeys', () => {
  it('keeps first-seen order across multiple plans', () => {
    const listA: PlanFeature[] = [{ key: 'a', value: 1 }, { key: 'b', value: 2 }];
    const listB: PlanFeature[] = [{ key: 'b', value: 3 }, { key: 'c', value: 4 }];
    expect(orderedFeatureKeys([listA, listB])).toEqual(['a', 'b', 'c']);
  });

  it('de-dupes repeated keys', () => {
    const listA: PlanFeature[] = [{ key: 'a', value: 1 }];
    const listB: PlanFeature[] = [{ key: 'a', value: 2 }];
    expect(orderedFeatureKeys([listA, listB])).toEqual(['a']);
  });

  it('returns [] for no lists / all-empty lists', () => {
    expect(orderedFeatureKeys([])).toEqual([]);
    expect(orderedFeatureKeys([[], []])).toEqual([]);
  });
});
