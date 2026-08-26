import "dotenv/config";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { connectDB, disconnectDB } from "../config/db";
import { logger } from "../config/logger";
import { getSettings } from "../modules/setting/setting.service";

interface LandingContentModule {
  defaultLandingSections: unknown[];
}

async function loadLandingSections(): Promise<unknown[]> {
  const adminDefaults = path.resolve(__dirname, "../../../moksha-admin/lib/landingContent.ts");
  const module = (await import(pathToFileURL(adminDefaults).href)) as unknown as LandingContentModule;
  return module.defaultLandingSections;
}

export async function seedLandingPage(): Promise<void> {
  const sections = await loadLandingSections();
  const settings = await getSettings();
  settings.landingPage = { sections: sections as never };
  await settings.save();
  logger.info(`Landing page seeded with ${sections.length} sections.`);
}

if (require.main === module) {
  connectDB()
    .then(seedLandingPage)
    .then(disconnectDB)
    .catch((err) => {
      logger.error("Failed to seed landing page", { err });
      process.exit(1);
    });
}
