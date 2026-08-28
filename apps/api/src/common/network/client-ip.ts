import { isIP } from 'node:net';

const MAX_IP_LENGTH = 64;

export interface ClientIpRequest {
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
  socket?: {
    remoteAddress?: string | null;
  };
}

export function normalizeIp(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  let candidate = value.trim();
  if (
    !candidate ||
    candidate.length > MAX_IP_LENGTH ||
    candidate.includes(',')
  ) {
    return null;
  }

  const mappedIpv4 = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(candidate);
  if (mappedIpv4) {
    candidate = mappedIpv4[1];
  }

  return isIP(candidate) === 0 ? null : candidate.toLowerCase();
}

export function isPrivateOrLoopbackIp(value: string): boolean {
  const normalized = normalizeIp(value);
  if (!normalized) {
    return false;
  }

  if (isIP(normalized) === 4) {
    const octets = normalized.split('.').map(Number);
    return (
      octets[0] === 10 ||
      octets[0] === 127 ||
      (octets[0] === 169 && octets[1] === 254) ||
      (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
      (octets[0] === 192 && octets[1] === 168)
    );
  }

  return (
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    /^fe[89ab]/.test(normalized)
  );
}

export function resolveClientIp(
  request: ClientIpRequest,
  trustProxy: boolean,
): string {
  const peerIp = normalizeIp(request.socket?.remoteAddress);

  if (!trustProxy || !peerIp || !isPrivateOrLoopbackIp(peerIp)) {
    return peerIp ?? normalizeIp(request.ip) ?? 'unknown';
  }

  const cloudflareIp = normalizeIp(request.headers['cf-connecting-ip']);
  if (cloudflareIp) {
    return cloudflareIp;
  }

  return normalizeIp(request.ip) ?? peerIp;
}
