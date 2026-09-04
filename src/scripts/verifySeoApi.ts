import { connectDB, disconnectDB } from "../config/db";
import { buildSearchInsights } from "../modules/seo/seo.insights";
import {
  ensurePrimarySite,
  getOverview,
  getPageDetail,
  getScoreExplanation,
  listBrokenLinks,
  listIssues,
  listPages,
  listRedirects,
} from "../modules/seo/seo.service";

async function main(): Promise<void> {
  const site = await ensurePrimarySite();

  const overview = await getOverview(site);
  console.log("== OVERVIEW ==");
  console.log("hasData:", overview.hasData);
  if (overview.hasData) {
    console.log("scores:", JSON.stringify(overview.scores));
    console.log("counts.urlsCrawled:", overview.counts?.urlsCrawled, "critical:", overview.counts?.criticalIssues);
    console.log("search available:", (overview.search as { available: boolean }).available);
    console.log("analytics available:", (overview.analytics as { available: boolean }).available);
    console.log("alerts:", overview.alerts?.length, "topIssues:", overview.topIssues?.length, "history:", overview.history?.length);
  }

  const pages = await listPages(site, { limit: 5, sortBy: "score", sortDir: "asc" });
  console.log("\n== PAGES (page 1 of", pages.meta.totalPages, ", total", pages.meta.total, ") ==");
  for (const page of pages.pages) {
    console.log(
      `${String(page.score).padStart(3)} | ${page.httpStatus} | title:${page.titleStatus} desc:${page.descriptionStatus} h1:${page.h1Status} canon:${page.canonicalStatus} schema:${page.schemaStatus} | in:${page.inLinks} | clicks:${page.search?.clicks} | ${page.url}`,
    );
  }

  const filtered = await listPages(site, { severity: "warning", limit: 3 });
  console.log("\nfilter severity=warning ->", filtered.meta.total, "pages");
  const orphans = await listPages(site, { orphan: true, limit: 3 });
  console.log("filter orphan=true ->", orphans.meta.total, "pages");
  const nonIndexable = await listPages(site, { indexable: false, limit: 3 });
  console.log("filter indexable=false ->", nonIndexable.meta.total, "pages");

  if (pages.pages.length) {
    const detail = await getPageDetail(site, pages.pages[0].id);
    console.log("\n== PAGE DETAIL:", detail.page.url, "==");
    console.log("issues:", detail.issues.length, "| incoming links:", detail.links.incoming.length, "| outgoing:", detail.links.outgoing.length);
    console.log("headings in sequence:", detail.page.headingSequence.length, "| images:", detail.page.images.length);
    console.log("schemas:", detail.page.schemas.map((s) => s.types.join("/")).join(", "));
    console.log("performance audits:", detail.performance.audits.length);
    console.log("search available:", detail.search.available, "| top queries:", detail.search.topQueries.length);
    console.log("history snapshots:", detail.history.length);
    console.log("sample issues:", detail.issues.slice(0, 3).map((i) => `${i.severity}:${i.ruleId}`).join(", "));
  }

  const score = await getScoreExplanation(site);
  console.log("\n== SCORE EXPLANATION ==");
  if (!("categories" in score)) {
    console.log("not available:", score.message);
    return;
  }
  console.log("overall:", score.overall);
  for (const category of score.categories ?? []) {
    console.log(
      `  ${category.category.padEnd(12)} ${String(category.score).padStart(4)}  penalty ${category.rawPenalty}  from ${category.contributions.length} rule(s)`,
    );
  }

  const issues = await listIssues(site, { limit: 5 });
  console.log("\n== ISSUES ==", issues.meta.total, "open");
  const links = await listBrokenLinks(site, { limit: 5 });
  console.log("== BROKEN LINKS ==", links.meta.total);
  for (const link of links.links) console.log(`  ${link.httpStatus} ${link.targetUrl} (${link.affectedPages} pages)`);
  const redirects = await listRedirects(site);
  console.log("== REDIRECT CHAINS ==", redirects.length);

  const insights = await buildSearchInsights(site._id);
  console.log("\n== SEARCH INSIGHTS ==");
  console.log("available:", insights.available, "| window:", insights.rangeStart, "->", insights.rangeEnd);
  console.log("cannibalization:", insights.cannibalization.length, "| contentGaps:", insights.contentGaps.length);
  console.log("rising:", insights.risingQueries.length, "| falling:", insights.fallingQueries.length, "| strikingDistance:", insights.strikingDistance.length);
  if (insights.cannibalization[0]) {
    console.log("  example cannibalization:", insights.cannibalization[0].query, "->", insights.cannibalization[0].pages.map((p) => p.url).join(" | "));
  }
  if (insights.contentGaps[0]) {
    console.log("  example gap:", insights.contentGaps[0].query, `(${insights.contentGaps[0].impressions} impr, ${insights.contentGaps[0].ctr.toFixed(1)}% CTR)`);
  }
}

if (require.main === module) {
  connectDB().then(main).then(disconnectDB).catch((err) => { console.error(err); process.exit(1); });
}
