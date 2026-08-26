import { connectDB, disconnectDB } from "../config/db";
import { logger } from "../config/logger";
import { seedPermissions } from "./seedPermissions";
import { seedAdmin } from "./seedAdmin";
import { seedNotificationTemplates } from "./seedNotificationTemplates";
import { seedLandingPage } from "./seedLandingPage";
import { seedOrganisations } from "./seedOrganisations";
import { seedProjects } from "./seedProjects";
import { seedAccessGrants } from "./seedAccessGrants";
async function seedAll(): Promise<void> {
  await connectDB();
  await seedPermissions();
  await seedOrganisations();
  await seedProjects();
  await seedAdmin();
  await seedAccessGrants(); // after seedAdmin — needs the super_admin user to already exist
  await seedNotificationTemplates();
  await seedLandingPage();
  await disconnectDB();
}

seedAll().catch((err) => {
  logger.error("Failed to seed", { err });
  process.exit(1);
});
