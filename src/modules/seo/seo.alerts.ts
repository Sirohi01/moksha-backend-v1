import { Types } from "mongoose";
import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { sendEmail } from "../../lib/email.service";
import { SeoAlert, SeoAlertType } from "../../models/seoAlert.model";
import { SeoCrawl } from "../../models/seoCrawl.model";
import { SeoIssue } from "../../models/seoIssue.model";
import { SeoPageSnapshot } from "../../models/seoPageSnapshot.model";
import { SeoSearchSnapshot } from "../../models/seoSearchSnapshot.model";
import { SeoSiteSnapshot } from "../../models/seoSiteSnapshot.model";
import type { ISeoSite } from "../../models/seoSite.model";

export const ALERT_THRESHOLDS = {
  scoreDropPoints: 5,
  performanceScoreDropPoints: 10,
  searchClicksDropPercent: 25,
  searchPositionDropPlaces: 3,
} as const;

interface PendingAlert {
  type: SeoAlertType;
  severity: "critical" | "warning" | "notice";
  title: string;
  message: string;
  data: Record<string, unknown>;
}

export async function evaluateAlerts(site: ISeoSite, crawlId: Types.ObjectId): Promise<number> {
  const [current, previous] = await SeoSiteSnapshot.find({ siteId: site._id })
    .sort({ capturedAt: -1 })
    .limit(2)
    .lean();

  if (!current) return 0;

  const alerts: PendingAlert[] = [];

  if (previous) {
    pushScoreAlerts(alerts, current, previous);
    pushCountAlerts(alerts, current, previous);
    pushPerformanceAlerts(alerts, current, previous);
  }

  await pushIssueAlerts(alerts, site._id, crawlId);
  await pushPageChangeAlerts(alerts, site._id, crawlId);
  await pushSearchAlerts(alerts, site._id, crawlId);

  if (!alerts.length) return 0;

  const created = await SeoAlert.insertMany(
    alerts.map((alert) => ({
      siteId: site._id,
      crawlId,
      type: alert.type,
      severity: alert.severity,
      title: alert.title.slice(0, 200),
      message: alert.message.slice(0, 1000),
      data: alert.data,
    })),
    { ordered: false },
  );

  await sendAlertEmail(site, alerts).catch((error) => {
    logger.warn("seoAlerts: email delivery failed", { err: error });
  });

  return created.length;
}

function pushScoreAlerts(
  alerts: PendingAlert[],
  current: { scores: { overall: number | null } },
  previous: { scores: { overall: number | null } },
): void {
  const now = current.scores.overall;
  const before = previous.scores.overall;
  if (now == null || before == null) return;
  const drop = before - now;
  if (drop < ALERT_THRESHOLDS.scoreDropPoints) return;

  alerts.push({
    type: "score_drop",
    severity: drop >= 15 ? "critical" : "warning",
    title: `SEO score dropped ${drop} points`,
    message: `The overall SEO score fell from ${before} to ${now} since the previous audit.`,
    data: { previous: before, current: now, drop },
  });
}

function pushCountAlerts(
  alerts: PendingAlert[],
  current: { counts: Record<string, number> },
  previous: { counts: Record<string, number> },
): void {
  const brokenNow = (current.counts.brokenInternalLinks ?? 0) + (current.counts.brokenExternalLinks ?? 0);
  const brokenBefore = (previous.counts.brokenInternalLinks ?? 0) + (previous.counts.brokenExternalLinks ?? 0);
  if (brokenNow > brokenBefore) {
    alerts.push({
      type: "new_broken_links",
      severity: current.counts.brokenInternalLinks > previous.counts.brokenInternalLinks ? "critical" : "warning",
      title: `${brokenNow - brokenBefore} new broken link(s)`,
      message: `Broken links went from ${brokenBefore} to ${brokenNow}.`,
      data: { previous: brokenBefore, current: brokenNow },
    });
  }

  const sitemapNow = current.counts.urlsCrawled ?? 0;
  if (sitemapNow === 0) {
    alerts.push({
      type: "sitemap_problem",
      severity: "critical",
      title: "No URLs were crawled",
      message: "The audit completed without crawling a single URL. Check the site URL and robots.txt.",
      data: {},
    });
  }
}

function pushPerformanceAlerts(
  alerts: PendingAlert[],
  current: { performance: { score: number | null } },
  previous: { performance: { score: number | null } },
): void {
  const now = current.performance.score;
  const before = previous.performance.score;
  if (now == null || before == null) return;
  const drop = before - now;
  if (drop < ALERT_THRESHOLDS.performanceScoreDropPoints) return;

  alerts.push({
    type: "performance_degraded",
    severity: "warning",
    title: `Lighthouse performance dropped ${Math.round(drop)} points`,
    message: `Average lab performance fell from ${Math.round(before)} to ${Math.round(now)}.`,
    data: { previous: before, current: now },
  });
}

async function pushIssueAlerts(alerts: PendingAlert[], siteId: Types.ObjectId, crawlId: Types.ObjectId): Promise<void> {
  const crawl = await SeoCrawl.findById(crawlId).lean();
  if (!crawl?.startedAt) return;

  const newCritical = await SeoIssue.find({
    siteId,
    crawlId,
    severity: "critical",
    firstSeenAt: { $gte: crawl.startedAt },
  })
    .limit(50)
    .lean();

  if (!newCritical.length) return;

  const notFound = newCritical.filter((issue) => issue.ruleId === "PAGE_NOT_FOUND");
  if (notFound.length) {
    alerts.push({
      type: "new_404_pages",
      severity: "critical",
      title: `${notFound.length} new 404 page(s) detected`,
      message: notFound
        .slice(0, 5)
        .map((issue) => issue.url)
        .filter(Boolean)
        .join(", "),
      data: { urls: notFound.map((issue) => issue.url).slice(0, 25) },
    });
  }

  const others = newCritical.filter((issue) => issue.ruleId !== "PAGE_NOT_FOUND");
  if (others.length) {
    alerts.push({
      type: "new_critical_issue",
      severity: "critical",
      title: `${others.length} new critical SEO issue(s)`,
      message: [...new Set(others.map((issue) => issue.title))].slice(0, 5).join("; "),
      data: {
        rules: [...new Set(others.map((issue) => issue.ruleId))],
        urls: others.map((issue) => issue.url).filter(Boolean).slice(0, 25),
      },
    });
  }
}

async function pushPageChangeAlerts(
  alerts: PendingAlert[],
  siteId: Types.ObjectId,
  crawlId: Types.ObjectId,
): Promise<void> {
  const crawlIds = await SeoCrawl.find({ siteId, status: "completed" })
    .sort({ createdAt: -1 })
    .limit(2)
    .select("_id")
    .lean();

  const previousCrawlId = crawlIds.find((crawl) => String(crawl._id) !== String(crawlId))?._id;
  if (!previousCrawlId) return;

  const [currentSnapshots, previousSnapshots] = await Promise.all([
    SeoPageSnapshot.find({ siteId, crawlId }).select("normalizedUrl indexable canonicalNormalized metaRobots").lean(),
    SeoPageSnapshot.find({ siteId, crawlId: previousCrawlId })
      .select("normalizedUrl indexable canonicalNormalized metaRobots")
      .lean(),
  ]);

  const previousByUrl = new Map(previousSnapshots.map((snapshot) => [snapshot.normalizedUrl, snapshot]));

  const becameNoindex: string[] = [];
  const canonicalChanged: Array<{ url: string; from: string | null; to: string | null }> = [];

  for (const snapshot of currentSnapshots) {
    const before = previousByUrl.get(snapshot.normalizedUrl);
    if (!before) continue;

    const wasNoindex = (before.metaRobots ?? "").toLowerCase().includes("noindex");
    const isNoindex = (snapshot.metaRobots ?? "").toLowerCase().includes("noindex");
    if (!wasNoindex && isNoindex) becameNoindex.push(snapshot.normalizedUrl);

    if ((before.canonicalNormalized ?? null) !== (snapshot.canonicalNormalized ?? null)) {
      canonicalChanged.push({
        url: snapshot.normalizedUrl,
        from: before.canonicalNormalized ?? null,
        to: snapshot.canonicalNormalized ?? null,
      });
    }
  }

  if (becameNoindex.length) {
    alerts.push({
      type: "page_became_noindex",
      severity: "critical",
      title: `${becameNoindex.length} page(s) became noindex`,
      message: becameNoindex.slice(0, 5).join(", "),
      data: { urls: becameNoindex.slice(0, 25) },
    });
  }

  if (canonicalChanged.length) {
    alerts.push({
      type: "canonical_changed",
      severity: "warning",
      title: `Canonical URL changed on ${canonicalChanged.length} page(s)`,
      message: canonicalChanged
        .slice(0, 3)
        .map((change) => `${change.url}: ${change.from ?? "none"} to ${change.to ?? "none"}`)
        .join("; "),
      data: { changes: canonicalChanged.slice(0, 25) },
    });
  }
}

async function pushSearchAlerts(
  alerts: PendingAlert[],
  siteId: Types.ObjectId,
  crawlId: Types.ObjectId,
): Promise<void> {
  const snapshot = await SeoSearchSnapshot.findOne({ siteId, crawlId }).lean();
  if (!snapshot) return;

  const { totals, previousTotals } = snapshot;
  if (previousTotals.clicks > 0) {
    const changePercent = ((totals.clicks - previousTotals.clicks) / previousTotals.clicks) * 100;
    if (changePercent <= -ALERT_THRESHOLDS.searchClicksDropPercent) {
      alerts.push({
        type: "search_clicks_drop",
        severity: changePercent <= -50 ? "critical" : "warning",
        title: `Search clicks down ${Math.abs(Math.round(changePercent))}%`,
        message: `Google Search Console clicks fell from ${previousTotals.clicks} to ${totals.clicks} comparing ${snapshot.rangeStart}–${snapshot.rangeEnd} with the previous period.`,
        data: {
          current: totals.clicks,
          previous: previousTotals.clicks,
          changePercent: Number(changePercent.toFixed(1)),
        },
      });
    }
  }

  if (previousTotals.position > 0 && totals.position > 0) {
    const drop = totals.position - previousTotals.position;
    if (drop >= ALERT_THRESHOLDS.searchPositionDropPlaces) {
      alerts.push({
        type: "search_position_drop",
        severity: "warning",
        title: `Average position worsened by ${drop.toFixed(1)}`,
        message: `Search Console average position moved from ${previousTotals.position.toFixed(1)} to ${totals.position.toFixed(1)}. This is an average across queries, not a live rank.`,
        data: { current: totals.position, previous: previousTotals.position },
      });
    }
  }
}

async function sendAlertEmail(site: ISeoSite, alerts: PendingAlert[]): Promise<void> {
  const recipients = (env.SEO_ALERT_EMAILS ?? env.ADMIN_NOTIFICATION_EMAIL)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (!recipients.length || !env.SMTP_HOST) return;

  const critical = alerts.filter((alert) => alert.severity === "critical");
  if (!critical.length) return;

  const rows = critical
    .map(
      (alert) =>
        `<tr><td style="padding:8px 12px;border-bottom:1px solid #eee"><strong>${alert.title}</strong><br><span style="color:#555">${alert.message}</span></td></tr>`,
    )
    .join("");

  await sendEmail({
    to: recipients.join(","),
    subject: `SEO alert: ${critical.length} critical issue(s) on ${site.label}`,
    html: `<p>The latest SEO audit of <strong>${site.url}</strong> raised ${critical.length} critical alert(s).</p><table style="border-collapse:collapse;width:100%">${rows}</table>`,
  });
}
