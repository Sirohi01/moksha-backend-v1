import tls from "node:tls";
import { lookup } from "node:dns/promises";
import { BlogPost } from "../../models/blogPost.model";
import { Enquiry } from "../../models/enquiry.model";
import { AssistanceRequest } from "../../models/assistanceRequest.model";
import { Donation } from "../../models/donation.model";
import { Volunteer } from "../../models/volunteer.model";
import { Case } from "../../models/case.model";
import { NewsletterSubscriber } from "../../models/newsletterSubscriber.model";
import { Campaign } from "../../models/campaign.model";
import { Setting } from "../../models/setting.model";
import { env } from "../../config/env";
import { getGoogleAccessToken } from "../../lib/googleAuth";

type SourceStatus = "connected" | "not_connected" | "error";

interface SourceResult<T> {
  status: SourceStatus;
  updatedAt: string;
  message?: string;
  data: T | null;
}

const nowIso = () => new Date().toISOString();

function source<T>(status: SourceStatus, data: T | null, message?: string): SourceResult<T> {
  return { status, updatedAt: nowIso(), data, ...(message ? { message } : {}) };
}

function growth(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

async function fetchGa4(token: string | null) {
  if (!env.GA4_PROPERTY_ID || !token) {
    return source("not_connected", null, "Add GA4_PROPERTY_ID and Google service-account credentials");
  }
  try {
    const run = async (startDate: string, endDate: string) => {
      const response = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${env.GA4_PROPERTY_ID}:runReport`, {
        method: "POST",
        signal: AbortSignal.timeout(20_000),
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          dateRanges: [{ startDate, endDate }],
          metrics: [
            { name: "activeUsers" }, { name: "sessions" }, { name: "screenPageViews" },
            { name: "averageSessionDuration" }, { name: "bounceRate" }, { name: "keyEvents" },
          ],
        }),
      });
      if (!response.ok) throw new Error(`GA4 returned ${response.status}`);
      const body = await response.json() as { rows?: Array<{ metricValues?: Array<{ value?: string }> }> };
      return body.rows?.[0]?.metricValues?.map((item) => Number(item.value ?? 0)) ?? [];
    };
    const [values, previous, dailyResponse] = await Promise.all([
      run("30daysAgo", "today"),
      run("60daysAgo", "31daysAgo"),
      fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${env.GA4_PROPERTY_ID}:runReport`, {
        method: "POST",
        signal: AbortSignal.timeout(20_000),
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
          dimensions: [{ name: "date" }],
          metrics: [{ name: "activeUsers" }, { name: "screenPageViews" }],
          orderBys: [{ dimension: { dimensionName: "date" } }],
          limit: 31,
        }),
      }),
    ]);
    if (!dailyResponse.ok) throw new Error(`GA4 daily report returned ${dailyResponse.status}`);
    const dailyBody = await dailyResponse.json() as {
      rows?: Array<{ dimensionValues?: Array<{ value?: string }>; metricValues?: Array<{ value?: string }> }>;
    };
    const daily = (dailyBody.rows ?? []).map((row) => ({
      date: row.dimensionValues?.[0]?.value ?? "",
      users: Number(row.metricValues?.[0]?.value ?? 0),
      pageViews: Number(row.metricValues?.[1]?.value ?? 0),
    }));
    const pagesResponse = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${env.GA4_PROPERTY_ID}:runReport`, {
      method: "POST",
      signal: AbortSignal.timeout(20_000),
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
        dimensions: [{ name: "pagePath" }],
        metrics: [{ name: "screenPageViews" }, { name: "activeUsers" }, { name: "averageSessionDuration" }, { name: "bounceRate" }],
        orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
        limit: 250,
      }),
    });
    if (!pagesResponse.ok) throw new Error(`GA4 page report returned ${pagesResponse.status}`);
    const pagesBody = await pagesResponse.json() as {
      rows?: Array<{ dimensionValues?: Array<{ value?: string }>; metricValues?: Array<{ value?: string }> }>;
    };
    const pages = (pagesBody.rows ?? []).map((row) => ({
      path: row.dimensionValues?.[0]?.value ?? "/",
      views: Number(row.metricValues?.[0]?.value ?? 0),
      visitors: Number(row.metricValues?.[1]?.value ?? 0),
      averageSessionSeconds: Number(row.metricValues?.[2]?.value ?? 0),
      bounceRate: Number(row.metricValues?.[3]?.value ?? 0) * 100,
    }));
    return source("connected", {
      users: values[0] ?? 0, sessions: values[1] ?? 0, pageViews: values[2] ?? 0,
      averageSessionSeconds: values[3] ?? 0, bounceRate: (values[4] ?? 0) * 100,
      conversions: values[5] ?? 0,
      daily,
      pages,
      growth: {
        users: growth(values[0] ?? 0, previous[0] ?? 0),
        sessions: growth(values[1] ?? 0, previous[1] ?? 0),
        pageViews: growth(values[2] ?? 0, previous[2] ?? 0),
        averageSession: growth(values[3] ?? 0, previous[3] ?? 0),
        bounceRate: growth(values[4] ?? 0, previous[4] ?? 0),
        conversionRate: growth(
          (values[1] ?? 0) > 0 ? (values[5] ?? 0) / (values[1] ?? 1) : 0,
          (previous[1] ?? 0) > 0 ? (previous[5] ?? 0) / (previous[1] ?? 1) : 0,
        ),
      },
    });
  } catch (error) {
    return source("error", null, error instanceof Error ? error.message : "GA4 request failed");
  }
}

async function fetchSearchConsole(token: string | null) {
  if (!env.SEARCH_CONSOLE_SITE_URL || !token) {
    return source("not_connected", null, "Add SEARCH_CONSOLE_SITE_URL and Google service-account credentials");
  }
  try {
    const siteUrl: string = env.SEARCH_CONSOLE_SITE_URL!;
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 27);
    const previousEnd = new Date(start); previousEnd.setDate(previousEnd.getDate() - 1);
    const previousStart = new Date(previousEnd); previousStart.setDate(previousStart.getDate() - 27);
    const date = (value: Date) => value.toISOString().slice(0, 10);
    const run = async (from: Date, to: Date) => {
      const response = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, {
        method: "POST",
        signal: AbortSignal.timeout(20_000),
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ startDate: date(from), endDate: date(to), type: "web" }),
      });
      if (!response.ok) throw new Error(`Search Console returned ${response.status}`);
      const body = await response.json() as { rows?: Array<{ clicks?: number; impressions?: number; ctr?: number; position?: number }> };
      return body.rows?.[0];
    };
    const [row, previous, queryResponse] = await Promise.all([
      run(start, end),
      run(previousStart, previousEnd),
      fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, {
        method: "POST",
        signal: AbortSignal.timeout(20_000),
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ startDate: date(start), endDate: date(end), type: "web", dimensions: ["query"], rowLimit: 5 }),
      }),
    ]);
    const queryBody = queryResponse.ok
      ? await queryResponse.json() as { rows?: Array<{ keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number }> }
      : { rows: [] };
    return source("connected", {
      clicks: row?.clicks ?? 0, impressions: row?.impressions ?? 0,
      ctr: (row?.ctr ?? 0) * 100, position: row?.position ?? 0,
      growth: {
        clicks: growth(row?.clicks ?? 0, previous?.clicks ?? 0),
        impressions: growth(row?.impressions ?? 0, previous?.impressions ?? 0),
        ctr: growth(row?.ctr ?? 0, previous?.ctr ?? 0),
        position: growth(row?.position ?? 0, previous?.position ?? 0),
      },
      queries: (queryBody.rows ?? []).map((item) => ({
        query: item.keys?.[0] ?? "Unknown",
        clicks: item.clicks ?? 0,
        impressions: item.impressions ?? 0,
        ctr: (item.ctr ?? 0) * 100,
        position: item.position ?? 0,
      })),
    });
  } catch (error) {
    return source("error", null, error instanceof Error ? error.message : "Search Console request failed");
  }
}

type PageSpeedData = {
  strategy: "mobile" | "desktop";
  lighthouseAvailable: boolean;
  performanceScore: number;
  seoScore: number;
  lcp: number | null;
  inp: number | null;
  cls: number | null;
  fcp: number | null;
  ttfb: number | null;
  tbt: number | null;
  seoChecks: Array<{
    key: string;
    label: string;
    status: "good" | "needs_work" | "not_checked";
    score: number | null;
  }>;
};

const PAGE_SPEED_CACHE_MS = 6 * 60 * 60 * 1000;
const PAGE_SPEED_RETRY_MS = 60 * 1000;
let pageSpeedCache: SourceResult<PageSpeedData> | null = null;
let pageSpeedRefresh: Promise<void> | null = null;
let homepageSeoRefresh: Promise<void> | null = null;
let pageSpeedLastAttempt = 0;

function buildHomepageSeoData(homepageHtml: string): PageSpeedData {
  const htmlCheck = (key: string, label: string, passed: boolean) => ({
    key,
    label,
    status: passed ? "good" as const : "needs_work" as const,
    score: passed ? 100 : 0,
  });
  const title = homepageHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<[^>]+>/g, "").trim() ?? "";
  const description = homepageHtml.match(/<meta\s+[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i)?.[1]?.trim()
    ?? homepageHtml.match(/<meta\s+[^>]*content=["']([^"']*)["'][^>]*name=["']description["'][^>]*>/i)?.[1]?.trim()
    ?? "";
  const headings = [...homepageHtml.matchAll(/<h([1-6])\b[^>]*>/gi)].map((match) => Number(match[1]));
  const images = [...homepageHtml.matchAll(/<img\b[^>]*>/gi)].map((match) => match[0]);
  const origin = new URL(env.WEBSITE_URL).origin;
  const internalLinks = [...homepageHtml.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi)]
    .map((match) => match[1]).filter((href) => href.startsWith("/") || href.startsWith(origin));
  const visibleTextLength = homepageHtml.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().length;
  const seoChecks: PageSpeedData["seoChecks"] = [
    htmlCheck("meta-title", "Meta Title", title.length >= 10 && title.length <= 60),
    htmlCheck("meta-description", "Meta Description", description.length >= 50 && description.length <= 160),
    htmlCheck("headings", "Headings", headings[0] === 1 && headings.filter((level) => level === 1).length === 1),
    htmlCheck("content-quality", "Content Quality", visibleTextLength >= 300),
    htmlCheck("internal-linking", "Internal Linking", internalLinks.length >= 3),
    htmlCheck("image-alt", "Images (ALT Text)", images.length === 0 || images.every((image) => /\balt=["'][^"']+["']/i.test(image))),
    htmlCheck("schema-markup", "Schema Markup", /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>/i.test(homepageHtml)),
    htmlCheck("mobile-friendly", "Mobile Friendliness", /<meta\s+[^>]*name=["']viewport["'][^>]*>/i.test(homepageHtml)),
    { key: "page-speed", label: "Page Speed", status: "not_checked", score: null },
  ];
  const checked = seoChecks.slice(0, -1);
  const seoScore = Math.round(checked.filter((item) => item.status === "good").length / checked.length * 100);
  return {
    strategy: "desktop",
    lighthouseAvailable: false,
    performanceScore: 0,
    seoScore,
    lcp: null,
    inp: null,
    cls: null,
    fcp: null,
    ttfb: null,
    tbt: null,
    seoChecks,
  };
}

async function fetchHomepageSeo(): Promise<SourceResult<PageSpeedData>> {
  try {
    const response = await fetch(env.WEBSITE_URL, {
      headers: { "user-agent": "MokshaSewa-SEO-Monitor/1.0" },
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) throw new Error(`Homepage returned ${response.status}`);
    return source("connected", buildHomepageSeoData(await response.text()), "Homepage SEO loaded; performance metrics are updating.");
  } catch (error) {
    return source<PageSpeedData>("error", null, error instanceof Error ? error.message : "Homepage SEO request failed");
  }
}

async function fetchPageSpeed(): Promise<SourceResult<PageSpeedData>> {
  if (!env.PAGESPEED_API_KEY) return source<PageSpeedData>("not_connected", null, "Add PAGESPEED_API_KEY");
  try {
    const homepageHtmlPromise = fetch(env.WEBSITE_URL, {
      headers: { "user-agent": "MokshaSewa-SEO-Monitor/1.0" },
      signal: AbortSignal.timeout(15_000),
    }).then(async (response) => response.ok ? response.text() : null).catch(() => null);
    let body: any = null;
    let usedStrategy: "mobile" | "desktop" = "desktop";
    let lastError = "PageSpeed request failed";
    // Desktop is intentionally first: it is usually faster and gives the dashboard useful live
    // data without making the user wait for Google's slower mobile Lighthouse queue.
    for (const strategy of ["desktop", "mobile"] as const) {
      const params = new URLSearchParams({ url: env.WEBSITE_URL, key: env.PAGESPEED_API_KEY, strategy });
      ["performance", "seo"].forEach((category) => params.append("category", category));
      const response = await fetch(`https://pagespeedonline.googleapis.com/pagespeedonline/v5/runPagespeed?${params}`, {
        signal: AbortSignal.timeout(strategy === "desktop" ? 90_000 : 60_000),
      });
      const responseBody = await response.json().catch(() => null) as any;
      if (response.ok) {
        body = responseBody;
        usedStrategy = strategy;
        break;
      }
      lastError = responseBody?.error?.message ?? `PageSpeed returned ${response.status}`;
      if (response.status < 500) break;
    }
    // Google occasionally returns PROTOCOL_TIMEOUT even though the homepage itself is
    // healthy. Keep the fast, direct homepage SEO audit usable and retry Lighthouse later.
    const audits = body?.lighthouseResult?.audits ?? {};
    const field = body?.loadingExperience?.metrics ?? body?.originLoadingExperience?.metrics ?? {};
    const fieldValue = (key: string) => field[key]?.percentile ?? null;
    const fieldCls = fieldValue("CUMULATIVE_LAYOUT_SHIFT_SCORE");
    const homepageHtml = await homepageHtmlPromise;
    const check = (key: string, label: string, auditIds: string[]) => {
      const scores = auditIds
        .map((id) => audits[id]?.score)
        .filter((score: unknown): score is number => typeof score === "number");
      const score = scores.length ? Math.min(...scores) : null;
      return {
        key,
        label,
        status: score == null ? "not_checked" as const : score >= 0.9 ? "good" as const : "needs_work" as const,
        score: score == null ? null : Math.round(score * 100),
      };
    };
    const lighthouseAvailable = Boolean(body?.lighthouseResult);
    const performanceScore = lighthouseAvailable
      ? Math.round((body.lighthouseResult?.categories?.performance?.score ?? 0) * 100)
      : 0;
    const htmlCheck = (key: string, label: string, passed: boolean | null) => ({
      key,
      label,
      status: passed == null ? "not_checked" as const : passed ? "good" as const : "needs_work" as const,
      score: passed == null ? null : passed ? 100 : 0,
    });
    const title = homepageHtml?.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<[^>]+>/g, "").trim() ?? "";
    const description = homepageHtml?.match(/<meta\s+[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i)?.[1]?.trim()
      ?? homepageHtml?.match(/<meta\s+[^>]*content=["']([^"']*)["'][^>]*name=["']description["'][^>]*>/i)?.[1]?.trim()
      ?? "";
    const headings = homepageHtml ? [...homepageHtml.matchAll(/<h([1-6])\b[^>]*>/gi)].map((match) => Number(match[1])) : [];
    const images = homepageHtml ? [...homepageHtml.matchAll(/<img\b[^>]*>/gi)].map((match) => match[0]) : [];
    const internalLinks = homepageHtml ? [...homepageHtml.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi)]
      .map((match) => match[1]).filter((href) => href.startsWith("/") || href.startsWith(new URL(env.WEBSITE_URL).origin)) : [];
    const visibleTextLength = homepageHtml?.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().length ?? 0;
    const seoChecks: PageSpeedData["seoChecks"] = [
      homepageHtml ? htmlCheck("meta-title", "Meta Title", title.length >= 10 && title.length <= 60) : check("meta-title", "Meta Title", ["document-title"]),
      homepageHtml ? htmlCheck("meta-description", "Meta Description", description.length >= 50 && description.length <= 160) : check("meta-description", "Meta Description", ["meta-description"]),
      htmlCheck("headings", "Headings", homepageHtml ? headings[0] === 1 && headings.filter((level) => level === 1).length === 1 : null),
      htmlCheck("content-quality", "Content Quality", homepageHtml ? visibleTextLength >= 300 : null),
      homepageHtml ? htmlCheck("internal-linking", "Internal Linking", internalLinks.length >= 3) : check("internal-linking", "Internal Linking", ["crawlable-anchors", "link-text"]),
      htmlCheck("image-alt", "Images (ALT Text)", homepageHtml ? images.length === 0 || images.every((image) => /\balt=["'][^"']+["']/i.test(image)) : null),
      htmlCheck("schema-markup", "Schema Markup", homepageHtml ? /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>/i.test(homepageHtml) : null),
      homepageHtml ? htmlCheck("mobile-friendly", "Mobile Friendliness", /<meta\s+[^>]*name=["']viewport["'][^>]*>/i.test(homepageHtml)) : check("mobile-friendly", "Mobile Friendliness", ["viewport"]),
      {
        key: "page-speed",
        label: "Page Speed",
        status: lighthouseAvailable ? (performanceScore >= 90 ? "good" : "needs_work") : "not_checked",
        score: lighthouseAvailable ? performanceScore : null,
      },
    ];
    const checkedSeoItems = seoChecks.slice(0, -1).filter((item) => item.status !== "not_checked");
    const directSeoScore = checkedSeoItems.length
      ? Math.round(checkedSeoItems.filter((item) => item.status === "good").length / checkedSeoItems.length * 100)
      : 0;
    return source("connected", {
      strategy: usedStrategy,
      lighthouseAvailable,
      performanceScore,
      seoScore: lighthouseAvailable
        ? Math.round((body.lighthouseResult?.categories?.seo?.score ?? 0) * 100)
        : directSeoScore,
      lcp: fieldValue("LARGEST_CONTENTFUL_PAINT_MS") ?? audits["largest-contentful-paint"]?.numericValue ?? null,
      inp: fieldValue("INTERACTION_TO_NEXT_PAINT") ?? audits["interaction-to-next-paint"]?.numericValue ?? null,
      cls: fieldCls != null ? (fieldCls > 1 ? fieldCls / 100 : fieldCls) : audits["cumulative-layout-shift"]?.numericValue ?? null,
      fcp: fieldValue("FIRST_CONTENTFUL_PAINT_MS") ?? audits["first-contentful-paint"]?.numericValue ?? null,
      ttfb: audits["server-response-time"]?.numericValue ?? null,
      tbt: audits["total-blocking-time"]?.numericValue ?? null,
      seoChecks,
    }, lighthouseAvailable ? undefined : `Homepage SEO is live. Lighthouse retry pending: ${lastError}`);
  } catch (error) {
    return source<PageSpeedData>("error", null, error instanceof Error ? error.message : "PageSpeed request failed");
  }
}

export function getPageSpeedSnapshot(): SourceResult<PageSpeedData> {
  const now = Date.now();
  const cacheAge = pageSpeedCache ? now - new Date(pageSpeedCache.updatedAt).getTime() : Infinity;
  const cacheIsFresh = pageSpeedCache?.status === "connected" && pageSpeedCache.data?.lighthouseAvailable === true && cacheAge < PAGE_SPEED_CACHE_MS;

  if (!pageSpeedCache && !homepageSeoRefresh) {
    homepageSeoRefresh = fetchHomepageSeo()
      .then((result) => {
        if (result.status === "connected" && !pageSpeedCache?.data?.lighthouseAvailable) pageSpeedCache = result;
      })
      .finally(() => { homepageSeoRefresh = null; });
  }

  if (!cacheIsFresh && !pageSpeedRefresh && now - pageSpeedLastAttempt >= PAGE_SPEED_RETRY_MS) {
    pageSpeedLastAttempt = now;
    pageSpeedRefresh = fetchPageSpeed()
      .then((result) => { pageSpeedCache = result; })
      .finally(() => { pageSpeedRefresh = null; });
  }

  if (pageSpeedCache?.status === "connected") return pageSpeedCache;
  if (homepageSeoRefresh || pageSpeedRefresh) {
    return source<PageSpeedData>("error", null, "Loading SEO data...");
  }
  return pageSpeedCache ?? source<PageSpeedData>("error", null, "PageSpeed report is temporarily unavailable. Retrying shortly.");
}

export async function getPageSpeedReadySnapshot(): Promise<SourceResult<PageSpeedData>> {
  const snapshot = getPageSpeedSnapshot();
  if (snapshot.data || !homepageSeoRefresh) return snapshot;
  await homepageSeoRefresh;
  return pageSpeedCache ?? snapshot;
}

type IndexCoverageData = {
  indexed: number;
  total: number;
  notIndexed: number;
  urls: Array<{ url: string; indexed: boolean; coverageState?: string }>;
};

const INDEX_COVERAGE_CACHE_MS = 12 * 60 * 60 * 1000;
const INDEX_COVERAGE_RETRY_MS = 5 * 60 * 1000;
let indexCoverageCache: SourceResult<IndexCoverageData> | null = null;
let indexCoverageRefresh: Promise<void> | null = null;
let indexCoverageLastAttempt = 0;

function xmlLocations(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map((match) =>
    match[1].replaceAll("&amp;", "&").replaceAll("&lt;", "<").replaceAll("&gt;", ">"),
  );
}

async function fetchSitemapUrls(): Promise<string[]> {
  const origin = new URL(env.WEBSITE_URL).origin;
  const sitemapUrl = new URL("/sitemap.xml", origin).toString();
  const response = await fetch(sitemapUrl, { signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`Sitemap returned ${response.status}`);
  const locations = xmlLocations(await response.text());
  const childSitemaps = locations.filter((url) => /\.xml(?:\?|$)/i.test(url));
  if (!childSitemaps.length) return [...new Set(locations)].slice(0, 500);

  const nested = await Promise.all(childSitemaps.slice(0, 20).map(async (url) => {
    const child = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    return child.ok ? xmlLocations(await child.text()) : [];
  }));
  return [...new Set(nested.flat().filter((url) => !/\.xml(?:\?|$)/i.test(url)))].slice(0, 500);
}

async function refreshIndexCoverage(): Promise<SourceResult<IndexCoverageData>> {
  if (!env.SEARCH_CONSOLE_SITE_URL) {
    return source<IndexCoverageData>("not_connected", null, "Add SEARCH_CONSOLE_SITE_URL");
  }
  try {
    const token = await getGoogleAccessToken();
    if (!token) return source<IndexCoverageData>("not_connected", null, "Add Google service-account credentials");
    const urls = await fetchSitemapUrls();
    if (!urls.length) throw new Error("No URLs were found in sitemap.xml");
    const inspected: IndexCoverageData["urls"] = [];

    const results = await Promise.allSettled(urls.map(async (url) => {
        const response = await fetch("https://searchconsole.googleapis.com/v1/urlInspection/index:inspect", {
          method: "POST",
          signal: AbortSignal.timeout(12_000),
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ inspectionUrl: url, siteUrl: env.SEARCH_CONSOLE_SITE_URL }),
        });
        if (!response.ok) throw new Error(`URL Inspection returned ${response.status}`);
        const body = await response.json() as any;
        const status = body.inspectionResult?.indexStatusResult;
        return { url, indexed: status?.verdict === "PASS", coverageState: status?.coverageState as string | undefined };
    }));
    for (const result of results) {
      if (result.status === "fulfilled") inspected.push(result.value);
    }
    if (!inspected.length) throw new Error("Google did not return URL inspection data");

    const indexed = inspected.filter((item) => item.indexed).length;
    return source("connected", { indexed, total: inspected.length, notIndexed: inspected.length - indexed, urls: inspected });
  } catch (error) {
    return source<IndexCoverageData>("error", null, error instanceof Error ? error.message : "Index coverage request failed");
  }
}

export function getIndexCoverageSnapshot(): SourceResult<IndexCoverageData> {
  const now = Date.now();
  const cacheAge = indexCoverageCache ? now - new Date(indexCoverageCache.updatedAt).getTime() : Infinity;
  const cacheIsFresh = indexCoverageCache?.status === "connected" && cacheAge < INDEX_COVERAGE_CACHE_MS;
  if (!cacheIsFresh && !indexCoverageRefresh && now - indexCoverageLastAttempt >= INDEX_COVERAGE_RETRY_MS) {
    indexCoverageLastAttempt = now;
    indexCoverageRefresh = refreshIndexCoverage()
      .then((result) => { indexCoverageCache = result; })
      .finally(() => { indexCoverageRefresh = null; });
  }
  if (indexCoverageCache?.status === "connected") return indexCoverageCache;
  if (indexCoverageRefresh) return source<IndexCoverageData>("error", null, "Checking sitemap URLs in Google Search Console.");
  return indexCoverageCache ?? source<IndexCoverageData>("error", null, "Index coverage is temporarily unavailable.");
}

type SiteStatusData = {
  online: boolean;
  responseTimeMs: number;
  httpStatus: number;
  sslValid: boolean;
  sslExpiresAt: string | null;
  sslIssuer: string | null;
  certificateDaysRemaining: number | null;
  finalUrl: string;
  redirected: boolean;
  ipAddress: string | null;
  securityHeaders: { present: number; total: number };
  nodeVersion: string;
};

let siteStatusCache: SourceResult<SiteStatusData> | null = null;
let siteStatusRefresh: Promise<void> | null = null;

async function inspectTls(url: URL): Promise<{ valid: boolean; expiresAt: string | null; issuer: string | null }> {
  if (url.protocol !== "https:") return { valid: false, expiresAt: null, issuer: null };
  return new Promise((resolve) => {
    const socket = tls.connect({ host: url.hostname, port: Number(url.port || 443), servername: url.hostname, rejectUnauthorized: false });
    const finish = (result: { valid: boolean; expiresAt: string | null; issuer: string | null }) => {
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(10_000, () => finish({ valid: false, expiresAt: null, issuer: null }));
    socket.once("error", () => finish({ valid: false, expiresAt: null, issuer: null }));
    socket.once("secureConnect", () => {
      const certificate = socket.getPeerCertificate();
      const expiresAt = certificate.valid_to ? new Date(certificate.valid_to).toISOString() : null;
      finish({
        valid: socket.authorized && expiresAt !== null && new Date(expiresAt).getTime() > Date.now(),
        expiresAt,
        issuer: (() => {
          const value = certificate.issuer?.O ?? certificate.issuer?.CN;
          return Array.isArray(value) ? value.join(", ") : value ?? null;
        })(),
      });
    });
  });
}

async function fetchSiteStatus(): Promise<SourceResult<SiteStatusData>> {
  try {
    const url = new URL(env.WEBSITE_URL);
    const startedAt = Date.now();
    const [response, certificate, dnsResult] = await Promise.all([
      fetch(url, { method: "GET", redirect: "follow", signal: AbortSignal.timeout(12_000) }),
      inspectTls(url),
      lookup(url.hostname).catch(() => null),
    ]);
    const securityHeaderNames = ["strict-transport-security", "content-security-policy", "x-content-type-options", "x-frame-options", "referrer-policy"];
    const present = securityHeaderNames.filter((header) => response.headers.has(header)).length;
    return source("connected", {
      online: response.ok,
      responseTimeMs: Date.now() - startedAt,
      httpStatus: response.status,
      sslValid: certificate.valid,
      sslExpiresAt: certificate.expiresAt,
      sslIssuer: certificate.issuer,
      certificateDaysRemaining: certificate.expiresAt ? Math.max(0, Math.ceil((new Date(certificate.expiresAt).getTime() - Date.now()) / 86_400_000)) : null,
      finalUrl: response.url,
      redirected: response.redirected,
      ipAddress: dnsResult?.address ?? null,
      securityHeaders: { present, total: securityHeaderNames.length },
      nodeVersion: process.version,
    });
  } catch (error) {
    return source<SiteStatusData>("error", null, error instanceof Error ? error.message : "Website health check failed");
  }
}

export function getSiteStatusSnapshot(): SourceResult<SiteStatusData> {
  const age = siteStatusCache ? Date.now() - new Date(siteStatusCache.updatedAt).getTime() : Infinity;
  if ((!siteStatusCache || age >= 5 * 60 * 1000) && !siteStatusRefresh) {
    siteStatusRefresh = fetchSiteStatus().then((result) => { siteStatusCache = result; }).finally(() => { siteStatusRefresh = null; });
  }
  if (siteStatusCache) return siteStatusCache;
  return source<SiteStatusData>("error", null, "Checking website health.");
}

async function fetchInternalMetrics() {
  const now = new Date();
  const monthStart = new Date();
  monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const previousMonthStart = new Date(monthStart); previousMonthStart.setMonth(previousMonthStart.getMonth() - 1);
  const previousPeriodEnd = new Date(previousMonthStart);
  previousPeriodEnd.setDate(Math.min(now.getDate(), new Date(monthStart.getFullYear(), monthStart.getMonth(), 0).getDate()) + 1);
  const [
    posts, postsMtd, postsPrevious,
    enquiries, enquiriesMtd, enquiriesPrevious,
    requests,
    recent, locations, settings,
    totalDonations, donationsMtd,
    totalVolunteers, activeVolunteers,
    totalCases, openCases,
    totalSubscribers, subscribersMtd,
    totalCampaigns, activeCampaigns,
    donationAmountResult,
  ] = await Promise.all([
    BlogPost.countDocuments(),
    BlogPost.countDocuments({ createdAt: { $gte: monthStart } }),
    BlogPost.countDocuments({ createdAt: { $gte: previousMonthStart, $lt: previousPeriodEnd } }),
    Enquiry.countDocuments(), Enquiry.countDocuments({ createdAt: { $gte: monthStart } }),
    Enquiry.countDocuments({ createdAt: { $gte: previousMonthStart, $lt: previousPeriodEnd } }),
    AssistanceRequest.countDocuments(),
    Enquiry.find().sort({ createdAt: -1 }).limit(5).select("name category city createdAt").lean(),
    Enquiry.aggregate([{ $match: { city: { $nin: [null, ""] } } }, { $group: { _id: "$city", count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 5 }]),
    Setting.findOne().lean(),
    Donation.countDocuments(),
    Donation.countDocuments({ createdAt: { $gte: monthStart } }),
    Volunteer.countDocuments(),
    Volunteer.countDocuments({ status: "active" }).catch(() => 0),
    Case.countDocuments(),
    Case.countDocuments({ status: { $in: ["open", "in_progress", "pending"] } }).catch(() => 0),
    NewsletterSubscriber.countDocuments(),
    NewsletterSubscriber.countDocuments({ createdAt: { $gte: monthStart } }),
    Campaign.countDocuments(),
    Campaign.countDocuments({ status: "active" }).catch(() => 0),
    Donation.aggregate([{ $group: { _id: null, total: { $sum: "$amount" } } }]).catch(() => []),
  ]);
  const pageCount = settings
    ? Object.keys(settings).filter((key) => key.toLowerCase().endsWith("page") && (settings as Record<string, unknown>)[key]).length
    : 0;
  const totalDonationAmount = (donationAmountResult as Array<{ total?: number }>)[0]?.total ?? 0;
  return source("connected", {
    totalPages: pageCount, totalPosts: posts, totalEnquiries: enquiries, enquiriesMtd, totalRequests: requests,
    growth: { posts: growth(postsMtd, postsPrevious), enquiriesMtd: growth(enquiriesMtd, enquiriesPrevious) },
    recentSubmissions: recent.map((item) => ({ id: String(item._id), name: item.name, type: item.category, city: item.city, createdAt: item.createdAt })),
    topLocations: locations.map((item: { _id: string; count: number }) => ({ city: item._id, count: item.count })),
    donations: { total: totalDonations, mtd: donationsMtd, totalAmount: totalDonationAmount },
    volunteers: { total: totalVolunteers, active: activeVolunteers },
    cases: { total: totalCases, open: openCases },
    newsletter: { total: totalSubscribers, mtd: subscribersMtd },
    campaigns: { total: totalCampaigns, active: activeCampaigns },
  });
}

export async function buildDashboardOverview() {
  let token: string | null = null;
  try { token = await getGoogleAccessToken(); } catch { token = null; }
  const [internal, analytics, searchConsole] = await Promise.all([
    fetchInternalMetrics(), fetchGa4(token), fetchSearchConsole(token),
  ]);
  const pageSpeed = getPageSpeedSnapshot();
  const indexCoverage = getIndexCoverageSnapshot();
  const siteStatus = getSiteStatusSnapshot();
  return { generatedAt: nowIso(), sources: { internal, analytics, searchConsole, pageSpeed, indexCoverage, siteStatus } };
}
