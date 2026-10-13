import { describe, it, expect } from 'vitest';
import { leadKey, leadEndpoint, leadFormSnippet } from '@/utils/leadForm';

describe('lead form', () => {
  it('derives the same key as the gateway (HMAC-SHA256 of "lead:<board>", 24 hex)', async () => {
    // Reference value computed with Python's hmac for secret="secret", board="board-1".
    expect(await leadKey('secret', 'board-1')).toBe('61e20d4a83fd78201b71fc56');
  });

  it('builds the address and a form that posts to it', () => {
    const url = leadEndpoint('https://lota.tools', '/api-tasks', 'acme', 'b1', 'k');
    expect(url).toBe('https://lota.tools/api-tasks/lead/acme/boards/b1?key=k');
    const html = leadFormSnippet(url, { name: 'Name', phone: 'Phone', comment: 'Comment', send: 'Send', thanks: 'Thanks' });
    expect(html).toContain(url);
    expect(html).toContain('name="website"');
  });
});
