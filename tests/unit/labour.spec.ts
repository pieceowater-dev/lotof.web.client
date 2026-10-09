import { describe, expect, it } from 'vitest';
import { isWorkLine, markupPercent, splitLabour } from '@/utils/labour';

const work = (price: number, qty = 1, pay = 0) => ({ itemKind: 'WORK', priceAtPurchase: price, quantity: qty, workPayPercent: pay });
const part = (price: number, qty = 1, cost = 0) => ({ itemKind: 'MATERIAL', priceAtPurchase: price, quantity: qty, costPriceAtPurchase: cost });

describe('splitLabour', () => {
  it('splits lines by kind and totals each side', () => {
    const s = splitLabour([work(1000, 1, 30), part(200, 2, 120), part(50)]);
    expect(s.works).toHaveLength(1);
    expect(s.materials).toHaveLength(2);
    expect(s.worksTotal).toBe(1000);
    expect(s.materialsTotal).toBe(450);
  });
  it('computes the employee payout from each work line', () => {
    const s = splitLabour([work(1000, 1, 30), work(500, 2, 10)]);
    expect(s.payout).toBe(300 + 100);
  });
  it('treats lines without a kind (old orders, cafe items) as materials', () => {
    const s = splitLabour([{ priceAtPurchase: 10, quantity: 3 }]);
    expect(s.materialsTotal).toBe(30);
    expect(s.worksTotal).toBe(0);
    expect(s.payout).toBe(0);
  });
  it('includes modifier surcharges in a line total', () => {
    const s = splitLabour([{ itemKind: 'WORK', priceAtPurchase: 100, quantity: 2, workPayPercent: 50, modifiers: [{ priceAtPurchase: 10 }] }]);
    expect(s.worksTotal).toBe(220);
    expect(s.payout).toBe(110);
  });
  it('sums the cost of materials', () => {
    expect(splitLabour([part(200, 2, 120), part(10, 1, 4)]).materialsCost).toBe(244);
  });
});

describe('isWorkLine / markupPercent', () => {
  it('detects work lines', () => {
    expect(isWorkLine(work(1))).toBe(true);
    expect(isWorkLine(part(1))).toBe(false);
  });
  it('computes markup over cost, null when cost is unknown', () => {
    expect(markupPercent(150, 100)).toBe(50);
    expect(markupPercent(90, 100)).toBe(-10);
    expect(markupPercent(100, 0)).toBeNull();
    expect(markupPercent(100, undefined)).toBeNull();
  });
});
