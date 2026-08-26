import { connectDB, disconnectDB } from "../config/db";
import { logger } from "../config/logger";
import { AccessGrant } from "../models/accessGrant.model";
import { Role } from "../models/role.model";
import { User } from "../models/user.model";

/**
 * Namo Gange Unified Platform — grants every existing super_admin account an
 * organisation: null (= all organisations, all projects) AccessGrant, so Super Admins keep
 * working exactly as before once org/project-scoped routes start requiring authorizeScoped().
 * Idempotent: skips a user who already holds an active all-organisations grant under this role.
 *
 * This does NOT grant anything to admin/case_manager/etc. — those roles are scoped to Moksha's
 * own non-project modules today (via the existing authorize()) and get no implicit Namo
 * Gange/Arogya access. Granting a Namo Gange or Arogya-specific role to a specific staff member is
 * an explicit, individual admin action (via the future AccessGrant management UI), not something
 * this seed does in bulk.
 */
export async function seedAccessGrants(): Promise<void> {
  const superAdminRole = await Role.findOne({ slug: "super_admin" });
  if (!superAdminRole) {
    logger.warn("seedAccessGrants: no super_admin role found — run seed:permissions first, skipping");
    return;
  }

  const superAdmins = await User.find({ roleId: superAdminRole._id });
  let createdCount = 0;

  for (const admin of superAdmins) {
    const exists = await AccessGrant.exists({
      userId: admin._id,
      organisationId: null,
      programCode: null,
      roleId: superAdminRole._id,
      status: "ACTIVE",
    });
    if (exists) continue;

    await AccessGrant.create({
      userId: admin._id,
      organisationId: null,
      programCode: null,
      roleId: superAdminRole._id,
      status: "ACTIVE",
      grantedBy: admin._id, // self-granted at platform bootstrap — there is no other admin yet
      grantedAt: new Date(),
    });
    createdCount++;
  }

  logger.info(`Seeded ${createdCount} new all-organisations AccessGrant(s) for existing super_admin user(s)`);
}

if (require.main === module) {
  connectDB()
    .then(seedAccessGrants)
    .then(disconnectDB)
    .catch((err) => {
      logger.error("Failed to seed access grants", { err });
      process.exit(1);
    });
}
