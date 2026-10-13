import { describe, it, expect } from 'vitest';
import { applyCustomDocVariables, parseCustomDocVariables, CUSTOM_VAR_NAME_RE } from '@/utils/customDocVariables';

describe('custom document variables', () => {
  it('reads variables from the order rules JSON and ignores junk', () => {
    expect(parseCustomDocVariables('{"priceStage":true,"docVariables":{"BIN":"123","N":5}}')).toEqual({ BIN: '123' });
    expect(parseCustomDocVariables('oops')).toEqual({});
    expect(parseCustomDocVariables(null)).toEqual({});
  });

  it('substitutes any-case tokens, escapes html and keeps line breaks', () => {
    const html = applyCustomDocVariables('<p>{{bin}} / {{ Банк }} / {{OTHER}}</p>', { BIN: '1<2', Банк: 'a\nb' });
    expect(html).toBe('<p>1&lt;2 / a<br>b / {{OTHER}}</p>');
  });

  it('accepts only simple names', () => {
    expect(CUSTOM_VAR_NAME_RE.test('Реквизиты_1')).toBe(true);
    expect(CUSTOM_VAR_NAME_RE.test('bad name')).toBe(false);
    expect(CUSTOM_VAR_NAME_RE.test('')).toBe(false);
  });
});
