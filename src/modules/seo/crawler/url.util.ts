import { lookup } from "node:dns/promises";
import net from "node:net";

const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "gclid",
  "gbraid",
  "wbraid",
  "fbclid",
  "msclkid",
  "mc_cid",
  "mc_eid",
  "igshid",
  "yclid",
  "_ga",
  "ref",
  "ref_src",
]);

const NON_HTML_EXTENSIONS = new Set([
  "jpg", "jpeg", "png", "gif", "webp", "avif", "svg", "ico", "bmp", "tiff",
  "css", "js", "mjs", "map", "json", "xml", "txt", "csv",
  "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "zip", "rar", "7z", "gz", "tar",
  "mp3", "mp4", "webm", "avi", "mov", "wmv", "ogg", "wav", "m4a",
  "woff", "woff2", "ttf", "eot", "otf",
]);

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
  "metadata",
  "instance-data",
]);

export interface NormalizedUrl {
  href: string;
  normalized: string;
  origin: string;
  hostname: string;
  path: string;
}

export function normalizeUrl(raw: string, base?: string): NormalizedUrl | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith("mailto:") ||
    lower.startsWith("tel:") ||
    lower.startsWith("javascript:") ||
    lower.startsWith("data:") ||
    lower.startsWith("blob:") ||
    lower.startsWith("whatsapp:") ||
    lower.startsWith("sms:") ||
    lower.startsWith("#")
  ) {
    return null;
  }

  let url: URL;
  try {
    url = base ? new URL(trimmed, base) : new URL(trimmed);
  } catch {
    return null;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  url.hash = "";
  url.username = "";
  url.password = "";
  url.hostname = url.hostname.toLowerCase();

  if ((url.protocol === "http:" && url.port === "80") || (url.protocol === "https:" && url.port === "443")) {
    url.port = "";
  }

  const params = [...url.searchParams.entries()]
    .filter(([key]) => !TRACKING_PARAMS.has(key.toLowerCase()))
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  url.search = "";
  for (const [key, value] of params) url.searchParams.append(key, value);

  const href = url.toString();

  const canonicalHost = url.hostname.startsWith("www.") ? url.hostname.slice(4) : url.hostname;
  let canonicalPath = url.pathname;
  if (canonicalPath.length > 1 && canonicalPath.endsWith("/")) canonicalPath = canonicalPath.slice(0, -1);
  if (!canonicalPath) canonicalPath = "/";
  const normalized = `https://${canonicalHost}${url.port ? `:${url.port}` : ""}${canonicalPath}${url.search}`;

  return {
    href,
    normalized,
    origin: url.origin,
    hostname: url.hostname,
    path: url.pathname || "/",
  };
}

export function registrableHost(hostname: string): string {
  return hostname.toLowerCase().startsWith("www.") ? hostname.toLowerCase().slice(4) : hostname.toLowerCase();
}

export function isSameSite(hostname: string, siteHostname: string, includeSubdomains = false): boolean {
  const a = registrableHost(hostname);
  const b = registrableHost(siteHostname);
  if (a === b) return true;
  return includeSubdomains && a.endsWith(`.${b}`);
}

export function isLikelyNonHtml(url: string): boolean {
  try {
    const { pathname } = new URL(url);
    const lastSegment = pathname.split("/").pop() ?? "";
    const dot = lastSegment.lastIndexOf(".");
    if (dot === -1) return false;
    return NON_HTML_EXTENSIONS.has(lastSegment.slice(dot + 1).toLowerCase());
  } catch {
    return false;
  }
}

export function matchesAnyPattern(url: string, patterns: string[]): boolean {
  return patterns.some((pattern) => {
    if (!pattern) return false;
    try {
      return new RegExp(pattern, "i").test(url);
    } catch {
      return url.includes(pattern);
    }
  });
}

function isPrivateIpv4(address: string): boolean {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) return true;
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 192 && b === 0) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a >= 224) return true;
  return false;
}

function isPrivateIpv6(address: string): boolean {
  const value = address.toLowerCase().split("%")[0];
  if (value === "::" || value === "::1") return true;
  if (value.startsWith("fe8") || value.startsWith("fe9") || value.startsWith("fea") || value.startsWith("feb")) return true;
  if (value.startsWith("fc") || value.startsWith("fd")) return true;
  const mapped = value.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIpv4(mapped[1]);
  return false;
}

export function isPrivateAddress(address: string): boolean {
  const version = net.isIP(address);
  if (version === 4) return isPrivateIpv4(address);
  if (version === 6) return isPrivateIpv6(address);
  return true;
}

export interface UrlSafetyResult {
  safe: boolean;
  reason?: string;
}

/** SSRF guard. Every URL the crawler touches (including each redirect hop) passes through
 *  here so a malicious or compromised target cannot pivot us into the private network. */
export async function assertSafeUrl(rawUrl: string): Promise<UrlSafetyResult> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { safe: false, reason: "Malformed URL" };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { safe: false, reason: `Blocked protocol ${url.protocol}` };
  }
  if (url.username || url.password) {
    return { safe: false, reason: "URLs with embedded credentials are not allowed" };
  }

  const port = url.port ? Number(url.port) : url.protocol === "https:" ? 443 : 80;
  if (port !== 80 && port !== 443) {
    return { safe: false, reason: `Blocked port ${port}` };
  }

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    return { safe: false, reason: `Blocked hostname ${hostname}` };
  }

  if (net.isIP(hostname)) {
    if (isPrivateAddress(hostname)) return { safe: false, reason: `Blocked private address ${hostname}` };
    return { safe: true };
  }

  try {
    const records = await lookup(hostname, { all: true });
    if (!records.length) return { safe: false, reason: `DNS lookup failed for ${hostname}` };
    for (const record of records) {
      if (isPrivateAddress(record.address)) {
        return { safe: false, reason: `${hostname} resolves to a private address` };
      }
    }
  } catch {
    return { safe: false, reason: `DNS lookup failed for ${hostname}` };
  }

  return { safe: true };
}

export function queryVariantKey(normalized: string): string {
  const index = normalized.indexOf("?");
  return index === -1 ? normalized : normalized.slice(0, index);
}

export function hasQueryString(normalized: string): boolean {
  return normalized.includes("?");
}
