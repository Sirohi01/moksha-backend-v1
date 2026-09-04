import { connectDB, disconnectDB } from "../config/db";
import { logger } from "../config/logger";
import { SeoSite } from "../models/seoSite.model";
import { runSeoAudit } from "../modules/seo/seo.orchestrator";
import { ensurePrimarySite } from "../modules/seo/seo.service";
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const siteArg = args.find((arg) => arg.startsWith("--site="))?.split("=")[1];
  const skipPerformance = args.includes("--skip-performance");
  const skipGoogleData = args.includes("--skip-google");

  const site = siteArg ? await SeoSite.findById(siteArg) : await ensurePrimarySite();
  if (!site) throw new Error(`No SEO site found for id ${siteArg}`);

  logger.info(`Auditing ${site.url}`, { skipPerformance, skipGoogleData });
  const startedAt = Date.now();
  const crawl = await runSeoAudit(site._id, { trigger: "manual", skipPerformance, skipGoogleData });

  logger.info("Audit finished", {
    crawlId: String(crawl._id),
    status: crawl.status,
    seconds: Math.round((Date.now() - startedAt) / 1000),
    scores: crawl.scores,
    stats: crawl.stats,
  });

  for (const entry of crawl.log) {
    logger.info(`  [${entry.level}] ${entry.message}`);
  }
}

if (require.main === module) {
  connectDB()
    .then(main)
    .then(disconnectDB)
    .catch((err) => {
      logger.error("SEO audit script failed", { err });
      process.exit(1);
    });
}
