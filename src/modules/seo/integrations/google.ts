import { env } from "../../../config/env";
import { getGoogleAccessToken, GOOGLE_SCOPES, hasGoogleServiceAccount } from "../../../lib/googleAuth";
import { normalizeUrl } from "../crawler/url.util";

export type IntegrationStatus = "connected" | "not_connected" | "error";

export interface IntegrationResult<T> {
  status: IntegrationStatus;
  message: string | null;
  data: T | null;
}

function result<T>(status: IntegrationStatus, data: T | null, message: string | null = null): IntegrationResult<T> {
  return { status, data, message };
}

function failure<T>(status: IntegrationStatus, message: string): IntegrationResult<T> {
  return { status, data: null, message };
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function shiftDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

export interface SearchRow {
  key: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface SearchTotals {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface SearchConsoleSnapshot {
  siteUrl: string;
  windowDays: number;
  rangeStart: string;
  rangeEnd: string;
  previousRangeStart: string;
  previousRangeEnd: string;
  totals: SearchTotals;
  previousTotals: SearchTotals;
  byQuery: SearchRow[];
  previousByQuery: SearchRow[];
  byPage: SearchRow[];
  previousByPage: SearchRow[];
  byDevice: SearchRow[];
  byCountry: SearchRow[];
  byDate: SearchRow[];
  queryPagePairs: Array<{ query: string; page: string; clicks: number; impressions: number; ctr: number; position: number }>;
}

const GSC_DATA_LAG_DAYS = 2;

interface GscApiRow {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
}

async function querySearchAnalytics(
  token: string,
  siteUrl: string,
  body: Record<string, unknown>,
): Promise<GscApiRow[]> {
  const response = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    {
      method: "POST",
      signal: AbortSignal.timeout(30_000),
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ type: "web", ...body }),
    },
  );
  if (!response.ok) {
    const detail = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(detail?.error?.message ?? `Search Console returned ${response.status}`);
  }
  const payload = (await response.json()) as { rows?: GscApiRow[] };
  return payload.rows ?? [];
}

function toRows(rows: GscApiRow[]): SearchRow[] {
  return rows.map((row) => ({
    key: row.keys?.[0] ?? "",
    clicks: row.clicks ?? 0,
    impressions: row.impressions ?? 0,
    ctr: (row.ctr ?? 0) * 100,
    position: row.position ?? 0,
  }));
}

function toTotals(rows: GscApiRow[]): SearchTotals {
  const row = rows[0];
  return {
    clicks: row?.clicks ?? 0,
    impressions: row?.impressions ?? 0,
    ctr: (row?.ctr ?? 0) * 100,
    position: row?.position ?? 0,
  };
}

export async function fetchSearchConsoleSnapshot(
  siteUrl: string | null,
  windowDays: number,
): Promise<IntegrationResult<SearchConsoleSnapshot>> {
  const target = siteUrl ?? env.SEARCH_CONSOLE_SITE_URL ?? null;
  if (!target) return failure("not_connected", "Set SEARCH_CONSOLE_SITE_URL to enable Search Console data");
  if (!hasGoogleServiceAccount()) {
    return failure("not_connected", "Add Google service-account credentials to enable Search Console data");
  }

  try {
    const token = await getGoogleAccessToken([GOOGLE_SCOPES.searchConsole]);
    if (!token) return failure("not_connected", "Google service-account credentials are incomplete");

    const end = shiftDays(new Date(), -GSC_DATA_LAG_DAYS);
    const start = shiftDays(end, -(windowDays - 1));
    const previousEnd = shiftDays(start, -1);
    const previousStart = shiftDays(previousEnd, -(windowDays - 1));

    const range = { startDate: isoDate(start), endDate: isoDate(end) };
    const previousRange = { startDate: isoDate(previousStart), endDate: isoDate(previousEnd) };

    const [
      totalsRows,
      previousTotalsRows,
      queryRows,
      previousQueryRows,
      pageRows,
      previousPageRows,
      deviceRows,
      countryRows,
      dateRows,
      pairRows,
    ] = await Promise.all([
      querySearchAnalytics(token, target, range),
      querySearchAnalytics(token, target, previousRange),
      querySearchAnalytics(token, target, { ...range, dimensions: ["query"], rowLimit: 250 }),
      querySearchAnalytics(token, target, { ...previousRange, dimensions: ["query"], rowLimit: 250 }),
      querySearchAnalytics(token, target, { ...range, dimensions: ["page"], rowLimit: 500 }),
      querySearchAnalytics(token, target, { ...previousRange, dimensions: ["page"], rowLimit: 500 }),
      querySearchAnalytics(token, target, { ...range, dimensions: ["device"], rowLimit: 10 }),
      querySearchAnalytics(token, target, { ...range, dimensions: ["country"], rowLimit: 25 }),
      querySearchAnalytics(token, target, { ...range, dimensions: ["date"], rowLimit: 500 }),
      querySearchAnalytics(token, target, { ...range, dimensions: ["query", "page"], rowLimit: 1000 }),
    ]);

    return result("connected", {
      siteUrl: target,
      windowDays,
      rangeStart: range.startDate,
      rangeEnd: range.endDate,
      previousRangeStart: previousRange.startDate,
      previousRangeEnd: previousRange.endDate,
      totals: toTotals(totalsRows),
      previousTotals: toTotals(previousTotalsRows),
      byQuery: toRows(queryRows),
      previousByQuery: toRows(previousQueryRows),
      byPage: toRows(pageRows),
      previousByPage: toRows(previousPageRows),
      byDevice: toRows(deviceRows),
      byCountry: toRows(countryRows),
      byDate: toRows(dateRows),
      queryPagePairs: pairRows.map((row) => ({
        query: row.keys?.[0] ?? "",
        page: row.keys?.[1] ?? "",
        clicks: row.clicks ?? 0,
        impressions: row.impressions ?? 0,
        ctr: (row.ctr ?? 0) * 100,
        position: row.position ?? 0,
      })),
    });
  } catch (error) {
    return failure("error", error instanceof Error ? error.message : "Search Console request failed");
  }
}

export interface AnalyticsTotals {
  users: number;
  sessions: number;
  engagedSessions: number;
  engagementRate: number;
  screenPageViews: number;
  averageSessionSeconds: number;
  bounceRate: number;
  keyEvents: number;
}

export interface AnalyticsSnapshot {
  propertyId: string;
  windowDays: number;
  rangeStart: string;
  rangeEnd: string;
  totals: AnalyticsTotals;
  previousTotals: AnalyticsTotals;
  organicTotals: AnalyticsTotals;
  landingPages: Array<{ path: string; sessions: number; users: number; engagementRate: number; keyEvents: number }>;
  organicLandingPages: Array<{ path: string; sessions: number; users: number; engagementRate: number; keyEvents: number }>;
  pagePaths: Array<{ path: string; views: number; users: number; engagementRate: number }>;
  channels: Array<{ source: string; medium: string; sessions: number; users: number; keyEvents: number }>;
  events: Array<{ name: string; count: number; users: number }>;
  daily: Array<{ date: string; users: number; sessions: number; organicSessions: number }>;
}

const ANALYTICS_METRICS = [
  "activeUsers",
  "sessions",
  "engagedSessions",
  "engagementRate",
  "screenPageViews",
  "averageSessionDuration",
  "bounceRate",
  "keyEvents",
];

interface Ga4Row {
  dimensionValues?: Array<{ value?: string }>;
  metricValues?: Array<{ value?: string }>;
}

const ORGANIC_FILTER = {
  filter: {
    fieldName: "sessionDefaultChannelGroup",
    stringFilter: { matchType: "EXACT", value: "Organic Search" },
  },
};

async function runGa4Report(
  token: string,
  propertyId: string,
  body: Record<string, unknown>,
): Promise<Ga4Row[]> {
  const response = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method: "POST",
      signal: AbortSignal.timeout(30_000),
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!response.ok) {
    const detail = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(detail?.error?.message ?? `GA4 returned ${response.status}`);
  }
  const payload = (await response.json()) as { rows?: Ga4Row[] };
  return payload.rows ?? [];
}

function metricNumbers(row: Ga4Row | undefined): number[] {
  return row?.metricValues?.map((metric) => Number(metric.value ?? 0)) ?? [];
}

function toAnalyticsTotals(rows: Ga4Row[]): AnalyticsTotals {
  const values = metricNumbers(rows[0]);
  return {
    users: values[0] ?? 0,
    sessions: values[1] ?? 0,
    engagedSessions: values[2] ?? 0,
    engagementRate: (values[3] ?? 0) * 100,
    screenPageViews: values[4] ?? 0,
    averageSessionSeconds: values[5] ?? 0,
    bounceRate: (values[6] ?? 0) * 100,
    keyEvents: values[7] ?? 0,
  };
}

export async function fetchAnalyticsSnapshot(
  propertyId: string | null,
  windowDays: number,
): Promise<IntegrationResult<AnalyticsSnapshot>> {
  const property = propertyId ?? env.GA4_PROPERTY_ID ?? null;
  if (!property) return failure("not_connected", "Set GA4_PROPERTY_ID to enable Analytics data");
  if (!hasGoogleServiceAccount()) {
    return failure("not_connected", "Add Google service-account credentials to enable Analytics data");
  }

  try {
    const token = await getGoogleAccessToken([GOOGLE_SCOPES.analytics]);
    if (!token) return failure("not_connected", "Google service-account credentials are incomplete");

    const end = shiftDays(new Date(), -1);
    const start = shiftDays(end, -(windowDays - 1));
    const previousEnd = shiftDays(start, -1);
    const previousStart = shiftDays(previousEnd, -(windowDays - 1));

    const dateRanges = [{ startDate: isoDate(start), endDate: isoDate(end) }];
    const previousRanges = [{ startDate: isoDate(previousStart), endDate: isoDate(previousEnd) }];
    const metrics = ANALYTICS_METRICS.map((name) => ({ name }));

    const [
      totalsRows,
      previousRows,
      organicRows,
      landingRows,
      organicLandingRows,
      pagePathRows,
      channelRows,
      eventRows,
      dailyRows,
      dailyOrganicRows,
    ] = await Promise.all([
      runGa4Report(token, property, { dateRanges, metrics }),
      runGa4Report(token, property, { dateRanges: previousRanges, metrics }),
      runGa4Report(token, property, { dateRanges, metrics, dimensionFilter: ORGANIC_FILTER }),
      runGa4Report(token, property, {
        dateRanges,
        dimensions: [{ name: "landingPagePlusQueryString" }],
        metrics: [{ name: "sessions" }, { name: "activeUsers" }, { name: "engagementRate" }, { name: "keyEvents" }],
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
        limit: 100,
      }),
      runGa4Report(token, property, {
        dateRanges,
        dimensions: [{ name: "landingPagePlusQueryString" }],
        metrics: [{ name: "sessions" }, { name: "activeUsers" }, { name: "engagementRate" }, { name: "keyEvents" }],
        dimensionFilter: ORGANIC_FILTER,
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
        limit: 100,
      }),
      runGa4Report(token, property, {
        dateRanges,
        dimensions: [{ name: "pagePath" }],
        metrics: [{ name: "screenPageViews" }, { name: "activeUsers" }, { name: "engagementRate" }],
        orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
        limit: 300,
      }),
      runGa4Report(token, property, {
        dateRanges,
        dimensions: [{ name: "sessionSource" }, { name: "sessionMedium" }],
        metrics: [{ name: "sessions" }, { name: "activeUsers" }, { name: "keyEvents" }],
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
        limit: 50,
      }),
      runGa4Report(token, property, {
        dateRanges,
        dimensions: [{ name: "eventName" }],
        metrics: [{ name: "eventCount" }, { name: "activeUsers" }],
        orderBys: [{ metric: { metricName: "eventCount" }, desc: true }],
        limit: 100,
      }),
      runGa4Report(token, property, {
        dateRanges,
        dimensions: [{ name: "date" }],
        metrics: [{ name: "activeUsers" }, { name: "sessions" }],
        orderBys: [{ dimension: { dimensionName: "date" } }],
        limit: 400,
      }),
      runGa4Report(token, property, {
        dateRanges,
        dimensions: [{ name: "date" }],
        metrics: [{ name: "sessions" }],
        dimensionFilter: ORGANIC_FILTER,
        orderBys: [{ dimension: { dimensionName: "date" } }],
        limit: 400,
      }),
    ]);

    const organicByDate = new Map(
      dailyOrganicRows.map((row) => [row.dimensionValues?.[0]?.value ?? "", Number(row.metricValues?.[0]?.value ?? 0)]),
    );

    const mapLanding = (rows: Ga4Row[]) =>
      rows.map((row) => ({
        path: row.dimensionValues?.[0]?.value ?? "/",
        sessions: Number(row.metricValues?.[0]?.value ?? 0),
        users: Number(row.metricValues?.[1]?.value ?? 0),
        engagementRate: Number(row.metricValues?.[2]?.value ?? 0) * 100,
        keyEvents: Number(row.metricValues?.[3]?.value ?? 0),
      }));

    return result("connected", {
      propertyId: property,
      windowDays,
      rangeStart: dateRanges[0].startDate,
      rangeEnd: dateRanges[0].endDate,
      totals: toAnalyticsTotals(totalsRows),
      previousTotals: toAnalyticsTotals(previousRows),
      organicTotals: toAnalyticsTotals(organicRows),
      landingPages: mapLanding(landingRows),
      organicLandingPages: mapLanding(organicLandingRows),
      pagePaths: pagePathRows.map((row) => ({
        path: row.dimensionValues?.[0]?.value ?? "/",
        views: Number(row.metricValues?.[0]?.value ?? 0),
        users: Number(row.metricValues?.[1]?.value ?? 0),
        engagementRate: Number(row.metricValues?.[2]?.value ?? 0) * 100,
      })),
      channels: channelRows.map((row) => ({
        source: row.dimensionValues?.[0]?.value ?? "(not set)",
        medium: row.dimensionValues?.[1]?.value ?? "(not set)",
        sessions: Number(row.metricValues?.[0]?.value ?? 0),
        users: Number(row.metricValues?.[1]?.value ?? 0),
        keyEvents: Number(row.metricValues?.[2]?.value ?? 0),
      })),
      events: eventRows.map((row) => ({
        name: row.dimensionValues?.[0]?.value ?? "",
        count: Number(row.metricValues?.[0]?.value ?? 0),
        users: Number(row.metricValues?.[1]?.value ?? 0),
      })),
      daily: dailyRows.map((row) => {
        const date = row.dimensionValues?.[0]?.value ?? "";
        return {
          date,
          users: Number(row.metricValues?.[0]?.value ?? 0),
          sessions: Number(row.metricValues?.[1]?.value ?? 0),
          organicSessions: organicByDate.get(date) ?? 0,
        };
      }),
    });
  } catch (error) {
    return failure("error", error instanceof Error ? error.message : "GA4 request failed");
  }
}

export interface PageSpeedLab {
  performance: number | null;
  accessibility: number | null;
  bestPractices: number | null;
  seo: number | null;
  lcpMs: number | null;
  clsScore: number | null;
  tbtMs: number | null;
  fcpMs: number | null;
  speedIndexMs: number | null;
  ttiMs: number | null;
  serverResponseMs: number | null;
  totalByteWeight: number | null;
  resourceCount: number | null;
}

export interface PageSpeedField {
  available: boolean;
  source: "url" | "origin" | null;
  lcpMs: number | null;
  clsScore: number | null;
  inpMs: number | null;
  fcpMs: number | null;
  ttfbMs: number | null;
  overallCategory: string | null;
}

export interface PageSpeedResult {
  url: string;
  normalizedUrl: string;
  strategy: "mobile" | "desktop";
  lighthouseVersion: string | null;
  lab: PageSpeedLab;
  field: PageSpeedField;
  opportunities: Array<{ id: string; title: string; savingsMs: number | null }>;
  renderBlockingResources: Array<{ url: string | null; type: string; savingsMs: number | null; source: "pagespeed" }>;
}

const EMPTY_FIELD: PageSpeedField = {
  available: false,
  source: null,
  lcpMs: null,
  clsScore: null,
  inpMs: null,
  fcpMs: null,
  ttfbMs: null,
  overallCategory: null,
};

interface CruxMetrics {
  [key: string]: { percentile?: number; category?: string } | undefined;
}

function readField(
  experience: { metrics?: CruxMetrics; overall_category?: string } | undefined,
  source: "url" | "origin",
): PageSpeedField | null {
  const metrics = experience?.metrics;
  if (!metrics || Object.keys(metrics).length === 0) return null;
  const value = (key: string) => metrics[key]?.percentile ?? null;
  const rawCls = value("CUMULATIVE_LAYOUT_SHIFT_SCORE");
  return {
    available: true,
    source,
    lcpMs: value("LARGEST_CONTENTFUL_PAINT_MS"),
    clsScore: rawCls == null ? null : rawCls > 1 ? rawCls / 100 : rawCls,
    inpMs: value("INTERACTION_TO_NEXT_PAINT"),
    fcpMs: value("FIRST_CONTENTFUL_PAINT_MS"),
    ttfbMs: value("EXPERIMENTAL_TIME_TO_FIRST_BYTE"),
    overallCategory: experience?.overall_category ?? null,
  };
}

export async function runPageSpeedAudit(
  url: string,
  strategy: "mobile" | "desktop",
): Promise<IntegrationResult<PageSpeedResult>> {
  if (!env.PAGESPEED_API_KEY) return failure("not_connected", "Set PAGESPEED_API_KEY to enable Lighthouse audits");

  const normalized = normalizeUrl(url);
  if (!normalized) return failure("error", "Invalid URL");

  const params = new URLSearchParams({ url: normalized.href, key: env.PAGESPEED_API_KEY, strategy });
  for (const category of ["performance", "accessibility", "best-practices", "seo"]) {
    params.append("category", category);
  }

  let lastError = "PageSpeed request failed";
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(
        `https://pagespeedonline.googleapis.com/pagespeedonline/v5/runPagespeed?${params}`,
        { signal: AbortSignal.timeout(120_000) },
      );
      const body = (await response.json().catch(() => null)) as any;

      if (!response.ok) {
        lastError = body?.error?.message ?? `PageSpeed returned ${response.status}`;
        if (response.status < 500) break;
        continue;
      }

      const lighthouse = body?.lighthouseResult;
      if (!lighthouse) {
        lastError = "Lighthouse result was not returned";
        continue;
      }

      const audits = lighthouse.audits ?? {};
      const categories = lighthouse.categories ?? {};
      const score = (key: string) => {
        const value = categories[key]?.score;
        return typeof value === "number" ? Math.round(value * 100) : null;
      };
      const numeric = (key: string) => {
        const value = audits[key]?.numericValue;
        return typeof value === "number" ? value : null;
      };

      const field =
        readField(body?.loadingExperience, "url") ?? readField(body?.originLoadingExperience, "origin") ?? EMPTY_FIELD;

      const opportunities = Object.entries(audits)
        .filter(([, audit]: [string, any]) => audit?.details?.type === "opportunity" && audit?.numericValue > 0)
        .map(([id, audit]: [string, any]) => ({
          id,
          title: String(audit.title ?? id),
          savingsMs: typeof audit.numericValue === "number" ? Math.round(audit.numericValue) : null,
        }))
        .sort((a, b) => (b.savingsMs ?? 0) - (a.savingsMs ?? 0))
        .slice(0, 10);

      return result("connected", {
        url: normalized.href,
        normalizedUrl: normalized.normalized,
        strategy,
        lighthouseVersion: lighthouse.lighthouseVersion ?? null,
        lab: {
          performance: score("performance"),
          accessibility: score("accessibility"),
          bestPractices: score("best-practices"),
          seo: score("seo"),
          lcpMs: numeric("largest-contentful-paint"),
          clsScore: numeric("cumulative-layout-shift"),
          tbtMs: numeric("total-blocking-time"),
          fcpMs: numeric("first-contentful-paint"),
          speedIndexMs: numeric("speed-index"),
          ttiMs: numeric("interactive"),
          serverResponseMs: numeric("server-response-time"),
          totalByteWeight: numeric("total-byte-weight"),
          resourceCount: Array.isArray(audits["network-requests"]?.details?.items) ? audits["network-requests"].details.items.length : null,
        },
        field,
        opportunities,
        renderBlockingResources: (Array.isArray(audits["render-blocking-resources"]?.details?.items)
          ? audits["render-blocking-resources"].details.items
          : [])
          .slice(0, 30)
          .map((item: any) => ({
            url: typeof item.url === "string" ? item.url : null,
            type: String(item.resourceType ?? (String(item.url ?? "").match(/\.css(?:\?|$)/i) ? "stylesheet" : "script")),
            savingsMs: typeof item.wastedMs === "number" ? Math.round(item.wastedMs) : null,
            source: "pagespeed" as const,
          })),
      });
    } catch (error) {
      lastError = error instanceof Error ? error.message : "PageSpeed request failed";
    }
  }

  return failure("error", lastError);
}
