import type { SeoIssueCategory, SeoIssueSeverity } from "../../../models/seoIssue.model";
import type { CrawlEdge, CrawledPage } from "../crawler/crawler";
import type { LinkCheckResult, RedirectChainResult } from "../crawler/linkChecker";
import type { RobotsTxt } from "../crawler/robots.util";
import { isAllowedByRobots } from "../crawler/robots.util";
import { hammingDistanceHex } from "../crawler/parser";
import { normalizeUrl } from "../crawler/url.util";
import type { SiteGraph } from "./graph";

export const RULE_THRESHOLDS = {
  titleMin: 30,
  titleMax: 60,
  descriptionMin: 70,
  descriptionMax: 160,
  thinContentWords: 250,
  maxLinksPerPage: 150,
  minInternalOutLinks: 3,
  deepCrawlDepth: 4,
  slowResponseMs: 1500,
  nearDuplicateHamming: 3,
  poorLcpMs: 4000,
  poorCls: 0.25,
  lowPerformanceScore: 50,
  genericAnchorRepeat: 3,
} as const;

export interface PerformanceSummary {
  normalizedUrl: string;
  performance: number | null;
  lcpMs: number | null;
  clsScore: number | null;
  inpMs: number | null;
  fieldAvailable: boolean;
  renderBlockingCount: number;
}

export interface DetectedIssue {
  ruleId: string;
  category: SeoIssueCategory;
  severity: SeoIssueSeverity;
  title: string;
  detail: string;
  evidence: Record<string, unknown>;
  url: string | null;
  scope: "page" | "site";
}

export interface RulesContext {
  origin: string;
  hostname: string;
  pages: CrawledPage[];
  edges: CrawlEdge[];
  graph: SiteGraph;
  linkResults: Map<string, LinkCheckResult>;
  redirectChains: RedirectChainResult[];
  sitemapUrls: Set<string>;
  sitemapFound: boolean;
  robots: RobotsTxt;
  performance: Map<string, PerformanceSummary>;
  keywordAnalyses: Map<string, { available: boolean; targets: Array<{
    keyword: string;
    source: string;
    presentInTitle: boolean;
    presentInMetaDescription: boolean;
    presentInH1: boolean;
    presentInHeadings: boolean;
    presentInOpeningContent: boolean;
    exactMentions: number;
    totalWordCount: number;
    densityPercent: number;
  }> }>;
}

function issue(
  ruleId: string,
  category: SeoIssueCategory,
  severity: SeoIssueSeverity,
  title: string,
  detail: string,
  evidence: Record<string, unknown>,
  url: string | null,
  scope: "page" | "site" = "page",
): DetectedIssue {
  return { ruleId, category, severity, title, detail, evidence, url, scope };
}

function isIndexablePage(page: CrawledPage): boolean {
  if (page.blockedByRobots) return false;
  if (page.status !== 200 || !page.isHtml || !page.parsed) return false;
  const robots = page.parsed.metaRobots?.toLowerCase() ?? "";
  return !robots.includes("noindex");
}

export function computeIndexability(page: CrawledPage, robots: RobotsTxt, respectRobots: boolean): {
  indexable: boolean;
  reason: string | null;
} {
  if (page.blockedByRobots) return { indexable: false, reason: "Blocked by robots.txt" };
  if (respectRobots && robots.found && !isAllowedByRobots(robots, page.url)) {
    return { indexable: false, reason: "Blocked by robots.txt" };
  }
  if (page.status == null) return { indexable: false, reason: page.fetchError ?? "Page could not be fetched" };
  if (page.status >= 400) return { indexable: false, reason: `HTTP ${page.status}` };
  if (page.status >= 300) return { indexable: false, reason: `Redirects (HTTP ${page.status})` };
  if (!page.isHtml) return { indexable: false, reason: "Not an HTML document" };
  const metaRobots = page.parsed?.metaRobots?.toLowerCase() ?? "";
  if (metaRobots.includes("noindex")) return { indexable: false, reason: "noindex meta robots tag" };
  return { indexable: true, reason: null };
}

export function runRules(context: RulesContext): DetectedIssue[] {
  const issues: DetectedIssue[] = [];
  const { pages, graph, linkResults, sitemapUrls, robots } = context;

  const pageByNormalized = new Map(pages.map((page) => [page.normalizedUrl, page]));
  const htmlPages = pages.filter((page) => page.isHtml && page.parsed && page.status === 200);

  runSiteRules(context, issues, htmlPages);

  const titleGroups = new Map<string, string[]>();
  const descriptionGroups = new Map<string, string[]>();
  const contentGroups = new Map<string, string[]>();

  for (const page of htmlPages) {
    const parsed = page.parsed!;
    if (parsed.titleHash) {
      if (!titleGroups.has(parsed.titleHash)) titleGroups.set(parsed.titleHash, []);
      titleGroups.get(parsed.titleHash)!.push(page.normalizedUrl);
    }
    if (parsed.descriptionHash) {
      if (!descriptionGroups.has(parsed.descriptionHash)) descriptionGroups.set(parsed.descriptionHash, []);
      descriptionGroups.get(parsed.descriptionHash)!.push(page.normalizedUrl);
    }
    if (parsed.textHash && parsed.wordCount > 50) {
      if (!contentGroups.has(parsed.textHash)) contentGroups.set(parsed.textHash, []);
      contentGroups.get(parsed.textHash)!.push(page.normalizedUrl);
    }
  }

  for (const page of pages) {
    if (page.blockedByRobots) {
      issues.push(
        issue(
          "PAGE_BLOCKED_BY_ROBOTS",
          "indexing",
          sitemapUrls.has(page.normalizedUrl) ? "critical" : "warning",
          "Page blocked by robots.txt",
          sitemapUrls.has(page.normalizedUrl)
            ? "This URL is listed in sitemap.xml but robots.txt prevents crawling it."
            : "robots.txt prevents this URL from being crawled.",
          { inSitemap: sitemapUrls.has(page.normalizedUrl) },
          page.normalizedUrl,
        ),
      );
      continue;
    }

    if (page.status == null) {
      issues.push(
        issue(
          page.timedOut ? "PAGE_TIMEOUT" : "PAGE_FETCH_FAILED",
          "indexing",
          "critical",
          page.timedOut ? "Page request timed out" : "Page could not be fetched",
          page.fetchError ?? "The crawler received no HTTP response.",
          { error: page.fetchError, timedOut: page.timedOut, blocked: page.blocked },
          page.normalizedUrl,
        ),
      );
      continue;
    }

    if (page.status >= 400) {
      issues.push(
        issue(
          page.status >= 500 ? "PAGE_SERVER_ERROR" : "PAGE_NOT_FOUND",
          "indexing",
          "critical",
          page.status >= 500 ? `Page returns server error ${page.status}` : `Page returns ${page.status}`,
          `The crawler discovered this URL but it responded with HTTP ${page.status}.`,
          { status: page.status, inSitemap: sitemapUrls.has(page.normalizedUrl) },
          page.normalizedUrl,
        ),
      );
      continue;
    }

    if (page.redirected && page.hops.length > 1) {
      const hopCount = page.hops.length - 1;
      if (hopCount > 1) {
        issues.push(
          issue(
            "PAGE_REDIRECT_CHAIN",
            "links",
            "warning",
            `Page redirects through ${hopCount} hops`,
            "Multi-hop redirects waste crawl budget and slow down users.",
            { hops: page.hops.map((hop) => ({ url: hop.url, status: hop.status })), finalUrl: page.finalUrl },
            page.normalizedUrl,
          ),
        );
      }
    }

    if (!page.isHtml || !page.parsed) continue;

    runPageRules(page, context, issues, {
      titleGroups,
      descriptionGroups,
      contentGroups,
      pageByNormalized,
    });
  }

  runDuplicateContentRules(htmlPages, issues);
  runLinkRules(context, issues, pageByNormalized);
  runRedirectRules(context, issues);
  runGraphRules(context, issues, htmlPages);
  runPerformanceRules(context, issues);

  void linkResults;
  void robots;
  void graph;

  return issues;
}

function runSiteRules(context: RulesContext, issues: DetectedIssue[], htmlPages: CrawledPage[]): void {
  if (!context.sitemapFound) {
    issues.push(
      issue(
        "SITEMAP_MISSING",
        "structure",
        "critical",
        "sitemap.xml could not be read",
        "Search engines use the sitemap to discover pages. No readable sitemap was found at /sitemap.xml.",
        { origin: context.origin },
        null,
        "site",
      ),
    );
  }

  if (!context.robots.found) {
    issues.push(
      issue(
        "ROBOTS_MISSING",
        "structure",
        "notice",
        "robots.txt could not be read",
        context.robots.fetchError ?? "No robots.txt was returned for this site.",
        { error: context.robots.fetchError },
        null,
        "site",
      ),
    );
  }

  if (context.sitemapFound && context.sitemapUrls.size > 0) {
    const crawled = new Set(htmlPages.map((page) => page.normalizedUrl));
    const missing = [...context.sitemapUrls].filter((url) => !crawled.has(url));
    if (missing.length) {
      issues.push(
        issue(
          "SITEMAP_URLS_UNREACHABLE",
          "structure",
          "warning",
          `${missing.length} sitemap URL(s) did not return a crawlable page`,
          "URLs listed in sitemap.xml should return HTTP 200 HTML that the crawler can read.",
          { urls: missing.slice(0, 50), count: missing.length },
          null,
          "site",
        ),
      );
    }
  }
}

interface DuplicateGroups {
  titleGroups: Map<string, string[]>;
  descriptionGroups: Map<string, string[]>;
  contentGroups: Map<string, string[]>;
  pageByNormalized: Map<string, CrawledPage>;
}

function runPageRules(
  page: CrawledPage,
  context: RulesContext,
  issues: DetectedIssue[],
  groups: DuplicateGroups,
): void {
  const parsed = page.parsed!;
  const url = page.normalizedUrl;

  if (!parsed.title) {
    issues.push(issue("TITLE_MISSING", "metadata", "critical", "Missing title tag", "The page has no <title> element.", {}, url));
  } else {
    if (parsed.titleLength < RULE_THRESHOLDS.titleMin) {
      issues.push(
        issue(
          "TITLE_TOO_SHORT",
          "metadata",
          "warning",
          "Title tag is too short",
          `The title is ${parsed.titleLength} characters; aim for ${RULE_THRESHOLDS.titleMin}-${RULE_THRESHOLDS.titleMax}.`,
          { length: parsed.titleLength, title: parsed.title },
          url,
        ),
      );
    } else if (parsed.titleLength > RULE_THRESHOLDS.titleMax) {
      issues.push(
        issue(
          "TITLE_TOO_LONG",
          "metadata",
          "warning",
          "Title tag is too long",
          `The title is ${parsed.titleLength} characters and will likely be truncated in search results.`,
          { length: parsed.titleLength, title: parsed.title },
          url,
        ),
      );
    }
    const duplicates = parsed.titleHash ? groups.titleGroups.get(parsed.titleHash) ?? [] : [];
    if (duplicates.length > 1) {
      issues.push(
        issue(
          "TITLE_DUPLICATE",
          "metadata",
          "warning",
          "Duplicate title tag",
          `${duplicates.length} pages share this exact title.`,
          { title: parsed.title, pages: duplicates.slice(0, 20), count: duplicates.length },
          url,
        ),
      );
    }
  }

  if (!parsed.metaDescription) {
    issues.push(
      issue("DESCRIPTION_MISSING", "metadata", "warning", "Missing meta description", "The page has no meta description.", {}, url),
    );
  } else {
    if (parsed.metaDescriptionLength < RULE_THRESHOLDS.descriptionMin) {
      issues.push(
        issue(
          "DESCRIPTION_TOO_SHORT",
          "metadata",
          "notice",
          "Meta description is too short",
          `The description is ${parsed.metaDescriptionLength} characters; aim for ${RULE_THRESHOLDS.descriptionMin}-${RULE_THRESHOLDS.descriptionMax}.`,
          { length: parsed.metaDescriptionLength },
          url,
        ),
      );
    } else if (parsed.metaDescriptionLength > RULE_THRESHOLDS.descriptionMax) {
      issues.push(
        issue(
          "DESCRIPTION_TOO_LONG",
          "metadata",
          "notice",
          "Meta description is too long",
          `The description is ${parsed.metaDescriptionLength} characters and will be truncated.`,
          { length: parsed.metaDescriptionLength },
          url,
        ),
      );
    }
    const duplicates = parsed.descriptionHash ? groups.descriptionGroups.get(parsed.descriptionHash) ?? [] : [];
    if (duplicates.length > 1) {
      issues.push(
        issue(
          "DESCRIPTION_DUPLICATE",
          "metadata",
          "warning",
          "Duplicate meta description",
          `${duplicates.length} pages share this exact meta description.`,
          { pages: duplicates.slice(0, 20), count: duplicates.length },
          url,
        ),
      );
    }
  }

  const metaRobots = parsed.metaRobots?.toLowerCase() ?? "";
  if (metaRobots.includes("noindex")) {
    const inSitemap = context.sitemapUrls.has(url);
    issues.push(
      issue(
        inSitemap ? "SITEMAP_NOINDEX_CONFLICT" : "PAGE_NOINDEX",
        "indexing",
        inSitemap ? "critical" : "warning",
        inSitemap ? "Sitemap URL is marked noindex" : "Page is marked noindex",
        inSitemap
          ? "This URL is advertised in sitemap.xml but its robots meta tag tells search engines not to index it."
          : "The robots meta tag prevents this page from being indexed.",
        { metaRobots: parsed.metaRobots, inSitemap },
        url,
      ),
    );
  }

  if (!context.sitemapUrls.has(url) && isIndexablePage(page) && context.sitemapFound) {
    issues.push(
      issue(
        "PAGE_NOT_IN_SITEMAP",
        "structure",
        "notice",
        "Indexable page is missing from sitemap.xml",
        "Adding indexable pages to the sitemap helps search engines discover them.",
        {},
        url,
      ),
    );
  }

  runCanonicalRules(page, context, issues, groups.pageByNormalized);
  runHeadingRules(page, issues);
  runContentRules(page, issues);
  runImageRules(page, issues);
  runSchemaRules(page, issues);
  runTechnicalRules(page, context, issues);
  runKeywordRules(page, context, issues);
}

function runKeywordRules(page: CrawledPage, context: RulesContext, issues: DetectedIssue[]): void {
  const analysis = context.keywordAnalyses.get(page.normalizedUrl);
  if (!analysis?.available) return;
  for (const target of analysis.targets) {
    const isConfigured = target.source === "configured_primary" || target.source === "configured_secondary";
    if (!isConfigured) continue;
    if (!target.presentInTitle && !target.presentInH1 && !target.presentInMetaDescription) {
      issues.push(issue("KEYWORD_MISSING_MAIN_SIGNALS", "content", "warning", "Target keyword absent from main page signals", `“${target.keyword}” was not measured in the title, meta description or H1.`, { keyword: target.keyword, source: target.source }, page.normalizedUrl));
    } else if (target.source === "configured_primary" && !target.presentInTitle) {
      issues.push(issue("PRIMARY_KEYWORD_MISSING_TITLE", "content", "warning", "Primary keyword missing from title", `“${target.keyword}” was not measured in the title.`, { keyword: target.keyword }, page.normalizedUrl));
    }
    if (target.source === "configured_primary" && !target.presentInH1) {
      issues.push(issue("PRIMARY_KEYWORD_MISSING_H1", "content", "warning", "Primary keyword missing from H1", `“${target.keyword}” was not measured in an H1.`, { keyword: target.keyword }, page.normalizedUrl));
    }
    if (target.totalWordCount >= 100 && target.densityPercent > 4 && target.exactMentions >= 8) {
      issues.push(issue("KEYWORD_OVERUSED", "content", "warning", "Target keyword may be overused", `“${target.keyword}” appeared ${target.exactMentions} times (${target.densityPercent}% exact-match density).`, { keyword: target.keyword, exactMentions: target.exactMentions, densityPercent: target.densityPercent, totalWordCount: target.totalWordCount }, page.normalizedUrl));
    }
  }
}

function runCanonicalRules(
  page: CrawledPage,
  context: RulesContext,
  issues: DetectedIssue[],
  pageByNormalized: Map<string, CrawledPage>,
): void {
  const parsed = page.parsed!;
  const url = page.normalizedUrl;
  const canonicals = parsed.canonicals;

  if (!canonicals.length) {
    issues.push(
      issue(
        "CANONICAL_MISSING",
        "canonical",
        "warning",
        "Missing canonical tag",
        "Without a self-referencing canonical, duplicate URL variants can compete with each other.",
        {},
        url,
      ),
    );
    return;
  }

  if (canonicals.length > 1) {
    const unique = [...new Set(canonicals)];
    if (unique.length > 1) {
      issues.push(
        issue(
          "CANONICAL_MULTIPLE",
          "canonical",
          "critical",
          "Multiple conflicting canonical tags",
          `The page declares ${unique.length} different canonical URLs, so search engines will ignore all of them.`,
          { canonicals: unique },
          url,
        ),
      );
    } else {
      issues.push(
        issue(
          "CANONICAL_DUPLICATED",
          "canonical",
          "notice",
          "Canonical tag is declared more than once",
          "The same canonical URL is repeated; keep exactly one canonical link element.",
          { canonicals, count: canonicals.length },
          url,
        ),
      );
    }
  }

  const rawCanonical = canonicals[0];
  const resolved = normalizeUrl(rawCanonical, page.finalUrl ?? page.url);

  if (!resolved) {
    issues.push(
      issue(
        "CANONICAL_MALFORMED",
        "canonical",
        "critical",
        "Canonical URL is malformed",
        `"${rawCanonical}" could not be parsed as an absolute HTTP(S) URL.`,
        { canonical: rawCanonical },
        url,
      ),
    );
    return;
  }

  if (resolved.href.startsWith("http://")) {
    issues.push(
      issue(
        "CANONICAL_NOT_HTTPS",
        "canonical",
        "warning",
        "Canonical points to an HTTP URL",
        "The canonical should use HTTPS to match the secure version of the site.",
        { canonical: resolved.href },
        url,
      ),
    );
  }

  const isSelf = resolved.normalized === url;
  if (!isSelf) {
    const target = pageByNormalized.get(resolved.normalized);
    const linkResult = context.linkResults.get(resolved.normalized);
    const targetStatus = target?.status ?? linkResult?.status ?? null;

    if (targetStatus != null && targetStatus >= 400) {
      issues.push(
        issue(
          "CANONICAL_TO_ERROR",
          "canonical",
          "critical",
          `Canonical points to a ${targetStatus} page`,
          "A canonical must point to a URL that returns HTTP 200, otherwise the signal is discarded.",
          { canonical: resolved.href, status: targetStatus },
          url,
        ),
      );
    } else if ((targetStatus != null && targetStatus >= 300 && targetStatus < 400) || (linkResult?.hopCount ?? 0) > 0) {
      issues.push(
        issue(
          "CANONICAL_TO_REDIRECT",
          "canonical",
          "warning",
          "Canonical points to a redirecting URL",
          "Point the canonical at the final destination URL instead of a redirect.",
          { canonical: resolved.href, status: targetStatus, redirectsTo: linkResult?.redirectsTo ?? null },
          url,
        ),
      );
    } else if (target && target.parsed?.metaRobots?.toLowerCase().includes("noindex")) {
      issues.push(
        issue(
          "CANONICAL_TO_NOINDEX",
          "canonical",
          "critical",
          "Canonical points to a noindex page",
          "Consolidating to a page that is excluded from the index removes this page from search results too.",
          { canonical: resolved.href },
          url,
        ),
      );
    } else if (context.robots.found && !isAllowedByRobots(context.robots, resolved.href)) {
      issues.push(
        issue(
          "CANONICAL_BLOCKED_BY_ROBOTS",
          "canonical",
          "warning",
          "Canonical points to a URL blocked by robots.txt",
          "Search engines cannot verify a canonical target they are not allowed to crawl.",
          { canonical: resolved.href },
          url,
        ),
      );
    } else {
      issues.push(
        issue(
          "CANONICAL_MISMATCH",
          "canonical",
          "warning",
          "Canonical points to a different page",
          `This page declares ${resolved.normalized} as canonical, so it will not be indexed under its own URL.`,
          { canonical: resolved.href, canonicalNormalized: resolved.normalized, pageUrl: url },
          url,
        ),
      );
    }
  }

  if (isSelf && parsed.metaRobots?.toLowerCase().includes("noindex")) {
    issues.push(
      issue(
        "CANONICAL_NOINDEX_CONFLICT",
        "canonical",
        "warning",
        "Self-canonical combined with noindex",
        "A self-referencing canonical contradicts the noindex directive; keep only the intended signal.",
        { canonical: resolved.href, metaRobots: parsed.metaRobots },
        url,
      ),
    );
  }
}

function runHeadingRules(page: CrawledPage, issues: DetectedIssue[]): void {
  const headings = page.parsed!.headings;
  const url = page.normalizedUrl;

  if (headings.counts.h1 === 0) {
    issues.push(
      issue("H1_MISSING", "headings", "warning", "Page has no H1", "Every indexable page should state its main topic in an H1.", { counts: headings.counts }, url),
    );
  } else if (headings.counts.h1 > 1) {
    issues.push(
      issue(
        "H1_MULTIPLE",
        "headings",
        "warning",
        `Page has ${headings.counts.h1} H1 elements`,
        "Multiple H1s blur the page's primary topic. Confirm the extra H1s are intentional landmarks.",
        { count: headings.counts.h1, headings: headings.h1 },
        url,
      ),
    );
  }

  if (headings.emptyCount > 0) {
    issues.push(
      issue("HEADING_EMPTY", "headings", "notice", `${headings.emptyCount} empty heading element(s)`, "Empty headings add no structure and confuse assistive technology.", { count: headings.emptyCount }, url),
    );
  }

  if (headings.skippedLevels.length) {
    issues.push(
      issue(
        "HEADING_HIERARCHY_SKIP",
        "headings",
        "notice",
        "Heading levels are skipped",
        headings.skippedLevels.map((skip) => `H${skip.from} to H${skip.to}`).join(", "),
        { skips: headings.skippedLevels },
        url,
      ),
    );
  }

  if (headings.duplicates.length) {
    issues.push(
      issue("HEADING_DUPLICATE_TEXT", "headings", "notice", "Repeated heading text", `${headings.duplicates.length} heading text(s) appear more than once.`, { duplicates: headings.duplicates }, url),
    );
  }

  if (headings.longHeadings.length) {
    issues.push(
      issue("HEADING_TOO_LONG", "headings", "notice", "Very long heading text", `${headings.longHeadings.length} heading(s) exceed 110 characters.`, { headings: headings.longHeadings }, url),
    );
  }

  if (page.parsed!.wordCount >= 300 && headings.sequence.length < 2) {
    issues.push(
      issue(
        "HEADING_STRUCTURE_WEAK",
        "headings",
        "notice",
        "Long content with almost no headings",
        `The page has ${page.parsed!.wordCount} words but only ${headings.sequence.length} heading(s), so the content has no scannable structure.`,
        { wordCount: page.parsed!.wordCount, headingCount: headings.sequence.length },
        url,
      ),
    );
  }
}

function runContentRules(page: CrawledPage, issues: DetectedIssue[]): void {
  const parsed = page.parsed!;
  if (parsed.wordCount < RULE_THRESHOLDS.thinContentWords) {
    issues.push(
      issue(
        "THIN_CONTENT",
        "content",
        "warning",
        "Thin content",
        `The page has ${parsed.wordCount} words of visible text (threshold ${RULE_THRESHOLDS.thinContentWords}).`,
        { wordCount: parsed.wordCount, renderedWithJs: page.renderedWithJs },
        page.normalizedUrl,
      ),
    );
  }
}

function runDuplicateContentRules(htmlPages: CrawledPage[], issues: DetectedIssue[]): void {
  const exact = new Map<string, string[]>();
  for (const page of htmlPages) {
    const hash = page.parsed!.textHash;
    if (!hash || page.parsed!.wordCount < 50) continue;
    if (!exact.has(hash)) exact.set(hash, []);
    exact.get(hash)!.push(page.normalizedUrl);
  }

  for (const [, urls] of exact) {
    if (urls.length < 2) continue;
    for (const url of urls) {
      issues.push(
        issue(
          "DUPLICATE_CONTENT",
          "content",
          "critical",
          "Exact duplicate content",
          `${urls.length} pages share identical visible text.`,
          { pages: urls.slice(0, 20), count: urls.length },
          url,
        ),
      );
    }
  }

  const candidates = htmlPages.filter((page) => page.parsed!.wordCount >= 100 && page.parsed!.simhash);
  const reported = new Set<string>();
  for (let i = 0; i < candidates.length; i += 1) {
    for (let j = i + 1; j < candidates.length; j += 1) {
      const a = candidates[i];
      const b = candidates[j];
      if (a.parsed!.textHash === b.parsed!.textHash) continue;
      const distance = hammingDistanceHex(a.parsed!.simhash, b.parsed!.simhash);
      if (distance > RULE_THRESHOLDS.nearDuplicateHamming) continue;
      for (const [page, other] of [
        [a, b],
        [b, a],
      ] as const) {
        const key = `${page.normalizedUrl}|${other.normalizedUrl}`;
        if (reported.has(key)) continue;
        reported.add(key);
        issues.push(
          issue(
            "NEAR_DUPLICATE_CONTENT",
            "content",
            "warning",
            "Near-duplicate content",
            `Visible text is ${distance} bits away from ${other.normalizedUrl} on a 64-bit content fingerprint.`,
            { comparedWith: other.normalizedUrl, hammingDistance: distance },
            page.normalizedUrl,
          ),
        );
      }
    }
  }
}

function runImageRules(page: CrawledPage, issues: DetectedIssue[]): void {
  const parsed = page.parsed!;
  const url = page.normalizedUrl;
  const missingAlt = parsed.images.filter((image) => !image.hasAlt && !image.isDecorative);
  const decorative = parsed.images.filter((image) => image.isDecorative);
  const withoutDimensions = parsed.images.filter((image) => image.width == null || image.height == null);

  if (missingAlt.length) {
    issues.push(
      issue(
        "IMAGE_MISSING_ALT",
        "images",
        "warning",
        `${missingAlt.length} image(s) missing alt text`,
        "Alt text describes images to search engines and screen readers.",
        { count: missingAlt.length, images: missingAlt.slice(0, 20).map((image) => image.src) },
        url,
      ),
    );
  }

  if (decorative.length > 0 && decorative.length === parsed.images.length && parsed.images.length > 2) {
    issues.push(
      issue(
        "IMAGE_ALL_DECORATIVE",
        "images",
        "notice",
        "Every image is marked decorative",
        `All ${parsed.images.length} images use an empty alt attribute, so none of them contribute any content signal.`,
        { count: decorative.length },
        url,
      ),
    );
  }

  if (withoutDimensions.length && parsed.images.length > 0) {
    issues.push(
      issue(
        "IMAGE_MISSING_DIMENSIONS",
        "images",
        "notice",
        `${withoutDimensions.length} image(s) without width/height`,
        "Explicit dimensions let the browser reserve space and avoid layout shift.",
        { count: withoutDimensions.length, images: withoutDimensions.slice(0, 20).map((image) => image.src) },
        url,
      ),
    );
  }
}

function runSchemaRules(page: CrawledPage, issues: DetectedIssue[]): void {
  const schema = page.schema;
  const url = page.normalizedUrl;
  if (!schema) return;

  if (!schema.blocks.length) {
    issues.push(
      issue("SCHEMA_MISSING", "structured_data", "notice", "No structured data found", "The page has no JSON-LD structured data.", {}, url),
    );
    return;
  }

  if (schema.invalidJsonCount > 0) {
    issues.push(
      issue(
        "SCHEMA_INVALID_JSON",
        "structured_data",
        "warning",
        `${schema.invalidJsonCount} JSON-LD block(s) failed to parse`,
        "Invalid JSON-LD is ignored entirely by search engines.",
        {
          count: schema.invalidJsonCount,
          errors: schema.blocks.flatMap((block) => block.errors).slice(0, 10),
        },
        url,
      ),
    );
  }

  const missingRequired = schema.blocks.filter(
    (block) => block.valid === false && block.errors.some((error) => error.includes("required property") || error.includes("Missing @")),
  );
  if (missingRequired.length) {
    issues.push(
      issue(
        "SCHEMA_MISSING_REQUIRED",
        "structured_data",
        "warning",
        "Structured data is missing required properties",
        missingRequired.flatMap((block) => block.errors).slice(0, 5).join("; "),
        { errors: missingRequired.flatMap((block) => block.errors).slice(0, 20) },
        url,
      ),
    );
  }

  if (schema.duplicateTypes.length) {
    issues.push(
      issue(
        "SCHEMA_DUPLICATE",
        "structured_data",
        "notice",
        "Duplicate structured-data blocks",
        `${schema.duplicateTypes.join(", ")} appear more than once on this page.`,
        { types: schema.duplicateTypes },
        url,
      ),
    );
  }

  if (schema.hasBreadcrumb && schema.breadcrumbValid === false) {
    issues.push(
      issue(
        "BREADCRUMB_INVALID",
        "structured_data",
        "warning",
        "BreadcrumbList structured data is invalid",
        schema.breadcrumbIssues.slice(0, 3).join("; "),
        { issues: schema.breadcrumbIssues.slice(0, 20) },
        url,
      ),
    );
  }

  if (!schema.hasBreadcrumb && page.path !== "/" && page.path.split("/").filter(Boolean).length >= 1) {
    issues.push(
      issue(
        "BREADCRUMB_MISSING",
        "structured_data",
        "notice",
        "No BreadcrumbList structured data",
        "Nested pages benefit from BreadcrumbList markup so search engines can show the page's place in the site.",
        { path: page.path },
        url,
      ),
    );
  }
}

function runTechnicalRules(page: CrawledPage, context: RulesContext, issues: DetectedIssue[]): void {
  const parsed = page.parsed!;
  const url = page.normalizedUrl;

  if (!parsed.viewport) {
    issues.push(
      issue("VIEWPORT_MISSING", "performance", "warning", "Missing mobile viewport meta tag", "Without a viewport meta tag the page will not render correctly on mobile devices.", {}, url),
    );
  }

  if (!parsed.lang) {
    issues.push(issue("LANG_MISSING", "content", "notice", "Missing html lang attribute", "Declare the page language on the <html> element.", {}, url));
  }

  if (!parsed.ogTitle || !parsed.ogDescription || !parsed.ogImage) {
    const missing = [
      !parsed.ogTitle ? "og:title" : null,
      !parsed.ogDescription ? "og:description" : null,
      !parsed.ogImage ? "og:image" : null,
    ].filter(Boolean);
    issues.push(
      issue(
        "OPEN_GRAPH_INCOMPLETE",
        "metadata",
        "notice",
        "Incomplete Open Graph tags",
        `Missing ${missing.join(", ")} — social platforms will fall back to unpredictable content.`,
        { missing },
        url,
      ),
    );
  }

  if (!parsed.ogUrl) {
    issues.push(issue("OPEN_GRAPH_URL_MISSING", "metadata", "notice", "Missing og:url", "Add an absolute og:url so shared links resolve to the intended page.", {}, url));
  } else {
    const ogUrl = normalizeUrl(parsed.ogUrl, page.finalUrl ?? page.url);
    const canonical = parsed.canonicals[0] ? normalizeUrl(parsed.canonicals[0], page.finalUrl ?? page.url) : null;
    if (!ogUrl) {
      issues.push(issue("OPEN_GRAPH_URL_INVALID", "metadata", "notice", "Malformed og:url", "The og:url value is not a valid HTTP or HTTPS URL.", { value: parsed.ogUrl }, url));
    } else if (canonical && ogUrl.normalized !== canonical.normalized) {
      issues.push(issue("OPEN_GRAPH_URL_MISMATCH", "metadata", "notice", "og:url differs from canonical", "Keep social and canonical URLs aligned unless the difference is intentional.", { ogUrl: ogUrl.normalized, canonical: canonical.normalized }, url));
    }
  }
  if (!parsed.ogType) {
    issues.push(issue("OPEN_GRAPH_TYPE_MISSING", "metadata", "notice", "Missing og:type", "Declare the Open Graph content type for consistent share previews.", {}, url));
  }
  if (parsed.ogTitle && parsed.ogTitle.length > 95) {
    issues.push(issue("OPEN_GRAPH_TITLE_LONG", "metadata", "notice", "Open Graph title is very long", `The og:title is ${parsed.ogTitle.length} characters.`, { length: parsed.ogTitle.length }, url));
  }
  if (parsed.ogDescription && parsed.ogDescription.length > 300) {
    issues.push(issue("OPEN_GRAPH_DESCRIPTION_LONG", "metadata", "notice", "Open Graph description is very long", `The og:description is ${parsed.ogDescription.length} characters.`, { length: parsed.ogDescription.length }, url));
  }
  if (parsed.ogImage && !normalizeUrl(parsed.ogImage, page.finalUrl ?? page.url)) {
    issues.push(issue("OPEN_GRAPH_IMAGE_INVALID", "metadata", "notice", "Malformed Open Graph image URL", "The og:image value could not be resolved as an HTTP or HTTPS URL.", { value: parsed.ogImage }, url));
  } else if (parsed.ogImage) {
    const normalizedImage = normalizeUrl(parsed.ogImage, page.finalUrl ?? page.url);
    const checked = normalizedImage ? context.linkResults.get(normalizedImage.normalized) : null;
    if (checked?.isBroken) issues.push(issue("OPEN_GRAPH_IMAGE_UNAVAILABLE", "metadata", "notice", "Open Graph image is inaccessible", `The declared og:image returned ${checked.status ?? "no response"}.`, { image: normalizedImage?.href, status: checked.status }, url));
  }

  if (!parsed.twitterCard) {
    issues.push(issue("TWITTER_CARD_MISSING", "metadata", "notice", "Missing Twitter Card type", "Add twitter:card to improve social share previews.", {}, url));
  }
  if (!parsed.twitterImage) {
    issues.push(issue("TWITTER_IMAGE_MISSING", "metadata", "notice", "Missing Twitter Card image", "No twitter:image was measured. Platforms may fall back to Open Graph metadata.", {}, url));
  } else if (!normalizeUrl(parsed.twitterImage, page.finalUrl ?? page.url)) {
    issues.push(issue("TWITTER_IMAGE_INVALID", "metadata", "notice", "Malformed Twitter Card image URL", "The twitter:image value could not be resolved as an HTTP or HTTPS URL.", { value: parsed.twitterImage }, url));
  } else {
    const normalizedImage = normalizeUrl(parsed.twitterImage, page.finalUrl ?? page.url);
    const checked = normalizedImage ? context.linkResults.get(normalizedImage.normalized) : null;
    if (checked?.isBroken) issues.push(issue("TWITTER_IMAGE_UNAVAILABLE", "metadata", "notice", "Twitter Card image is inaccessible", `The declared twitter:image returned ${checked.status ?? "no response"}.`, { image: normalizedImage?.href, status: checked.status }, url));
  }

  const exceptions = page.browserProblems.filter((problem) => problem.type === "js_exception");
  const consoleErrors = page.browserProblems.filter((problem) => problem.type === "console_error");
  const failedImportant = page.browserProblems.filter((problem) => problem.type === "failed_request" && ["script", "stylesheet", "document"].includes(problem.resourceType ?? ""));
  if (exceptions.length) {
    issues.push(issue("UNCAUGHT_JS_ERROR", "performance", "warning", "Uncaught JavaScript error", `${exceptions.length} unique browser exception(s) were measured during rendering.`, { problems: exceptions.slice(0, 10) }, url));
  }
  if (consoleErrors.length >= 3) {
    issues.push(issue("REPEATED_CONSOLE_ERRORS", "performance", "notice", "Repeated browser console errors", `${consoleErrors.length} unique console errors were measured during rendering.`, { problems: consoleErrors.slice(0, 10) }, url));
  }
  for (const resourceType of ["stylesheet", "script"] as const) {
    const failed = failedImportant.filter((problem) => problem.resourceType === resourceType);
    if (failed.length) {
      issues.push(issue(resourceType === "stylesheet" ? "FAILED_CSS_REQUEST" : "FAILED_JS_REQUEST", "performance", "warning", `Failed ${resourceType} request`, `${failed.length} ${resourceType} resource(s) failed during browser rendering.`, { requests: failed.slice(0, 10) }, url));
    }
  }

  if (page.url.startsWith("http://")) {
    issues.push(
      issue("PAGE_NOT_HTTPS", "security", "critical", "Page served over HTTP", "Serve every page over HTTPS.", { url: page.url }, url),
    );
  }

  const mixed = parsed.links.filter((link) => link.isMixedContent);
  if (mixed.length) {
    issues.push(
      issue(
        "MIXED_CONTENT_LINK",
        "security",
        "warning",
        `${mixed.length} link(s) to insecure HTTP URLs`,
        "Links from an HTTPS page to HTTP URLs undermine the secure experience.",
        { count: mixed.length, links: mixed.slice(0, 20).map((link) => link.href) },
        url,
      ),
    );
  }

  if (page.responseTimeMs != null && page.responseTimeMs > RULE_THRESHOLDS.slowResponseMs) {
    issues.push(
      issue(
        "SLOW_RESPONSE",
        "performance",
        "notice",
        "Slow server response",
        `The crawler waited ${page.responseTimeMs}ms for this page.`,
        { responseTimeMs: page.responseTimeMs },
        url,
      ),
    );
  }
}

function runLinkRules(
  context: RulesContext,
  issues: DetectedIssue[],
  pageByNormalized: Map<string, CrawledPage>,
): void {
  const bySource = new Map<string, CrawlEdge[]>();
  for (const edge of context.edges) {
    if (!bySource.has(edge.source)) bySource.set(edge.source, []);
    bySource.get(edge.source)!.push(edge);
  }

  for (const [source, edges] of bySource) {
    const brokenInternal: Array<{ target: string; anchorText: string; status: number | null }> = [];
    const brokenExternal: Array<{ target: string; anchorText: string; status: number | null }> = [];
    const redirecting: Array<{ target: string; redirectsTo: string | null; status: number | null }> = [];

    for (const edge of edges) {
      const known = pageByNormalized.get(edge.target);
      const checked = context.linkResults.get(edge.target);
      const status = known?.status ?? checked?.status ?? null;
      const isBroken = checked?.isBroken ?? (status != null && status >= 400);

      if (isBroken) {
        const record = { target: edge.targetHref, anchorText: edge.anchorText, status };
        if (edge.isInternal) brokenInternal.push(record);
        else brokenExternal.push(record);
      } else if ((checked?.hopCount ?? 0) > 0 && edge.isInternal) {
        redirecting.push({ target: edge.targetHref, redirectsTo: checked?.redirectsTo ?? null, status });
      }
    }

    if (brokenInternal.length) {
      issues.push(
        issue(
          "BROKEN_INTERNAL_LINK",
          "links",
          "critical",
          `${brokenInternal.length} broken internal link(s)`,
          "Internal links that return 4xx/5xx waste crawl budget and break user journeys.",
          { count: brokenInternal.length, links: brokenInternal.slice(0, 25) },
          source,
        ),
      );
    }

    if (brokenExternal.length) {
      issues.push(
        issue(
          "BROKEN_EXTERNAL_LINK",
          "links",
          "warning",
          `${brokenExternal.length} broken external link(s)`,
          "External links that no longer resolve reduce the page's usefulness.",
          { count: brokenExternal.length, links: brokenExternal.slice(0, 25) },
          source,
        ),
      );
    }

    if (redirecting.length) {
      issues.push(
        issue(
          "INTERNAL_LINK_TO_REDIRECT",
          "links",
          "notice",
          `${redirecting.length} internal link(s) point to a redirect`,
          "Link straight to the final URL so crawlers and users skip the extra hop.",
          { count: redirecting.length, links: redirecting.slice(0, 25) },
          source,
        ),
      );
    }

    if (edges.length > RULE_THRESHOLDS.maxLinksPerPage) {
      issues.push(
        issue(
          "TOO_MANY_LINKS",
          "links",
          "notice",
          `Page contains ${edges.length} links`,
          `Pages with more than ${RULE_THRESHOLDS.maxLinksPerPage} links dilute the value passed to each target.`,
          { count: edges.length },
          source,
        ),
      );
    }
  }

  for (const [anchor, sources] of context.graph.genericAnchorUsage) {
    if (sources.length < RULE_THRESHOLDS.genericAnchorRepeat) continue;
    issues.push(
      issue(
        "GENERIC_ANCHOR_TEXT",
        "links",
        "notice",
        `Generic anchor text "${anchor}" used ${sources.length} times`,
        "Descriptive anchor text tells search engines what the destination page is about.",
        { anchor, count: sources.length, pages: sources.slice(0, 20) },
        null,
        "site",
      ),
    );
  }
}

function runRedirectRules(context: RulesContext, issues: DetectedIssue[]): void {
  for (const chain of context.redirectChains) {
    if (chain.severity === "none") continue;
    const ruleId = chain.isLoop
      ? "REDIRECT_LOOP"
      : chain.endsInError
        ? "REDIRECT_TO_ERROR"
        : chain.hopCount > 1
          ? "REDIRECT_CHAIN"
          : "REDIRECT_UNNECESSARY";

    issues.push(
      issue(
        ruleId,
        "links",
        chain.severity,
        chain.isLoop
          ? "Redirect loop"
          : chain.endsInError
            ? `Redirect ends at HTTP ${chain.finalStatus}`
            : `Redirect chain with ${chain.hopCount} hops`,
        chain.issues.join("; "),
        {
          hops: chain.hops.map((hop) => ({ url: hop.url, status: hop.status })),
          finalUrl: chain.finalUrl,
          finalStatus: chain.finalStatus,
          hopCount: chain.hopCount,
        },
        chain.sourceUrl,
      ),
    );
  }
}

function runGraphRules(context: RulesContext, issues: DetectedIssue[], htmlPages: CrawledPage[]): void {
  for (const page of htmlPages) {
    const node = context.graph.nodes.get(page.normalizedUrl);
    if (!node) continue;

    if (node.isOrphan) {
      issues.push(
        issue(
          "ORPHAN_PAGE",
          "structure",
          "warning",
          "Orphan page — no internal links point here",
          "The page was found through the sitemap or a seed URL but nothing on the site links to it.",
          { inSitemap: page.inSitemap, depth: node.depth },
          page.normalizedUrl,
        ),
      );
    } else if (node.uniqueInLinks === 1) {
      issues.push(
        issue(
          "WEAKLY_LINKED_PAGE",
          "structure",
          "notice",
          "Only one internal link points to this page",
          "Pages with a single entry point are harder for crawlers and users to reach.",
          { inLinks: node.uniqueInLinks, from: node.incoming.slice(0, 5).map((ref) => ref.url) },
          page.normalizedUrl,
        ),
      );
    }

    if (node.isDeadEnd) {
      issues.push(
        issue(
          "DEAD_END_PAGE",
          "structure",
          "notice",
          "Dead-end page with no internal links out",
          "Add contextual links so visitors and crawlers can continue through the site.",
          {},
          page.normalizedUrl,
        ),
      );
    } else if (node.uniqueOutLinks < RULE_THRESHOLDS.minInternalOutLinks) {
      issues.push(
        issue(
          "FEW_INTERNAL_LINKS_OUT",
          "structure",
          "notice",
          `Only ${node.uniqueOutLinks} internal link(s) out`,
          "Few outgoing internal links limit how crawl equity flows through the site.",
          { outLinks: node.uniqueOutLinks },
          page.normalizedUrl,
        ),
      );
    }

    if (node.depth != null && node.depth >= RULE_THRESHOLDS.deepCrawlDepth) {
      issues.push(
        issue(
          "DEEP_CRAWL_DEPTH",
          "structure",
          "notice",
          `Page is ${node.depth} clicks from the homepage`,
          `Pages deeper than ${RULE_THRESHOLDS.deepCrawlDepth - 1} clicks receive noticeably less crawl attention.`,
          { depth: node.depth },
          page.normalizedUrl,
        ),
      );
    }

    if (node.depth == null && !node.isOrphan) {
      issues.push(
        issue(
          "PAGE_UNREACHABLE_FROM_HOME",
          "structure",
          "warning",
          "Page is not reachable by following links from the homepage",
          "Only nofollow links or non-crawlable paths lead here.",
          {},
          page.normalizedUrl,
        ),
      );
    }
  }
}

function runPerformanceRules(context: RulesContext, issues: DetectedIssue[]): void {
  for (const summary of context.performance.values()) {
    if (summary.renderBlockingCount > 0) {
      issues.push(issue("RENDER_BLOCKING_RESOURCES", "performance", "warning", "Render-blocking resources detected", `Lighthouse measured ${summary.renderBlockingCount} resource(s) delaying the first render.`, { count: summary.renderBlockingCount, source: "pagespeed" }, summary.normalizedUrl));
    }
    if (summary.performance != null && summary.performance < RULE_THRESHOLDS.lowPerformanceScore) {
      issues.push(
        issue(
          "PERFORMANCE_SCORE_LOW",
          "performance",
          "warning",
          `Lighthouse performance score is ${summary.performance}`,
          `Lab performance below ${RULE_THRESHOLDS.lowPerformanceScore} usually means users on slower connections struggle.`,
          { score: summary.performance, source: "lighthouse_lab" },
          summary.normalizedUrl,
        ),
      );
    }

    if (summary.lcpMs != null && summary.lcpMs > RULE_THRESHOLDS.poorLcpMs) {
      issues.push(
        issue(
          "LCP_POOR",
          "performance",
          "warning",
          `Largest Contentful Paint is ${(summary.lcpMs / 1000).toFixed(1)}s`,
          "Google considers LCP above 4s poor.",
          { lcpMs: summary.lcpMs, fieldData: summary.fieldAvailable },
          summary.normalizedUrl,
        ),
      );
    }

    if (summary.clsScore != null && summary.clsScore > RULE_THRESHOLDS.poorCls) {
      issues.push(
        issue(
          "CLS_POOR",
          "performance",
          "warning",
          `Cumulative Layout Shift is ${summary.clsScore.toFixed(3)}`,
          "Google considers CLS above 0.25 poor.",
          { cls: summary.clsScore, fieldData: summary.fieldAvailable },
          summary.normalizedUrl,
        ),
      );
    }
  }
}
