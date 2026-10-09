// Labour vs materials. A catalog item is either a WORK (labour/service) or a
// MATERIAL (goods/parts); the kind, the cost price and the work pay percent
// are snapshotted onto each order line (see MenuOrderItem) so an order keeps
// its own split whatever happens to the catalog later.

export type ItemKind = 'WORK' | 'MATERIAL';

export type LabourLine = {
  itemKind?: string | null;
  priceAtPurchase: number;
  quantity: number;
  costPriceAtPurchase?: number | null;
  workPayPercent?: number | null;
  modifiers?: { priceAtPurchase: number }[] | null;
};

export type LabourSplit<T extends LabourLine> = {
  works: T[];
  materials: T[];
  worksTotal: number;
  materialsTotal: number;
  // Total owed to the employee for the WORK lines: each line's total times
  // its work pay percent.
  payout: number;
  // Cost of the MATERIAL lines (cost price x quantity); 0 if not tracked.
  materialsCost: number;
};

export function isWorkLine(line: LabourLine): boolean {
  return line.itemKind === 'WORK';
}

// Unit price including modifier surcharges, same as an order card's lines.
export function lineUnitPrice(line: LabourLine): number {
  return line.priceAtPurchase + (line.modifiers || []).reduce((sum, m) => sum + m.priceAtPurchase, 0);
}

export function lineTotal(line: LabourLine): number {
  return lineUnitPrice(line) * line.quantity;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function splitLabour<T extends LabourLine>(lines: T[]): LabourSplit<T> {
  const works = lines.filter(isWorkLine);
  const materials = lines.filter((l) => !isWorkLine(l));
  const sum = (ls: T[]) => ls.reduce((s, l) => s + lineTotal(l), 0);
  return {
    works,
    materials,
    worksTotal: round2(sum(works)),
    materialsTotal: round2(sum(materials)),
    payout: round2(works.reduce((s, l) => s + (lineTotal(l) * (l.workPayPercent ?? 0)) / 100, 0)),
    materialsCost: round2(materials.reduce((s, l) => s + (l.costPriceAtPurchase ?? 0) * l.quantity, 0)),
  };
}

// Markup of a price over its cost, in percent; null when cost isn't tracked.
export function markupPercent(price: number, cost: number | null | undefined): number | null {
  if (!cost || cost <= 0) return null;
  return round2(((price - cost) / cost) * 100);
}
