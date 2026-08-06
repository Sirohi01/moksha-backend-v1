import { connectDB, disconnectDB } from "../config/db";
import { env } from "../config/env";
import { logger } from "../config/logger";
import { User } from "../models/user.model";
import { Role } from "../models/role.model";
import { hashPassword } from "../lib/password.service";

/** Run after seedPermissions — looks up the "super_admin" role by slug. Exported so seedAll.ts
 * can reuse one connection instead of opening its own (see seedPermissions.ts for why). */
export async function seedAdmin(): Promise<void> {
  const superAdminRole = await Role.findOne({ slug: "super_admin" });
  if (!superAdminRole) {
    throw new Error('The "super_admin" role does not exist yet — run `npm run seed:permissions` first.');
  }

  const existing = await User.findOne({ email: env.SEED_ADMIN_EMAIL });
  if (existing) {
    logger.info(`Admin already exists for ${env.SEED_ADMIN_EMAIL}, skipping`);
  } else {
    const passwordHash = await hashPassword(env.SEED_ADMIN_PASSWORD);
    await User.create({
      name: env.SEED_ADMIN_NAME,
      email: env.SEED_ADMIN_EMAIL,
      phone: env.SEED_ADMIN_PHONE,
      passwordHash,
      userType: "INTERNAL",
      roleId: superAdminRole._id,
      isEmailVerified: true,
      isPhoneVerified: true,
    });
    logger.info(`Super admin created: ${env.SEED_ADMIN_EMAIL}`);
  }
}

if (require.main === module) {
  connectDB()
    .then(seedAdmin)
    .then(disconnectDB)
    .catch((err) => {
      logger.error("Failed to seed admin", { err });
      process.exit(1);
    });
}
