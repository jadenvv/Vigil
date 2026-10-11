// SSRF guard for server-side GETs to user-supplied hosts (discover's site seed).
// http/https on ports 80/443 only; the host must resolve, and every address it resolves to must be public.
// Residual risk, accepted: fetch() resolves again (DNS rebinding between our check and the request).
// Self-check: deno run base44/shared/net-guard.ts

const BLOCKED_NAMES = /^(localhost|metadata|metadata\.google\.internal)$|\.(localhost|local|internal|lan|home|corp)$/i;

function v4Blocked(ip: string): boolean {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = p;
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || (a === 198 && (b === 18 || b === 19)) ||
    (a === 192 && b === 0 && p[2] === 0) || a >= 224; // + CGNAT, benchmark, IETF, multicast, reserved
}

/** True for loopback, private, link-local, metadata, CGNAT, multicast/reserved, unparseable. */
export function ipBlocked(raw: string): boolean {
  const ip = raw.replace(/^\[|\]$/g, "").toLowerCase();
  if (/^\d+\.\d+\.\d+\.\d+$/.test(ip)) return v4Blocked(ip);
  if (!ip.includes(":")) return true;
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return v4Blocked(mapped[1]);
  const groups = ip.split(":");
  const first = parseInt(groups[0] || "0", 16);
  // First group 0 covers ::, ::1, IPv4-compatible ::/96 and ::ffff: forms; 64:ff9b:: is NAT64, 2002:: is 6to4.
  if (first === 0 || first === 0x2002 || (first === 0x64 && parseInt(groups[1] || "0", 16) === 0xff9b)) return true;
  return (first & 0xfe00) === 0xfc00 || (first & 0xffc0) === 0xfe80 || (first & 0xffc0) === 0xfec0 ||
    (first & 0xff00) === 0xff00; // ULA, link-local, site-local, multicast
}

/** null when the URL is safe to GET, else a short reason. Resolves the host (A + AAAA). */
export async function unsafeUrl(url: string): Promise<string | null> {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return "bad url";
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return "scheme";
  if (u.port && u.port !== "80" && u.port !== "443") return "port";
  if (u.username || u.password) return "credentials in url";
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (BLOCKED_NAMES.test(host)) return "blocked host";
  if (/^[\d.]+$/.test(host) || host.includes(":")) return ipBlocked(host) ? "private address" : null;
  const addrs: string[] = [];
  for (const type of ["A", "AAAA"] as const) {
    try {
      addrs.push(...await Deno.resolveDns(host, type));
    } catch { /* no record of this type */ }
  }
  if (addrs.length === 0) return "does not resolve";
  return addrs.some(ipBlocked) ? "private address" : null;
}

if (import.meta.main) {
  const eq = (a: unknown, b: unknown, what: string) => {
    if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${what}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`);
  };
  for (const ip of ["10.0.0.1", "172.16.5.4", "172.31.255.255", "192.168.1.1", "127.0.0.1", "169.254.169.254", "0.0.0.0",
    "100.64.0.1", "198.18.0.1", "192.0.0.8", "::1", "::", "fc00::1", "fd12::3", "fe80::1", "fec0::1", "::ffff:127.0.0.1",
    "::ffff:10.1.2.3", "::7f00:1", "::127.0.0.1", "64:ff9b::7f00:1", "2002:7f00:1::", "999.1.1.1", "nonsense"]) {
    eq(ipBlocked(ip), true, `blocked ${ip}`);
  }
  for (const ip of ["8.8.8.8", "172.32.0.1", "185.199.108.153", "2606:50c0:8000::153", "::ffff:8.8.8.8"]) eq(ipBlocked(ip), false, `public ${ip}`);
  eq(await unsafeUrl("ftp://example.com/"), "scheme", "scheme");
  eq(await unsafeUrl("https://example.com:8443/"), "port", "port");
  eq(await unsafeUrl("http://169.254.169.254/latest/meta-data/"), "private address", "metadata ip");
  eq(await unsafeUrl("http://[::1]/"), "private address", "v6 loopback");
  eq(await unsafeUrl("http://localhost/"), "blocked host", "localhost");
  eq(await unsafeUrl("http://metadata.google.internal/"), "blocked host", "gcp metadata");
  eq(await unsafeUrl("https://user:pw@example.com/"), "credentials in url", "creds");
  console.log("net-guard.ts self-check: ok");
}
