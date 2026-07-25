import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

// ── Private / reserved IP detection ───────────────────────────────────────────

function isPrivateIpv4(ip: string): boolean {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;
  const [a, b, c] = p;
  if (a === 0) return true; // 0.0.0.0/8 "this host"
  if (a === 10) return true; // 10.0.0.0/8 private
  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local (cloud metadata)
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 private
  if (a === 192 && b === 168) return true; // 192.168.0.0/16 private
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  if (a === 192 && b === 0 && c === 0) return true; // 192.0.0.0/24 IETF protocol
  if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15 benchmarking
  if (a >= 224) return true; // 224.0.0.0/4 multicast + 240.0.0.0/4 reserved
  return false;
}

function isPrivateIpv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true; // loopback / unspecified
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/); // IPv4-mapped
  if (mapped) return isPrivateIpv4(mapped[1]);
  if (/^fe[89ab]/.test(lower)) return true; // fe80::/10 link-local
  if (/^f[cd]/.test(lower)) return true; // fc00::/7 unique-local
  if (lower.startsWith("ff")) return true; // ff00::/8 multicast
  return false;
}

/** True if the address is private/loopback/link-local/reserved (unsafe to fetch). */
export function isPrivateIp(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) return isPrivateIpv4(ip);
  if (v === 6) return isPrivateIpv6(ip);
  return true; // not a valid IP literal → treat as unsafe
}

/**
 * Validates a user-supplied URL before the server fetches it (SSRF guard).
 * Only http/https are allowed, and the host must not resolve to a private,
 * loopback, link-local, or otherwise internal address.
 *
 * Note: DNS is re-resolved by fetch after this check, so a determined attacker
 * could still exploit DNS rebinding (TOCTOU). This blocks the common cases
 * (metadata endpoints, localhost, RFC1918) without IP-pinning at the socket.
 */
export async function assertPublicUrl(rawUrl: string): Promise<URL> {
  const url = new URL(rawUrl);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http and https URLs are allowed");
  }

  const host = url.hostname.replace(/^\[|\]$/g, ""); // strip IPv6 brackets

  if (isIP(host)) {
    if (isPrivateIp(host)) throw new Error("URL points to a private address");
    return url;
  }

  const lowerHost = host.toLowerCase();
  if (
    lowerHost === "localhost" ||
    lowerHost.endsWith(".localhost") ||
    lowerHost.endsWith(".internal") ||
    lowerHost.endsWith(".local")
  ) {
    throw new Error("URL points to a private address");
  }

  const addresses = await lookup(host, { all: true });
  if (addresses.length === 0) throw new Error("Host could not be resolved");
  for (const { address } of addresses) {
    if (isPrivateIp(address)) throw new Error("URL points to a private address");
  }

  return url;
}

/**
 * fetch() with SSRF protection and manual redirect validation: every hop
 * (including redirect targets) is checked with {@link assertPublicUrl} before
 * the request is made, so an off-site or internal redirect cannot bypass the
 * guard while normal redirects (http→https, apex→www) still work.
 */
export async function safeFetch(
  rawUrl: string,
  init: RequestInit & { maxRedirects?: number } = {},
): Promise<Response> {
  const { maxRedirects = 5, ...rest } = init;
  let current = rawUrl;

  for (let i = 0; i <= maxRedirects; i++) {
    await assertPublicUrl(current);
    const res = await fetch(current, { ...rest, redirect: "manual" });

    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      current = new URL(location, current).toString();
      continue;
    }
    return res;
  }

  throw new Error("Too many redirects");
}
