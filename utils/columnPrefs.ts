// Which table columns a person has switched off. Stored as a list of hidden keys, so a column added
// later shows up by itself; "locked" columns (the row's name) can never be hidden.
export type ColumnDef = { key: string; label?: string };

export function parseHidden(raw: string | null | undefined): string[] {
  try {
    const v = JSON.parse(raw || '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function visibleColumns<T extends ColumnDef>(all: T[], hidden: string[], locked: string[] = []): T[] {
  return all.filter((c) => locked.includes(c.key) || !hidden.includes(c.key));
}

export function toggleHidden(hidden: string[], key: string, locked: string[] = []): string[] {
  if (locked.includes(key)) return hidden;
  return hidden.includes(key) ? hidden.filter((k) => k !== key) : [...hidden, key];
}
