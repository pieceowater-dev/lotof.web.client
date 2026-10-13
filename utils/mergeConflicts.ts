import type { ClientRow } from '@/api/contacts/listClients';

export type MergeConflict = { field: 'birthDate' | 'binIin' | 'gender'; kept: string; other: string };
export type MergePreview = {
  /** Contact details (phones, e-mails …) the other clients bring that the kept client does not have. */
  newContacts: number;
  /** Contact details that are already on the kept client and will not be duplicated. */
  sameContacts: number;
  conflicts: MergeConflict[];
};

const norm = (v: unknown) => String(v ?? '').trim().toLowerCase();
const digits = (v: unknown) => String(v ?? '').replace(/\D/g, '');

function contactKey(c: { type: string; value: string }): string {
  return `${norm(c.type)}:${norm(c.type) === 'phone' ? digits(c.value) : norm(c.value)}`;
}

/** What merging `others` into `primary` will do, and where the data disagrees (the kept client's value wins). */
export function previewMerge(primary: ClientRow, others: ClientRow[]): MergePreview {
  const have = new Set((primary.contacts || []).map(contactKey));
  let newContacts = 0;
  let sameContacts = 0;
  const conflicts: MergeConflict[] = [];

  const note = (field: MergeConflict['field'], kept: unknown, other: unknown) => {
    const a = norm(kept), b = norm(other);
    if (a && b && a !== b && !conflicts.some((x) => x.field === field && x.other === String(other))) {
      conflicts.push({ field, kept: String(kept), other: String(other) });
    }
  };

  for (const o of others) {
    for (const c of o.contacts || []) {
      const k = contactKey(c);
      if (have.has(k)) sameContacts++;
      else { have.add(k); newContacts++; }
    }
    note('birthDate', primary.individual?.birthDate?.slice(0, 10), o.individual?.birthDate?.slice(0, 10));
    note('binIin', primary.legalEntity?.binIin, o.legalEntity?.binIin);
    if (primary.individual?.gender != null && o.individual?.gender != null) note('gender', primary.individual.gender, o.individual.gender);
  }
  return { newContacts, sameContacts, conflicts };
}
