import { Types } from "mongoose";
import { SeoPage } from "../../models/seoPage.model";
import { SeoSearchSnapshot } from "../../models/seoSearchSnapshot.model";
import { normalizeUrl } from "./crawler/url.util";

export const INSIGHT_THRESHOLDS = {
  cannibalizationMinImpressions: 10,
  cannibalizationMinPages: 2,
  contentGapMinImpressions: 20,
  contentGapMaxCtr: 2,
  lowCtrMinImpressions: 50,
  lowCtrThreshold: 1.5,
  risingMinImpressions: 10,
  page1Threshold: 10,
  strikingDistanceMin: 4,
  strikingDistanceMax: 20,
} as const;

export interface CannibalizationGroup {
  query: string;
  totalClicks: number;
  totalImpressions: number;
  pages: Array<{
    url: string;
    title: string | null;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
    wordCount: number | null;
  }>;
}

export interface ContentGapRow {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  bestPage: string | null;
  bestPageTitle: string | null;
  bestPageWordCount: number | null;
  reason: string;
}

export interface QueryTrendRow {
  query: string;
  clicks: number;
  previousClicks: number;
  impressions: number;
  previousImpressions: number;
  position: number;
  previousPosition: number;
  clicksChange: number;
  positionChange: number;
}

export interface SearchInsights {
  available: boolean;
  message: string | null;
  rangeStart: string | null;
  rangeEnd: string | null;
  windowDays: number | null;
  cannibalization: CannibalizationGroup[];
  contentGaps: ContentGapRow[];
  risingQueries: QueryTrendRow[];
  fallingQueries: QueryTrendRow[];
  highImpressionLowCtr: ContentGapRow[];
  strikingDistance: QueryTrendRow[];
  pagesLosingClicks: Array<{ page: string; clicks: number; previousClicks: number; change: number }>;
}

const EMPTY_INSIGHTS: SearchInsights = {
  available: false,
  message: "No Search Console snapshot has been captured yet.",
  rangeStart: null,
  rangeEnd: null,
  windowDays: null,
  cannibalization: [],
  contentGaps: [],
  risingQueries: [],
  fallingQueries: [],
  highImpressionLowCtr: [],
  strikingDistance: [],
  pagesLosingClicks: [],
};

export async function buildSearchInsights(siteId: Types.ObjectId | string): Promise<SearchInsights> {
  const snapshot = await SeoSearchSnapshot.findOne({ siteId }).sort({ capturedAt: -1 }).lean();
  if (!snapshot) return EMPTY_INSIGHTS;

  const pages = await SeoPage.find({ siteId })
    .select("normalizedUrl title wordCount")
    .lean();
  const pageByNormalized = new Map(pages.map((page) => [page.normalizedUrl, page]));

  const lookupPage = (rawUrl: string) => {
    const normalized = normalizeUrl(rawUrl)?.normalized;
    return normalized ? pageByNormalized.get(normalized) ?? null : null;
  };

  const cannibalization = buildCannibalization(snapshot.queryPagePairs, lookupPage);
  const { contentGaps, highImpressionLowCtr } = buildContentGaps(snapshot.byQuery, snapshot.queryPagePairs, lookupPage);
  const { rising, falling, striking } = buildQueryTrends(snapshot.byQuery, snapshot.previousByQuery);
  const pagesLosingClicks = buildPageTrends(snapshot.byPage, snapshot.previousByPage);

  return {
    available: true,
    message: null,
    rangeStart: snapshot.rangeStart,
    rangeEnd: snapshot.rangeEnd,
    windowDays: snapshot.windowDays,
    cannibalization,
    contentGaps,
    risingQueries: rising,
    fallingQueries: falling,
    highImpressionLowCtr,
    strikingDistance: striking,
    pagesLosingClicks,
  };
}

type PageLookup = (url: string) => { title?: string | null; wordCount?: number } | null;

function buildCannibalization(
  pairs: Array<{ query: string; page: string; clicks: number; impressions: number; ctr: number; position: number }>,
  lookupPage: PageLookup,
): CannibalizationGroup[] {
  const byQuery = new Map<string, typeof pairs>();
  for (const pair of pairs) {
    if (!pair.query) continue;
    if (!byQuery.has(pair.query)) byQuery.set(pair.query, []);
    byQuery.get(pair.query)!.push(pair);
  }

  const groups: CannibalizationGroup[] = [];
  for (const [query, rows] of byQuery) {
    const meaningful = rows.filter((row) => row.impressions >= INSIGHT_THRESHOLDS.cannibalizationMinImpressions);
    if (meaningful.length < INSIGHT_THRESHOLDS.cannibalizationMinPages) continue;

    groups.push({
      query,
      totalClicks: meaningful.reduce((sum, row) => sum + row.clicks, 0),
      totalImpressions: meaningful.reduce((sum, row) => sum + row.impressions, 0),
      pages: meaningful
        .sort((a, b) => b.impressions - a.impressions)
        .slice(0, 10)
        .map((row) => {
          const page = lookupPage(row.page);
          return {
            url: row.page,
            title: page?.title ?? null,
            clicks: row.clicks,
            impressions: row.impressions,
            ctr: row.ctr,
            position: row.position,
            wordCount: page?.wordCount ?? null,
          };
        }),
    });
  }

  return groups.sort((a, b) => b.totalImpressions - a.totalImpressions).slice(0, 50);
}

function buildContentGaps(
  queries: Array<{ key: string; clicks: number; impressions: number; ctr: number; position: number }>,
  pairs: Array<{ query: string; page: string; clicks: number; impressions: number; ctr: number; position: number }>,
  lookupPage: PageLookup,
): { contentGaps: ContentGapRow[]; highImpressionLowCtr: ContentGapRow[] } {
  const bestPageByQuery = new Map<string, { page: string; impressions: number }>();
  for (const pair of pairs) {
    const existing = bestPageByQuery.get(pair.query);
    if (!existing || pair.impressions > existing.impressions) {
      bestPageByQuery.set(pair.query, { page: pair.page, impressions: pair.impressions });
    }
  }

  const toRow = (
    query: { key: string; clicks: number; impressions: number; ctr: number; position: number },
    reason: string,
  ): ContentGapRow => {
    const best = bestPageByQuery.get(query.key);
    const page = best ? lookupPage(best.page) : null;
    return {
      query: query.key,
      clicks: query.clicks,
      impressions: query.impressions,
      ctr: query.ctr,
      position: query.position,
      bestPage: best?.page ?? null,
      bestPageTitle: page?.title ?? null,
      bestPageWordCount: page?.wordCount ?? null,
      reason,
    };
  };

  const contentGaps = queries
    .filter(
      (query) =>
        query.impressions >= INSIGHT_THRESHOLDS.contentGapMinImpressions &&
        query.ctr <= INSIGHT_THRESHOLDS.contentGapMaxCtr,
    )
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 50)
    .map((query) =>
      toRow(
        query,
        query.position > INSIGHT_THRESHOLDS.page1Threshold
          ? "Earns impressions but ranks beyond page one"
          : "Ranks on page one but attracts almost no clicks",
      ),
    );

  const highImpressionLowCtr = queries
    .filter(
      (query) =>
        query.impressions >= INSIGHT_THRESHOLDS.lowCtrMinImpressions &&
        query.ctr < INSIGHT_THRESHOLDS.lowCtrThreshold,
    )
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 50)
    .map((query) => toRow(query, "High impressions with very low click-through rate"));

  return { contentGaps, highImpressionLowCtr };
}

function buildQueryTrends(
  current: Array<{ key: string; clicks: number; impressions: number; ctr: number; position: number }>,
  previous: Array<{ key: string; clicks: number; impressions: number; ctr: number; position: number }>,
): { rising: QueryTrendRow[]; falling: QueryTrendRow[]; striking: QueryTrendRow[] } {
  const previousByKey = new Map(previous.map((row) => [row.key, row]));

  const rows: QueryTrendRow[] = current
    .filter((row) => row.impressions >= INSIGHT_THRESHOLDS.risingMinImpressions)
    .map((row) => {
      const before = previousByKey.get(row.key);
      return {
        query: row.key,
        clicks: row.clicks,
        previousClicks: before?.clicks ?? 0,
        impressions: row.impressions,
        previousImpressions: before?.impressions ?? 0,
        position: row.position,
        previousPosition: before?.position ?? 0,
        clicksChange: row.clicks - (before?.clicks ?? 0),
        positionChange: before?.position ? before.position - row.position : 0,
      };
    });

  const rising = rows
    .filter((row) => row.clicksChange > 0 || row.positionChange > 0.5)
    .sort((a, b) => b.clicksChange - a.clicksChange || b.positionChange - a.positionChange)
    .slice(0, 25);

  const falling = rows
    .filter((row) => row.clicksChange < 0 || row.positionChange < -0.5)
    .sort((a, b) => a.clicksChange - b.clicksChange || a.positionChange - b.positionChange)
    .slice(0, 25);

  const striking = rows
    .filter(
      (row) =>
        row.position >= INSIGHT_THRESHOLDS.strikingDistanceMin &&
        row.position <= INSIGHT_THRESHOLDS.strikingDistanceMax,
    )
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 25);

  return { rising, falling, striking };
}

function buildPageTrends(
  current: Array<{ key: string; clicks: number }>,
  previous: Array<{ key: string; clicks: number }>,
): Array<{ page: string; clicks: number; previousClicks: number; change: number }> {
  const previousByKey = new Map(previous.map((row) => [row.key, row.clicks]));
  return current
    .map((row) => {
      const previousClicks = previousByKey.get(row.key) ?? 0;
      return { page: row.key, clicks: row.clicks, previousClicks, change: row.clicks - previousClicks };
    })
    .filter((row) => row.change < 0)
    .sort((a, b) => a.change - b.change)
    .slice(0, 25);
}
