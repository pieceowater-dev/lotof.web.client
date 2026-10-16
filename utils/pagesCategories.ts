import type { SiteCategory } from '@/api/pages/ops';

export interface CategoryRow { cat: SiteCategory; depth: number }

/** Categories in tree order (parent, then its children), each with its nesting depth. Orphans are shown at the top level. */
export function categoryTree(list: SiteCategory[]): CategoryRow[] {
  const byParent = new Map<string, SiteCategory[]>();
  const ids = new Set(list.map(c => c.id));
  for (const c of list) {
    const key = c.parentId && ids.has(c.parentId) ? c.parentId : '';
    (byParent.get(key) || byParent.set(key, []).get(key)!).push(c);
  }
  const cmp = (a: SiteCategory, b: SiteCategory) => (a.sort - b.sort) || a.title.localeCompare(b.title);
  const out: CategoryRow[] = [];
  const walk = (parent: string, depth: number, guard: Set<string>) => {
    for (const c of (byParent.get(parent) || []).slice().sort(cmp)) {
      if (guard.has(c.id)) continue;
      out.push({ cat: c, depth });
      walk(c.id, depth + 1, new Set([...guard, c.id]));
    }
  };
  walk('', 0, new Set());
  return out;
}

/** A category and everything below it (a category cannot be moved under itself). */
export function categoryDescendants(list: SiteCategory[], id: string): Set<string> {
  const out = new Set<string>([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const c of list) if (c.parentId && out.has(c.parentId) && !out.has(c.id)) { out.add(c.id); grew = true; }
  }
  return out;
}
