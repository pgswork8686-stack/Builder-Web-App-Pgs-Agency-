import {
  isPrivateOrLoopbackIp,
  normalizeIp,
  resolveClientIp,
} from './client-ip';

describe('client IP resolution', () => {
  it.each([
    ['203.0.113.9', '203.0.113.9'],
    ['2001:DB8::8', '2001:db8::8'],
    ['::ffff:192.0.2.10', '192.0.2.10'],
  ])('normalizes valid IP %s', (value, expected) => {
    expect(normalizeIp(value)).toBe(expected);
  });

  it.each([
    '',
    'not-an-ip',
    '203.0.113.9, 198.51.100.2',
    ['203.0.113.9'],
    'x'.repeat(65),
  ])('rejects malformed or multiple IP value', (value) => {
    expect(normalizeIp(value)).toBeNull();
  });

  it.each([
    '127.0.0.1',
    '10.0.0.2',
    '172.20.0.3',
    '192.168.1.4',
    '::1',
    'fd00::2',
  ])('recognizes trusted local proxy peer %s', (value) => {
    expect(isPrivateOrLoopbackIp(value)).toBe(true);
  });

  it('uses a valid Cloudflare visitor IPv4 behind a trusted local peer', () => {
    expect(
      resolveClientIp(
        {
          headers: { 'cf-connecting-ip': '203.0.113.9' },
          ip: '198.51.100.4',
          socket: { remoteAddress: '172.20.0.3' },
        },
        true,
      ),
    ).toBe('203.0.113.9');
  });

  it('uses a valid Cloudflare visitor IPv6 behind a trusted local peer', () => {
    expect(
      resolveClientIp(
        {
          headers: { 'cf-connecting-ip': '2001:db8::8' },
          ip: '198.51.100.4',
          socket: { remoteAddress: '::1' },
        },
        true,
      ),
    ).toBe('2001:db8::8');
  });

  it.each([
    'not-an-ip',
    '203.0.113.9, 198.51.100.2',
    ['203.0.113.9', '198.51.100.2'],
  ])('ignores malformed or multiple Cloudflare values', (header) => {
    expect(
      resolveClientIp(
        {
          headers: { 'cf-connecting-ip': header },
          ip: '198.51.100.4',
          socket: { remoteAddress: '172.20.0.3' },
        },
        true,
      ),
    ).toBe('198.51.100.4');
  });

  it('falls back to the Express IP when the trusted proxy header is missing', () => {
    expect(
      resolveClientIp(
        {
          headers: {},
          ip: '198.51.100.4',
          socket: { remoteAddress: '172.20.0.3' },
        },
        true,
      ),
    ).toBe('198.51.100.4');
  });

  it('ignores spoofed proxy headers from a public direct peer', () => {
    expect(
      resolveClientIp(
        {
          headers: { 'cf-connecting-ip': '203.0.113.9' },
          ip: '203.0.113.9',
          socket: { remoteAddress: '198.51.100.50' },
        },
        true,
      ),
    ).toBe('198.51.100.50');
  });

  it('uses the socket peer in direct local development', () => {
    expect(
      resolveClientIp(
        {
          headers: { 'cf-connecting-ip': '203.0.113.9' },
          ip: '203.0.113.9',
          socket: { remoteAddress: '127.0.0.1' },
        },
        false,
      ),
    ).toBe('127.0.0.1');
  });
});
