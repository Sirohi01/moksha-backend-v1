import { connectDB, disconnectDB } from "../config/db";
import { logger } from "../config/logger";
import { seedPermissions } from "./seedPermissions";
import { seedAdmin } from "./seedAdmin";
import { seedNotificationTemplates } from "./seedNotificationTemplates";
import { seedWebsite } from "./seedWebsite";

/** Runs every seed script against a single shared connection — cheaper than each script opening
 * and closing its own, and the only reliably stable option against a local single-node replica
 * set (repeated connect/disconnect cycles were enough to destabilize one in testing). */
async function seedAll(): Promise<void> {
  await connectDB();
  await seedPermissions();
  await seedAdmin();
  await seedNotificationTemplates();
  await seedWebsite();
  await disconnectDB();
}

seedAll().catch((err) => {
  logger.error("Failed to seed", { err });
  process.exit(1);
});
