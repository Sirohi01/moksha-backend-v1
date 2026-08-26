import { connectDB, disconnectDB } from "../config/db";
import { logger } from "../config/logger";
import { Organisation } from "../models/organisation.model";

/**
 * Namo Gange Unified Platform — seeds the three initial organisations. Idempotent: reruns upsert
 * on `code` rather than duplicate, matching seedPermissions.ts's own convention. `code` is
 * immutable once created (see organisation.validation.ts) — it is what every organisation-scoped
 * collection, permission check and integration-config env-var namespace resolves against, so this
 * seed is intentionally the only place these three codes are hardcoded.
 */
interface OrganisationSeed {
  code: string;
  name: string;
  slug: string;
}

const ORGANISATIONS: OrganisationSeed[] = [
  { code: "MOKSHA", name: "Moksha Sewa", slug: "moksha-sewa" },
  { code: "NAMOGANGE", name: "Namo Gange", slug: "namo-gange" },
  { code: "AROGYA", name: "Arogya", slug: "arogya" },
];

export async function seedOrganisations(): Promise<void> {
  let createdCount = 0;
  for (const org of ORGANISATIONS) {
    const exists = await Organisation.exists({ code: org.code });
    if (exists) continue;

    await Organisation.create({ code: org.code, name: org.name, slug: org.slug, status: "ACTIVE" });
    createdCount++;
  }
  logger.info(`Seeded ${createdCount} new organisation(s) (${ORGANISATIONS.length - createdCount} already existed, left untouched)`);
}

if (require.main === module) {
  connectDB()
    .then(seedOrganisations)
    .then(disconnectDB)
    .catch((err) => {
      logger.error("Failed to seed organisations", { err });
      process.exit(1);
    });
}
