import { Types } from "mongoose";
import { ApiError } from "../../utils/ApiError";
import { SeoPage } from "../../models/seoPage.model";
import { SeoSite, ISeoSite } from "../../models/seoSite.model";
import { SeoSiteSnapshot } from "../../models/seoSiteSnapshot.model";
import { assertSafeUrl, normalizeUrl } from "./crawler/url.util";

export async function createCompetitor(url: string, label: string): Promise<ISeoSite> {
  const normalized = normalizeUrl(url);
  if (!normalized) throw ApiError.badRequest("Competitor URL is not a valid HTTP(S) URL");

  const safety = await assertSafeUrl(normalized.href);
  if (!safety.safe) throw ApiError.badRequest(safety.reason ?? "That URL cannot be crawled");

  const existing = await SeoSite.findOne({ origin: normalized.origin });
  if (existing) throw ApiError.conflict("That site is already tracked");

  return SeoSite.create({
    url: normalized.href,
    origin: normalized.origin,
    label,
    type: "competitor",
    crawlSettings: {
      maxPages: 60,
      maxDepth: 3,
      maxPerformanceUrls: 1,
      checkExternalLinks: false,
    },
  });
}

export async function listCompetitors() {
  const sites = await SeoSite.find({ type: "competitor" }).sort({ createdAt: -1 }).lean();
  return sites.map((site) => ({
    id: String(site._id),
    url: site.url,
    label: site.label,
    isActive: site.isActive,
    lastCrawlAt: site.lastCrawlAt,
    lastScore: site.lastScore,
  }));
}

export async function deleteCompetitor(id: string) {
  if (!Types.ObjectId.isValid(id)) throw ApiError.badRequest("Invalid competitor id");
  const site = await SeoSite.findOne({ _id: id, type: "competitor" });
  if (!site) throw ApiError.notFound("Competitor not found");
  await site.deleteOne();
  return { id };
}

interface CrawlProfile {
  siteId: string;
  label: string;
  url: string;
  lastCrawlAt: Date | null;
  observed: {
    pagesCrawled: number;
    indexablePages: number;
    averageWordCount: number | null;
    medianWordCount: number | null;
    pagesWithTitle: number;
    averageTitleLength: number | null;
    pagesWithMetaDescription: number;
    averageDescriptionLength: number | null;
    pagesWithSingleH1: number;
    averageH2PerPage: number | null;
    pagesWithSchema: number;
    schemaTypes: string[];
    pagesWithBreadcrumbSchema: number;
    averageInternalLinksOut: number | null;
    averageCrawlDepth: number | null;
    maxCrawlDepth: number | null;
    pagesWithOpenGraph: number;
    imagesMissingAltTotal: number;
  };
  scores: Record<string, number | null> | null;
  performance: {
    score: number | null;
    lcpMs: number | null;
    clsScore: number | null;
    fieldDataAvailable: boolean;
  } | null;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[middle - 1] + sorted[middle]) / 2) : sorted[middle];
}

function average(values: number[]): number | null {
  if (!values.length) return null;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1));
}

async function buildProfile(site: ISeoSite): Promise<CrawlProfile> {
  const pages = await SeoPage.find({ siteId: site._id, crawlId: site.lastCrawlId, httpStatus: 200 })
    .select(
      "title titleLength metaDescription metaDescriptionLength h1 h2 wordCount schemaTypes hasBreadcrumbSchema outLinks depth ogTitle ogImage imagesMissingAlt indexable headingCounts",
    )
    .lean();

  const snapshot = site.lastCrawlId
    ? await SeoSiteSnapshot.findOne({ siteId: site._id, crawlId: site.lastCrawlId }).lean()
    : null;

  const wordCounts = pages.map((page) => page.wordCount).filter((value) => value > 0);
  const depths = pages.map((page) => page.depth).filter((value): value is number => value != null);
  const schemaTypes = [...new Set(pages.flatMap((page) => page.schemaTypes ?? []))];

  return {
    siteId: String(site._id),
    label: site.label,
    url: site.url,
    lastCrawlAt: site.lastCrawlAt,
    observed: {
      pagesCrawled: pages.length,
      indexablePages: pages.filter((page) => page.indexable).length,
      averageWordCount: average(wordCounts),
      medianWordCount: median(wordCounts),
      pagesWithTitle: pages.filter((page) => Boolean(page.title)).length,
      averageTitleLength: average(pages.map((page) => page.titleLength).filter((value) => value > 0)),
      pagesWithMetaDescription: pages.filter((page) => Boolean(page.metaDescription)).length,
      averageDescriptionLength: average(
        pages.map((page) => page.metaDescriptionLength).filter((value) => value > 0),
      ),
      pagesWithSingleH1: pages.filter((page) => (page.h1 ?? []).length === 1).length,
      averageH2PerPage: average(pages.map((page) => (page.h2 ?? []).length)),
      pagesWithSchema: pages.filter((page) => (page.schemaTypes ?? []).length > 0).length,
      schemaTypes,
      pagesWithBreadcrumbSchema: pages.filter((page) => page.hasBreadcrumbSchema).length,
      averageInternalLinksOut: average(pages.map((page) => page.outLinks)),
      averageCrawlDepth: average(depths),
      maxCrawlDepth: depths.length ? Math.max(...depths) : null,
      pagesWithOpenGraph: pages.filter((page) => Boolean(page.ogTitle && page.ogImage)).length,
      imagesMissingAltTotal: pages.reduce((sum, page) => sum + (page.imagesMissingAlt ?? 0), 0),
    },
    scores: snapshot
      ? {
          overall: snapshot.scores.overall,
          technical: snapshot.scores.technical,
          onPage: snapshot.scores.onPage,
          content: snapshot.scores.content,
          performance: snapshot.scores.performance,
        }
      : null,
    performance: snapshot
      ? {
          score: snapshot.performance.score,
          lcpMs: snapshot.performance.lcpMs,
          clsScore: snapshot.performance.clsScore,
          fieldDataAvailable: snapshot.performance.fieldDataAvailable,
        }
      : null,
  };
}

export async function compareCompetitors(primarySite: ISeoSite) {
  const competitors = await SeoSite.find({ type: "competitor", isActive: true });

  const [primaryProfile, competitorProfiles] = await Promise.all([
    buildProfile(primarySite),
    Promise.all(competitors.map((site) => buildProfile(site))),
  ]);

  return {
    dataSourceNotes: {
      observed: "Every number below is observed directly from crawling the site's public HTML.",
      searchAndTraffic:
        "No competitor traffic, ranking, search-volume or backlink data is available — Search Console and Analytics only cover your own property.",
    },
    primary: primaryProfile,
    competitors: competitorProfiles,
    pendingCrawl: competitorProfiles
      .filter((profile) => profile.observed.pagesCrawled === 0)
      .map((profile) => ({ siteId: profile.siteId, label: profile.label })),
  };
}
