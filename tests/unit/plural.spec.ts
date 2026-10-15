import { describe, expect, it } from 'vitest';
import { plural } from '@/utils/plural';

describe('plural', () => {
  const ru = '{n} заказ|{n} заказа|{n} заказов';
  it('picks the Russian form', () => {
    expect([1, 2, 5, 11, 12, 21, 22, 25, 101, 111].map((n) => plural(n, ru, 'ru'))).toEqual([
      '1 заказ', '2 заказа', '5 заказов', '11 заказов', '12 заказов', '21 заказ', '22 заказа', '25 заказов', '101 заказ', '111 заказов',
    ]);
  });
  it('picks the English form', () => {
    expect(plural(1, '{n} order|{n} orders', 'en')).toBe('1 order');
    expect(plural(2, '{n} order|{n} orders', 'en')).toBe('2 orders');
  });
  it('keeps one Kazakh form', () => {
    expect(plural(3, '{n} тапсырыс', 'kk')).toBe('3 тапсырыс');
  });
});
