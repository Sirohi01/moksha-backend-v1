import type { ParsedPage } from "../crawler/parser";
import type { BrowserProblem } from "../crawler/renderer";

export interface KeywordUsage {
  keyword: string;
  source: "configured_primary" | "configured_secondary" | "search_console";
  presentInTitle: boolean;
  presentInMetaDescription: boolean;
  presentInH1: boolean;
  presentInHeadings: boolean;
  presentInOpeningContent: boolean;
  presentInImageAlt: boolean;
  presentInInternalAnchor: boolean;
  exactMentions: number;
  totalWordCount: number;
  densityPercent: number;
}

function includesPhrase(value: string | null | undefined, keyword: string): boolean {
  return Boolean(value?.toLocaleLowerCase().includes(keyword.toLocaleLowerCase()));
}

function exactMentions(text: string, keyword: string): number {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.match(new RegExp(`(^|\\W)${escaped}(?=$|\\W)`, "giu"))?.length ?? 0;
}

export function analyzeKeywords(
  parsed: ParsedPage | null,
  targets: Array<{ keyword: string; source: KeywordUsage["source"] }>,
): { available: boolean; targets: KeywordUsage[] } {
  if (!parsed || targets.length === 0) return { available: false, targets: [] };
  const unique = [...new Map(targets.map((target) => [target.keyword.trim().toLocaleLowerCase(), target])).values()]
    .filter((target) => target.keyword.trim())
    .slice(0, 12);
  return {
    available: unique.length > 0,
    targets: unique.map(({ keyword, source }) => {
      const mentions = exactMentions(parsed.bodyTextSample, keyword);
      return {
        keyword,
        source,
        presentInTitle: includesPhrase(parsed.title, keyword),
        presentInMetaDescription: includesPhrase(parsed.metaDescription, keyword),
        presentInH1: parsed.headings.h1.some((value) => includesPhrase(value, keyword)),
        presentInHeadings: [...parsed.headings.h2, ...parsed.headings.h3].some((value) => includesPhrase(value, keyword)),
        presentInOpeningContent: includesPhrase(parsed.openingTextSample, keyword),
        presentInImageAlt: parsed.images.some((image) => includesPhrase(image.alt, keyword)),
        presentInInternalAnchor: parsed.links.some((link) => link.isInternal && includesPhrase(link.anchorText, keyword)),
        exactMentions: mentions,
        totalWordCount: parsed.wordCount,
        densityPercent: parsed.wordCount > 0 ? Number(((mentions / parsed.wordCount) * 100).toFixed(2)) : 0,
      };
    }),
  };
}

export function socialStatus(parsed: ParsedPage | null, pageUrl: string) {
  if (!parsed) return { openGraph: "not_available", twitter: "not_available" } as const;
  const absolute = (value: string | null) => {
    if (!value) return false;
    try { return Boolean(new URL(value, pageUrl).protocol.match(/^https?:$/)); } catch { return false; }
  };
  const openGraphProblems = [!parsed.ogTitle, !parsed.ogDescription, !parsed.ogImage, !parsed.ogUrl, !parsed.ogType, parsed.ogImage && !absolute(parsed.ogImage)].filter(Boolean).length;
  const twitterProblems = [!parsed.twitterCard, !parsed.twitterTitle, !parsed.twitterDescription, !parsed.twitterImage, parsed.twitterImage && !absolute(parsed.twitterImage)].filter(Boolean).length;
  return { openGraph: openGraphProblems ? "incomplete" : "valid", twitter: twitterProblems ? "incomplete" : "valid" } as const;
}

export function detectCdn(headers: Record<string, string>, assetUrls: string[]) {
  const evidence: string[] = [];
  let provider: string | null = null;
  const match = (name: string, indicators: string[]) => {
    const found = indicators.filter((indicator) => headers[indicator] != null);
    if (found.length && !provider) provider = name;
    evidence.push(...found.map((indicator) => `${indicator}: ${headers[indicator]}`));
  };
  match("Cloudflare", ["cf-ray", "cf-cache-status"]);
  match("CloudFront", ["x-amz-cf-id", "x-amz-cf-pop"]);
  match("Fastly", ["x-served-by", "x-cache-hits"]);
  match("Akamai", ["akamai-grn", "x-akamai-transformed"]);
  match("Vercel", ["x-vercel-id", "x-vercel-cache"]);
  match("Netlify", ["x-nf-request-id", "netlify-vary"]);
  const server = headers.server ?? "";
  if (!provider && /cloudflare/i.test(server)) { provider = "Cloudflare"; evidence.push(`server: ${server}`); }
  if (!provider && /vercel/i.test(server)) { provider = "Vercel"; evidence.push(`server: ${server}`); }
  if (!provider && /netlify/i.test(server)) { provider = "Netlify"; evidence.push(`server: ${server}`); }
  if (!provider && /akamai/i.test(server)) { provider = "Akamai"; evidence.push(`server: ${server}`); }
  const hostEvidence = assetUrls.map((url) => { try { return new URL(url).hostname; } catch { return ""; } })
    .filter((host) => /(cloudfront|cloudflare|fastly|akamai|vercel|netlify|cdn)/i.test(host));
  evidence.push(...[...new Set(hostEvidence)].slice(0, 10).map((host) => `asset hostname: ${host}`));
  return {
    status: provider ? "detected" : hostEvidence.length ? "likely" : "no_indicators",
    provider,
    evidence: evidence.slice(0, 20),
    cacheControl: headers["cache-control"] ?? null,
    server: headers.server ?? null,
  };
}

export function groupBrowserProblems(problems: BrowserProblem[]) {
  return {
    consoleErrors: problems.filter((item) => item.type === "console_error"),
    consoleWarnings: problems.filter((item) => item.type === "console_warning"),
    jsExceptions: problems.filter((item) => item.type === "js_exception"),
    failedRequests: problems.filter((item) => item.type === "failed_request"),
  };
}
