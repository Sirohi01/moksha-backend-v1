import { checkUrlStatus, mapWithConcurrency, FetchHop } from "./fetcher";

export type LinkStatusClass = "ok" | "redirect" | "broken" | "server_error" | "timeout" | "unchecked";

export interface LinkCheckResult {
  normalized: string;
  url: string;
  status: number | null;
  statusClass: LinkStatusClass;
  redirectsTo: string | null;
  hops: FetchHop[];
  hopCount: number;
  isBroken: boolean;
  isLoop: boolean;
  error: string | null;
  checkedAt: Date;
}

export interface RedirectChainResult {
  sourceUrl: string;
  hops: FetchHop[];
  hopCount: number;
  finalUrl: string | null;
  finalStatus: number | null;
  isLoop: boolean;
  endsInError: boolean;
  issues: string[];
  severity: "critical" | "warning" | "notice" | "none";
}

export function classifyStatus(status: number | null, error: string | null, timedOut: boolean): LinkStatusClass {
  if (timedOut) return "timeout";
  if (status == null) return error ? "broken" : "unchecked";
  if (status >= 200 && status < 300) return "ok";
  if (status >= 300 && status < 400) return "redirect";
  if (status >= 400 && status < 500) return "broken";
  if (status >= 500) return "server_error";
  return "unchecked";
}

export interface LinkTarget {
  url: string;
  normalized: string;
  isInternal: boolean;
}

export async function checkLinks(
  targets: LinkTarget[],
  options: {
    concurrency: number;
    timeoutMs: number;
    checkExternal: boolean;
    known?: Map<string, LinkCheckResult>;
  },
): Promise<Map<string, LinkCheckResult>> {
  const results = new Map<string, LinkCheckResult>(options.known ?? []);
  const pending = targets.filter((target) => {
    if (results.has(target.normalized)) return false;
    if (!target.isInternal && !options.checkExternal) return false;
    return true;
  });

  const deduped = new Map<string, LinkTarget>();
  for (const target of pending) deduped.set(target.normalized, target);

  await mapWithConcurrency([...deduped.values()], options.concurrency, async (target) => {
    const outcome = await checkUrlStatus(target.url, options.timeoutMs);
    const statusClass = classifyStatus(outcome.status, outcome.error, outcome.timedOut);
    results.set(target.normalized, {
      normalized: target.normalized,
      url: target.url,
      status: outcome.status,
      statusClass,
      redirectsTo: outcome.hops.length > 1 ? outcome.finalUrl : null,
      hops: outcome.hops,
      hopCount: Math.max(0, outcome.hops.length - 1),
      isBroken: statusClass === "broken" || statusClass === "server_error" || statusClass === "timeout",
      isLoop: outcome.isLoop,
      error: outcome.error,
      checkedAt: new Date(),
    });
  });

  return results;
}

export function buildRedirectChain(sourceUrl: string, result: LinkCheckResult, siteHostname: string): RedirectChainResult | null {
  if (result.hopCount < 1 && !result.isLoop) return null;

  const issues: string[] = [];
  const finalHop = result.hops[result.hops.length - 1];
  const finalStatus = result.isLoop ? null : finalHop?.status ?? result.status;
  const finalUrl = result.isLoop ? null : result.redirectsTo ?? finalHop?.url ?? null;

  if (result.isLoop) issues.push("Redirect loop");
  if (result.hopCount > 1) issues.push(`${result.hopCount} redirect hops`);
  if (finalStatus != null && finalStatus >= 400 && finalStatus < 500) issues.push(`Redirect ends at ${finalStatus}`);
  if (finalStatus != null && finalStatus >= 500) issues.push(`Redirect ends at server error ${finalStatus}`);

  const hopUrls = result.hops.map((hop) => hop.url);
  const protocolChanges = hopUrls.filter((url, index) => {
    if (index === 0) return false;
    return url.startsWith("https:") && hopUrls[index - 1].startsWith("http:");
  }).length;
  const hostChanges = hopUrls.filter((url, index) => {
    if (index === 0) return false;
    try {
      return new URL(url).hostname !== new URL(hopUrls[index - 1]).hostname;
    } catch {
      return false;
    }
  }).length;

  if (protocolChanges > 0 && result.hopCount > 1) {
    issues.push("HTTP to HTTPS upgrade followed by further redirects");
  }
  if (hostChanges > 0 && result.hopCount > 1) {
    const normalizedHost = siteHostname.replace(/^www\./, "");
    const involvesWww = hopUrls.some((url) => {
      try {
        const host = new URL(url).hostname;
        return host === `www.${normalizedHost}` || host === normalizedHost;
      } catch {
        return false;
      }
    });
    if (involvesWww) issues.push("www/non-www redirect combined with additional hops");
  }

  const endsInError = finalStatus != null && finalStatus >= 400;
  let severity: RedirectChainResult["severity"] = "none";
  if (result.isLoop || endsInError) severity = "critical";
  else if (result.hopCount > 1) severity = "warning";
  else if (issues.length) severity = "notice";

  return {
    sourceUrl,
    hops: result.hops,
    hopCount: result.hopCount,
    finalUrl,
    finalStatus,
    isLoop: result.isLoop,
    endsInError,
    issues,
    severity,
  };
}
