import crypto from "node:crypto";
import { BlogPost } from "../../models/blogPost.model";
import { Enquiry } from "../../models/enquiry.model";
import { AssistanceRequest } from "../../models/assistanceRequest.model";
import { Setting } from "../../models/setting.model";
import { env } from "../../config/env";

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

function base64Url(value: string | Buffer): string {
  return Buffer.from(value).toString("base64url");
}

async function getGoogleAccessToken(): Promise<string | null> {
  if (!env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) return null;
  const issuedAt = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64Url(JSON.stringify({
    iss: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    scope: "https://www.googleapis.com/auth/analytics.readonly https://www.googleapis.com/auth/webmasters.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: issuedAt,
    exp: issuedAt + 3600,
  }));
  const unsigned = `${header}.${claim}`;
  const privateKey = env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, "\n");
  const signature = crypto.sign("RSA-SHA256", Buffer.from(unsigned), privateKey);
  const assertion = `${unsigned}.${base64Url(signature)}`;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    signal: AbortSignal.timeout(15_000),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!response.ok) throw new Error("Google service-account authentication failed");
  const body = await response.json() as { access_token?: string };
  if (!body.access_token) throw new Error("Google access token was not returned");
  return body.access_token;
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
    const [values, previous] = await Promise.all([
      run("30daysAgo", "today"),
      run("60daysAgo", "31daysAgo"),
    ]);
    return source("connected", {
      users: values[0] ?? 0, sessions: values[1] ?? 0, pageViews: values[2] ?? 0,
      averageSessionSeconds: values[3] ?? 0, bounceRate: (values[4] ?? 0) * 100,
      conversions: values[5] ?? 0,
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
    const [row, previous] = await Promise.all([run(start, end), run(previousStart, previousEnd)]);
    return source("connected", {
      clicks: row?.clicks ?? 0, impressions: row?.impressions ?? 0,
      ctr: (row?.ctr ?? 0) * 100, position: row?.position ?? 0,
      growth: {
        clicks: growth(row?.clicks ?? 0, previous?.clicks ?? 0),
        impressions: growth(row?.impressions ?? 0, previous?.impressions ?? 0),
        ctr: growth(row?.ctr ?? 0, previous?.ctr ?? 0),
        position: growth(row?.position ?? 0, previous?.position ?? 0),
      },
    });
  } catch (error) {
    return source("error", null, error instanceof Error ? error.message : "Search Console request failed");
  }
}

async function fetchPageSpeed() {
  if (!env.PAGESPEED_API_KEY) return source("not_connected", null, "Add PAGESPEED_API_KEY");
  try {
    const params = new URLSearchParams({ url: env.WEBSITE_URL, key: env.PAGESPEED_API_KEY, strategy: "mobile" });
    ["performance", "seo"].forEach((category) => params.append("category", category));
    const response = await fetch(`https://pagespeedonline.googleapis.com/pagespeedonline/v5/runPagespeed?${params}`, {
      signal: AbortSignal.timeout(45_000),
    });
    if (!response.ok) throw new Error(`PageSpeed returned ${response.status}`);
    const body = await response.json() as any;
    const audits = body.lighthouseResult?.audits ?? {};
    return source("connected", {
      performanceScore: Math.round((body.lighthouseResult?.categories?.performance?.score ?? 0) * 100),
      seoScore: Math.round((body.lighthouseResult?.categories?.seo?.score ?? 0) * 100),
      lcp: audits["largest-contentful-paint"]?.numericValue ?? null,
      inp: audits["interaction-to-next-paint"]?.numericValue ?? null,
      cls: audits["cumulative-layout-shift"]?.numericValue ?? null,
      fcp: audits["first-contentful-paint"]?.numericValue ?? null,
      tbt: audits["total-blocking-time"]?.numericValue ?? null,
    });
  } catch (error) {
    return source("error", null, error instanceof Error ? error.message : "PageSpeed request failed");
  }
}

async function fetchInternalMetrics() {
  const now = new Date();
  const monthStart = new Date();
  monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const previousMonthStart = new Date(monthStart); previousMonthStart.setMonth(previousMonthStart.getMonth() - 1);
  const previousPeriodEnd = new Date(previousMonthStart);
  previousPeriodEnd.setDate(Math.min(now.getDate(), new Date(monthStart.getFullYear(), monthStart.getMonth(), 0).getDate()) + 1);
  const [posts, postsMtd, postsPrevious, enquiries, enquiriesMtd, enquiriesPrevious, requests, recent, locations, settings] = await Promise.all([
    BlogPost.countDocuments(),
    BlogPost.countDocuments({ createdAt: { $gte: monthStart } }),
    BlogPost.countDocuments({ createdAt: { $gte: previousMonthStart, $lt: previousPeriodEnd } }),
    Enquiry.countDocuments(), Enquiry.countDocuments({ createdAt: { $gte: monthStart } }),
    Enquiry.countDocuments({ createdAt: { $gte: previousMonthStart, $lt: previousPeriodEnd } }),
    AssistanceRequest.countDocuments(), Enquiry.find().sort({ createdAt: -1 }).limit(5).select("name category city createdAt").lean(),
    Enquiry.aggregate([{ $match: { city: { $nin: [null, ""] } } }, { $group: { _id: "$city", count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 5 }]),
    Setting.findOne().lean(),
  ]);
  const pageCount = settings
    ? Object.keys(settings).filter((key) => key.toLowerCase().endsWith("page") && (settings as Record<string, unknown>)[key]).length
    : 0;
  return source("connected", {
    totalPages: pageCount, totalPosts: posts, totalEnquiries: enquiries, enquiriesMtd, totalRequests: requests,
    growth: { posts: growth(postsMtd, postsPrevious), enquiriesMtd: growth(enquiriesMtd, enquiriesPrevious) },
    recentSubmissions: recent.map((item) => ({ id: String(item._id), name: item.name, type: item.category, city: item.city, createdAt: item.createdAt })),
    topLocations: locations.map((item: { _id: string; count: number }) => ({ city: item._id, count: item.count })),
  });
}

export async function buildDashboardOverview() {
  let token: string | null = null;
  try { token = await getGoogleAccessToken(); } catch { token = null; }
  const [internal, analytics, searchConsole, pageSpeed] = await Promise.all([
    fetchInternalMetrics(), fetchGa4(token), fetchSearchConsole(token), fetchPageSpeed(),
  ]);
  return { generatedAt: nowIso(), sources: { internal, analytics, searchConsole, pageSpeed } };
}
