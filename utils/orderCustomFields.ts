import type { MenuOrderField } from '@/api/menu/orderfield/list';

// An order's custom field values travel as one JSON object keyed by field id
// (Order.customFields on the backend). Values are always strings whatever the
// field's data type; these helpers keep the parse/serialize/format rules in
// one place for the create form, the order card and the printable documents.

export type CustomFieldValues = Record<string, string>;

export function parseCustomFields(json: string | null | undefined): CustomFieldValues {
  if (!json) return {};
  try {
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: CustomFieldValues = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === 'string' && v !== '') out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

// Blank values are dropped so a cleared field doesn't linger as "".
export function serializeCustomFields(values: CustomFieldValues): string {
  const clean: CustomFieldValues = {};
  for (const [k, v] of Object.entries(values)) {
    const trimmed = typeof v === 'string' ? v.trim() : '';
    if (trimmed !== '') clean[k] = trimmed;
  }
  return JSON.stringify(clean);
}

// The fields an order should show: every active field, plus any inactive one
// that this order already holds a value for (so switching a field off never
// hides data that was already recorded).
export function fieldsForOrder(fields: MenuOrderField[], values: CustomFieldValues): MenuOrderField[] {
  return fields
    .filter((f) => f.isActive || values[f.id] !== undefined)
    .sort((a, b) => a.viewOrder - b.viewOrder);
}

export function missingRequiredFields(fields: MenuOrderField[], values: CustomFieldValues): MenuOrderField[] {
  return fields.filter((f) => f.isActive && f.isRequired && f.dataType !== 'HEADING' && !(values[f.id] ?? '').trim());
}

export function formatCustomFieldValue(
  field: MenuOrderField,
  value: string | undefined,
  labels: { yes: string; no: string }
): string {
  if (value === undefined || value === '') return '';
  switch (field.dataType) {
    case 'HEADING':
      return '';
    case 'MULTISELECT':
      return parseMulti(value).join(', ');
    case 'DATETIME': {
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
    }
    case 'BOOLEAN':
      return value === 'true' ? labels.yes : labels.no;
    case 'DATE': {
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString();
    }
    default:
      return value;
  }
}

// MULTISELECT values are stored as a JSON array of strings.
export function parseMulti(value: string | undefined): string[] {
  if (!value) return [];
  try {
    const v = JSON.parse(value);
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function serializeMulti(values: string[]): string {
  return values.length ? JSON.stringify(values) : '';
}

// Defaults of the active fields, for a brand-new order.
export function defaultValuesFor(fields: MenuOrderField[]): CustomFieldValues {
  const out: CustomFieldValues = {};
  for (const f of fields) if (f.isActive && f.defaultValue && f.dataType !== 'HEADING') out[f.id] = f.defaultValue;
  return out;
}

// Values to carry into a warranty order: only the fields that opted in.
export function warrantyCarryOver(fields: MenuOrderField[], json: string | null | undefined): string {
  const values = parseCustomFields(json);
  const keep: CustomFieldValues = {};
  for (const f of fields) if (f.copyToWarranty !== false && values[f.id] !== undefined) keep[f.id] = values[f.id];
  return serializeCustomFields(keep);
}
