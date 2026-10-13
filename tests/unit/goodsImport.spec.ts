import { describe, it, expect } from 'vitest';
import { detectColumns, parseGoodsSheet, toCents } from '@/utils/goodsImport';

describe('goods import', () => {
  it('finds columns by ru/en header names', () => {
    const c = detectColumns(['Наименование', 'SKU', 'Цена закупки', 'Price', 'Остаток', 'Прочее']);
    expect(c).toEqual({ name: 'Наименование', sku: 'SKU', cost: 'Цена закупки', price: 'Price', quantity: 'Остаток' });
  });

  it('reads money with comma and spaces', () => {
    expect(toCents('1 250,50')).toBe(125050);
    expect(toCents('')).toBe(0);
    expect(toCents('abc')).toBeNaN();
    expect(toCents(-1)).toBeNaN();
  });

  it('flags empty names, bad numbers and repeated SKUs, skips empty lines', () => {
    const { goods } = parseGoodsSheet([
      { Название: 'Хлеб', Артикул: 'A1', Цена: '50', Остаток: '10' },
      { Название: '', Артикул: 'A2', Цена: '10' },
      { Название: 'Молоко', Артикул: 'A1', Цена: '90' },
      { Название: 'Сыр', Артикул: 'A3', Цена: 'дорого' },
      { Название: '', Артикул: '', Цена: '' },
    ]);
    expect(goods.map((g) => g.error)).toEqual([undefined, 'name', 'duplicate', 'number']);
    expect(goods[0]).toMatchObject({ line: 2, name: 'Хлеб', salePriceCents: 5000, quantity: 10 });
  });
});
