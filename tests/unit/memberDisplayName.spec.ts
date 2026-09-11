import { describe, expect, it } from 'vitest';
import { memberDisplayName, memberDisplayNameWithFallback } from '@/utils/memberDisplayName';

describe('memberDisplayName', () => {
  it('returns "" for a null/undefined member', () => {
    expect(memberDisplayName(null)).toBe('');
    expect(memberDisplayName(undefined)).toBe('');
  });

  it('prefers the nickname over the username', () => {
    expect(memberDisplayName({ nickname: 'Boss', username: 'mcloving69' })).toBe('Boss');
  });

  it('falls back to username when there is no nickname', () => {
    expect(memberDisplayName({ username: 'mcloving69' })).toBe('mcloving69');
    expect(memberDisplayName({ nickname: null, username: 'mcloving69' })).toBe('mcloving69');
  });

  it('trims the nickname and ignores a whitespace-only one', () => {
    expect(memberDisplayName({ nickname: '  Boss  ', username: 'x' })).toBe('Boss');
    expect(memberDisplayName({ nickname: '   ', username: 'mcloving69' })).toBe('mcloving69');
  });

  it('returns "" when neither nickname nor username is set', () => {
    expect(memberDisplayName({})).toBe('');
  });
});

describe('memberDisplayNameWithFallback', () => {
  it('uses memberDisplayName\'s result when it has one, ignoring fallbacks', () => {
    expect(memberDisplayNameWithFallback({ username: 'alice' }, 'alice@example.com', 'id-123')).toBe('alice');
  });

  it('falls back to the first non-blank fallback in order', () => {
    expect(memberDisplayNameWithFallback({}, '', 'alice@example.com', 'id-123')).toBe('alice@example.com');
    expect(memberDisplayNameWithFallback({}, undefined, null, 'id-123')).toBe('id-123');
  });

  it('trims a chosen fallback', () => {
    expect(memberDisplayNameWithFallback({}, '  alice@example.com  ')).toBe('alice@example.com');
  });

  it('returns "" when the member and every fallback are blank', () => {
    expect(memberDisplayNameWithFallback({}, '', '   ', null, undefined)).toBe('');
  });

  it('works with zero fallbacks passed', () => {
    expect(memberDisplayNameWithFallback({})).toBe('');
    expect(memberDisplayNameWithFallback({ username: 'alice' })).toBe('alice');
  });
});
