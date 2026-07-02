import net from "node:net";
import { lookup } from "node:dns/promises";

/**
 * SSRF / internal-target guard.
 *
 * A scanner that will point industry tooling at whatever host it is given is a
 * liability: an operator (or an attacker who reaches the one-click flow) could
 * aim it at loopback, the RFC1918 LAN, link-local, or the cloud metadata
 * endpoint (169.254.169.254) and turn PentAI into an SSRF pivot. Every scan
 * target is checked here before any tool runs.
 */

/** Hostnames we refuse outright, regardless of what they resolve to. */
const BLOCKED_HOSTNAME_PATTERNS: RegExp[] = [
  /^localhost$/i,
  /\.localhost$/i,
  /\.local$/i,
  /\.internal$/i,
  /\.intranet$/i,
  /\.corp$/i,
  /\.home$/i,
  /\.lan$/i,
  /^metadata\.google\.internal$/i,
];

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (n > 255) return null;
    value = value * 256 + n;
  }
  return value >>> 0;
}

function inRange(ip: number, cidrBase: string, prefix: number): boolean {
  const base = ipv4ToInt(cidrBase);
  if (base === null) return false;
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (ip & mask) === (base & mask);
}

/** IPv4 ranges that must never be scanned (private, loopback, link-local, etc.). */
const BLOCKED_V4: Array<[string, number]> = [
  ["0.0.0.0", 8], // "this network"
  ["10.0.0.0", 8], // RFC1918
  ["100.64.0.0", 10], // CGNAT
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link-local (includes 169.254.169.254 metadata)
  ["172.16.0.0", 12], // RFC1918
  ["192.0.0.0", 24], // IETF protocol assignments
  ["192.0.2.0", 24], // TEST-NET-1
  ["192.168.0.0", 16], // RFC1918
  ["198.18.0.0", 15], // benchmarking
  ["198.51.100.0", 24], // TEST-NET-2
  ["203.0.113.0", 24], // TEST-NET-3
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved
];

/**
 * True when the given IP literal (v4 or v6) points at a private, loopback,
 * link-local, reserved, or otherwise non-public address.
 */
export function isPrivateIp(ip: string): boolean {
  const family = net.isIP(ip);

  if (family === 4) {
    const value = ipv4ToInt(ip);
    if (value === null) return true; // unparseable → treat as unsafe
    return BLOCKED_V4.some(([base, prefix]) => inRange(value, base, prefix));
  }

  if (family === 6) {
    const normalized = ip.toLowerCase().split("%")[0]; // drop zone id
    if (normalized === "::1" || normalized === "::") return true;
    if (normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb")) {
      return true; // fe80::/10 link-local
    }
    if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true; // fc00::/7 ULA
    // IPv4-mapped (::ffff:a.b.c.d) — evaluate the embedded v4 address.
    const mapped = normalized.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIp(mapped[1]);
    return false;
  }

  // Not a valid IP literal.
  return false;
}

/** True when a hostname is on the never-scan denylist. */
export function isBlockedHostname(host: string): boolean {
  return BLOCKED_HOSTNAME_PATTERNS.some((re) => re.test(host));
}

export class UnsafeTargetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeTargetError";
  }
}

/**
 * Resolves and validates that a host is a public, scannable target. Throws
 * {@link UnsafeTargetError} for denylisted hostnames, IP literals in a private
 * range, or hostnames that resolve to any private/loopback/link-local address.
 * Returns the host unchanged when it is safe.
 *
 * Set PENTAI_ALLOW_PRIVATE_TARGETS=1 to bypass (only for a trusted lab).
 */
export async function assertPublicHost(host: string): Promise<string> {
  if (process.env.PENTAI_ALLOW_PRIVATE_TARGETS === "1") return host;

  if (isBlockedHostname(host)) {
    throw new UnsafeTargetError(`Refusing to scan reserved/internal hostname: "${host}"`);
  }

  // Host is already an IP literal.
  if (net.isIP(host)) {
    if (isPrivateIp(host)) {
      throw new UnsafeTargetError(`Refusing to scan private/reserved IP: "${host}"`);
    }
    return host;
  }

  // Hostname → resolve every address and reject if any is private.
  let addresses: { address: string }[];
  try {
    addresses = await lookup(host, { all: true });
  } catch (err) {
    throw new UnsafeTargetError(
      `Could not resolve host "${host}": ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (addresses.length === 0) {
    throw new UnsafeTargetError(`Host "${host}" did not resolve to any address`);
  }

  for (const { address } of addresses) {
    if (isPrivateIp(address)) {
      throw new UnsafeTargetError(
        `Refusing to scan "${host}" — it resolves to a private/reserved address (${address})`,
      );
    }
  }

  return host;
}
