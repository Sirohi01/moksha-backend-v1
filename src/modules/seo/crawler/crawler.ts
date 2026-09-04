import { fetchUrl, FetchHop, mapWithConcurrency } from "./fetcher";
import { parseHtml, ParsedPage } from "./parser";
import { fetchRobotsTxt, fetchSitemapUrls, isAllowedByRobots, RobotsTxt } from "./robots.util";
import {
  isLikelyNonHtml,
  isSameSite,
  matchesAnyPattern,
  normalizeUrl,
  queryVariantKey,
} from "./url.util";
import { validateJsonLdBlocks, SchemaValidationResult } from "../engine/schema.validator";
import { renderPage, isJsRenderingAvailable } from "./renderer";

export interface CrawlConfig {
  siteUrl: string;
  maxPages: number;
  maxDepth: number;
  concurrency: number;
  requestTimeoutMs: number;
  politenessDelayMs: number;
  respectRobots: boolean;
  followSitemap: boolean;
  renderJs: boolean;
  includeSubdomains: boolean;
  excludePatterns: string[];
  extraSeedUrls: string[];
}

export interface CrawledPage {
  url: string;
  normalizedUrl: string;
  path: string;
  depth: number;
  status: number | null;
  contentType: string | null;
  responseTimeMs: number | null;
  contentLength: number | null;
  finalUrl: string | null;
  redirected: boolean;
  hops: FetchHop[];
  fetchError: string | null;
  timedOut: boolean;
  blocked: boolean;
  isHtml: boolean;
  renderedWithJs: boolean;
  parsed: ParsedPage | null;
  schema: SchemaValidationResult | null;
  inSitemap: boolean;
  blockedByRobots: boolean;
}

export interface CrawlEdge {
  source: string;
  target: string;
  targetHref: string;
  anchorText: string;
  rel: string | null;
  isInternal: boolean;
  isNofollow: boolean;
  isMixedContent: boolean;
}

export interface CrawlResult {
  siteUrl: string;
  origin: string;
  hostname: string;
  pages: CrawledPage[];
  edges: CrawlEdge[];
  robots: RobotsTxt;
  sitemapFound: boolean;
  sitemapUrls: string[];
  sitemapErrors: string[];
  skipped: Array<{ url: string; reason: string }>;
  jsRenderingRequested: boolean;
  jsRenderingAvailable: boolean;
  startedAt: Date;
  finishedAt: Date;
}

const MAX_QUERY_VARIANTS_PER_PATH = 5;

interface FrontierItem {
  url: string;
  normalized: string;
  depth: number;
}

export async function runCrawl(
  config: CrawlConfig,
  onProgress?: (message: string) => void,
): Promise<CrawlResult> {
  const startedAt = new Date();
  const siteRoot = normalizeUrl(config.siteUrl);
  if (!siteRoot) throw new Error(`Invalid site URL: ${config.siteUrl}`);

  const origin = siteRoot.origin;
  const hostname = siteRoot.hostname;

  const robots = config.respectRobots
    ? await fetchRobotsTxt(origin, config.requestTimeoutMs)
    : { found: false, fetchError: null, rules: [], sitemaps: [], crawlDelayMs: null, raw: null };

  const sitemap = config.followSitemap
    ? await fetchSitemapUrls(origin, robots.sitemaps, 2000, config.requestTimeoutMs)
    : { found: false, urls: [], sitemapsFetched: [], errors: [] };

  const sitemapNormalized = new Set<string>();
  for (const url of sitemap.urls) {
    const parsed = normalizeUrl(url);
    if (parsed) sitemapNormalized.add(parsed.normalized);
  }

  const jsAvailable = config.renderJs ? await isJsRenderingAvailable() : false;
  if (config.renderJs && !jsAvailable) {
    onProgress?.("JavaScript rendering requested but Playwright is not installed — crawling static HTML only");
  }

  const politeness = Math.max(config.politenessDelayMs, robots.crawlDelayMs ?? 0);

  const visited = new Set<string>();
  const queued = new Set<string>();
  const skipped: Array<{ url: string; reason: string }> = [];
  const pages: CrawledPage[] = [];
  const edges: CrawlEdge[] = [];
  const queryVariants = new Map<string, number>();

  const seeds: FrontierItem[] = [];
  const pushSeed = (rawUrl: string, depth: number) => {
    const parsed = normalizeUrl(rawUrl);
    if (!parsed) return;
    if (!isSameSite(parsed.hostname, hostname, config.includeSubdomains)) return;
    if (queued.has(parsed.normalized)) return;
    queued.add(parsed.normalized);
    seeds.push({ url: parsed.href, normalized: parsed.normalized, depth });
  };

  pushSeed(siteRoot.href, 0);
  for (const url of config.extraSeedUrls) pushSeed(url, 1);
  for (const url of sitemap.urls) pushSeed(url, 1);

  let frontier: FrontierItem[] = seeds;
  let depth = 0;

  while (frontier.length && pages.length < config.maxPages && depth <= config.maxDepth) {
    const batch = frontier.slice(0, Math.max(0, config.maxPages - pages.length));
    frontier = [];

    onProgress?.(`Crawling depth ${depth}: ${batch.length} URL(s)`);

    const discovered: FrontierItem[] = [];

    await mapWithConcurrency(
      batch,
      config.concurrency,
      async (item) => {
        if (visited.has(item.normalized)) return;
        visited.add(item.normalized);

        if (config.excludePatterns.length && matchesAnyPattern(item.url, config.excludePatterns)) {
          skipped.push({ url: item.url, reason: "Matched exclude pattern" });
          return;
        }

        const allowed = !config.respectRobots || isAllowedByRobots(robots, item.url);
        if (!allowed) {
          pages.push(buildBlockedPage(item, sitemapNormalized.has(item.normalized)));
          skipped.push({ url: item.url, reason: "Blocked by robots.txt" });
          return;
        }

        if (isLikelyNonHtml(item.url)) {
          skipped.push({ url: item.url, reason: "Non-HTML resource" });
          return;
        }

        const outcome = await fetchUrl(item.url, {
          timeoutMs: config.requestTimeoutMs,
          retries: 1,
        });

        const isHtml = Boolean(outcome.contentType && /text\/html|application\/xhtml/i.test(outcome.contentType));
        let body = outcome.body;
        let renderedWithJs = false;

        if (jsAvailable && isHtml && outcome.ok) {
          const rendered = await renderPage(outcome.finalUrl, config.requestTimeoutMs);
          if (rendered) {
            body = rendered;
            renderedWithJs = true;
          }
        }

        const parsed = isHtml && body ? parseHtml(body, outcome.finalUrl, hostname, config.includeSubdomains) : null;
        const schema = parsed ? validateJsonLdBlocks(parsed.jsonLdBlocks) : null;

        pages.push({
          url: item.url,
          normalizedUrl: item.normalized,
          path: new URL(item.url).pathname || "/",
          depth: item.depth,
          status: outcome.status,
          contentType: outcome.contentType,
          responseTimeMs: outcome.responseTimeMs,
          contentLength: outcome.contentLength,
          finalUrl: outcome.finalUrl,
          redirected: outcome.redirected,
          hops: outcome.hops,
          fetchError: outcome.error,
          timedOut: outcome.timedOut,
          blocked: outcome.blocked,
          isHtml,
          renderedWithJs,
          parsed,
          schema,
          inSitemap: sitemapNormalized.has(item.normalized),
          blockedByRobots: false,
        });

        if (!parsed) return;

        for (const link of parsed.links) {
          edges.push({
            source: item.normalized,
            target: link.normalized,
            targetHref: link.href,
            anchorText: link.anchorText,
            rel: link.rel,
            isInternal: link.isInternal,
            isNofollow: link.isNofollow,
            isMixedContent: link.isMixedContent,
          });

          if (!link.isInternal || link.isNofollow) continue;
          if (visited.has(link.normalized) || queued.has(link.normalized)) continue;
          if (isLikelyNonHtml(link.href)) continue;
          if (config.excludePatterns.length && matchesAnyPattern(link.href, config.excludePatterns)) continue;

          const variantKey = queryVariantKey(link.normalized);
          if (link.normalized.includes("?")) {
            const count = queryVariants.get(variantKey) ?? 0;
            if (count >= MAX_QUERY_VARIANTS_PER_PATH) {
              skipped.push({ url: link.href, reason: "Query-parameter variant limit reached" });
              continue;
            }
            queryVariants.set(variantKey, count + 1);
          }

          queued.add(link.normalized);
          discovered.push({ url: link.href, normalized: link.normalized, depth: item.depth + 1 });
        }
      },
      politeness,
    );

    depth += 1;
    if (depth > config.maxDepth) {
      for (const item of discovered) skipped.push({ url: item.url, reason: "Beyond max crawl depth" });
      break;
    }
    frontier = discovered;
  }

  for (const item of frontier) {
    if (!visited.has(item.normalized)) skipped.push({ url: item.url, reason: "Page limit reached" });
  }

  return {
    siteUrl: config.siteUrl,
    origin,
    hostname,
    pages,
    edges,
    robots,
    sitemapFound: sitemap.found,
    sitemapUrls: [...sitemapNormalized],
    sitemapErrors: sitemap.errors,
    skipped,
    jsRenderingRequested: config.renderJs,
    jsRenderingAvailable: jsAvailable,
    startedAt,
    finishedAt: new Date(),
  };
}

function buildBlockedPage(item: FrontierItem, inSitemap: boolean): CrawledPage {
  return {
    url: item.url,
    normalizedUrl: item.normalized,
    path: (() => {
      try {
        return new URL(item.url).pathname || "/";
      } catch {
        return "/";
      }
    })(),
    depth: item.depth,
    status: null,
    contentType: null,
    responseTimeMs: null,
    contentLength: null,
    finalUrl: null,
    redirected: false,
    hops: [],
    fetchError: null,
    timedOut: false,
    blocked: false,
    isHtml: false,
    renderedWithJs: false,
    parsed: null,
    schema: null,
    inSitemap,
    blockedByRobots: true,
  };
}
