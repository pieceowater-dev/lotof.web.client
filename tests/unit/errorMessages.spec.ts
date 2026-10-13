import { describe, it, expect } from 'vitest';
import { getErrorMessage } from '@/utils/types/errors';

const t = (k: string) => ({ 'goods.errReturnExceeds': 'RU exceeds', 'menu.errRequiredFields': 'RU fill' } as Record<string, string>)[k] || '';

describe('error messages', () => {
  it('localizes known business refusals, stripping the grpc wrapper', () => {
    const e = new Error('rpc error: code = FailedPrecondition desc = return quantity exceeds what is left of the receipt: abc');
    expect(getErrorMessage(e, t)).toBe('RU exceeds');
    expect(getErrorMessage(new Error('rpc error: code = FailedPrecondition desc = required fields are empty: a,b'), t)).toBe('RU fill');
  });
  it('hides client-side token guards as technical', () => {
    expect(getErrorMessage(new Error('No plans token'), t)).toBe('');
  });
  it('leaves other human messages alone', () => {
    expect(getErrorMessage(new Error('rpc error: code = AlreadyExists desc = Name taken'), t)).toBe('Name taken');
  });
});
