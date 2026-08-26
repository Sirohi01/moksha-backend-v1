import { connectDB, disconnectDB } from "../config/db";
import { logger } from "../config/logger";
import { Permission } from "../models/permission.model";
import { Role } from "../models/role.model";
import { PermissionAction } from "../utils/constants";
interface PermissionSeed {
  module: string;
  action: PermissionAction;
  label: string;
  scopeQualifier?: "ALL" | "OWN";
}

const PERMISSIONS: PermissionSeed[] = [
  { module: "requests", action: "create", label: "Create assistance requests" },
  { module: "requests", action: "read", label: "View assistance requests" },
  { module: "requests", action: "update", label: "Edit assistance requests" },

  { module: "cases", action: "create", label: "Create cases" },
  { module: "cases", action: "read", label: "View cases" },
  { module: "cases", action: "update", label: "Update cases" },
  { module: "cases", action: "approve", label: "Verify/approve cases" },
  { module: "cases", action: "assign", label: "Assign volunteers to cases" },

  { module: "volunteers", action: "read", label: "View volunteers" },
  { module: "volunteers", action: "update", label: "Manage volunteers" },

  { module: "donations", action: "read", label: "View donations" },
  { module: "donations", action: "create", label: "Record offline donations" },
  { module: "donations", action: "update", label: "Manage donations (refunds, receipts)" },
  { module: "donations", action: "export", label: "Export donation register" },

  { module: "campaigns", action: "read", label: "View campaigns" },
  { module: "campaigns", action: "create", label: "Create campaigns" },
  { module: "campaigns", action: "update", label: "Update campaigns" },

  { module: "expenses", action: "create", label: "Record case expenses" },
  { module: "expenses", action: "read", label: "View case expenses" },
  { module: "expenses", action: "approve", label: "Approve/reject expenses" },

  { module: "partners", action: "read", label: "View partners" },
  { module: "partners", action: "create", label: "Create partners" },
  { module: "partners", action: "update", label: "Update partners" },

  // Operational reference data: cremation grounds, vehicles, service providers, expense
  // categories — grouped under one module key since they're all the same kind of admin-managed
  // lookup data, not separate operational domains in their own right.
  { module: "masters", action: "read", label: "View operational masters (logistics, expense categories)" },
  { module: "masters", action: "update", label: "Manage operational masters (logistics, expense categories)" },

  { module: "cms", action: "read", label: "View CMS content" },
  { module: "cms", action: "create", label: "Create CMS content" },
  { module: "cms", action: "update", label: "Update CMS content" },

  { module: "media", action: "create", label: "Upload media" },

  { module: "seo", action: "read", label: "View SEO metadata" },
  { module: "seo", action: "update", label: "Manage SEO metadata" },

  { module: "users", action: "read", label: "View internal users" },
  { module: "users", action: "create", label: "Invite internal users" },
  { module: "users", action: "update", label: "Manage internal users" },

  { module: "roles", action: "read", label: "View roles & permissions" },
  { module: "roles", action: "create", label: "Create/edit roles" },

  { module: "reports", action: "read", label: "View reports" },
  { module: "reports", action: "export", label: "Export reports / freeze snapshots" },

  { module: "settings", action: "read", label: "View settings" },
  { module: "settings", action: "update", label: "Manage settings" },

  { module: "audit", action: "read", label: "View audit logs" },

  { module: "enquiries", action: "read", label: "View contact enquiries" },
  { module: "enquiries", action: "update", label: "Handle/close contact enquiries" },
  { module: "organisations", action: "read", label: "View organisations" },
  { module: "organisations", action: "create", label: "Create organisations" },
  { module: "organisations", action: "update", label: "Update organisations" },

  { module: "projects", action: "read", label: "View projects" },
  { module: "projects", action: "create", label: "Create projects" },
  { module: "projects", action: "update", label: "Update projects" },

  // Who gets access to which organisation/project — deliberately not folded into
  // organisations.*/projects.* (managing the tenant list itself vs. granting a staff member
  // access within it are different capabilities, and separating them lets a future role manage
  // one without the other).
  { module: "accessGrants", action: "read", label: "View organisation/project access grants" },
  { module: "accessGrants", action: "create", label: "Grant organisation/project access" },
  { module: "accessGrants", action: "delete", label: "Revoke organisation/project access" },

  { module: "jobs", action: "read", label: "View jobs" },
  { module: "jobs", action: "create", label: "Create jobs" },
  { module: "jobs", action: "update", label: "Update jobs" },
  { module: "jobs", action: "delete", label: "Delete jobs" },
  { module: "members", action: "read", label: "View Namo Gange members" },
  { module: "members", action: "update", label: "Review and manage Namo Gange members" },
  { module: "namoVolunteers", action: "read", label: "View Namo Gange volunteers" },
  { module: "namoVolunteers", action: "update", label: "Review and manage Namo Gange volunteers" },

  { module: "agsDelegates", action: "read", label: "View AGS delegates" },
  { module: "agsDelegates", action: "create", label: "Create AGS delegates" },
  { module: "agsDelegates", action: "update", label: "Update AGS delegates" },
  { module: "agsDelegates", action: "delete", label: "Delete AGS delegates" },
  { module: "agsPayments", action: "read", label: "View AGS payments" },
  { module: "agsPayments", action: "create", label: "Record AGS payments" },
  { module: "agsPayments", action: "update", label: "Update/cancel AGS payments" },

  { module: "arogyaDelegates", action: "read", label: "View Arogya delegate registrations" },
  { module: "arogyaDelegates", action: "create", label: "Record offline/cash Arogya delegate registrations" },
];

const ALL_KEYS = PERMISSIONS.map((p) => `${p.module}.${p.action}`);
const ROLE_SEEDS: {
  name: string;
  slug: string;
  description: string;
  isSystem: boolean;
  keys: string[];
}[] = [
    {
      name: "Super Admin",
      slug: "super_admin",
      description: "Full access to all modules, settings, integrations and role management.",
      isSystem: true,
      keys: ALL_KEYS,
    },
    {
      name: "Admin",
      slug: "admin",
      description: "Manages all operational modules; cannot touch system settings or roles.",
      isSystem: true,
      keys: [
        "requests.create", "requests.read", "requests.update",
        "cases.create", "cases.read", "cases.update", "cases.approve", "cases.assign",
        "volunteers.read", "volunteers.update",
        "donations.read",
        "campaigns.read", "campaigns.create", "campaigns.update",
        "expenses.create", "expenses.read",
        "partners.read", "partners.create", "partners.update",
        "masters.read", "masters.update",
        "cms.read", "cms.create", "cms.update",
        "media.create",
        "seo.read",
        "reports.read",
        "audit.read",
        "enquiries.read", "enquiries.update",
        "jobs.read", "jobs.create", "jobs.update", "jobs.delete",
        "members.read", "members.update",
        "namoVolunteers.read", "namoVolunteers.update",
        "agsDelegates.read", "agsDelegates.create", "agsDelegates.update", "agsDelegates.delete",
        "agsPayments.read", "agsPayments.create", "agsPayments.update",
        "arogyaDelegates.read", "arogyaDelegates.create",
      ],
    },
    {
      name: "Case Manager",
      slug: "case_manager",
      description: "Owns assigned cases end to end: verification, assignment, documents, expenses.",
      isSystem: true,
      keys: [
        "requests.create", "requests.read", "requests.update",
        "cases.create", "cases.read", "cases.update", "cases.approve", "cases.assign",
        "expenses.create", "expenses.read",
        "masters.read",
        "media.create",
        "reports.read",
      ],
    },
    {
      name: "Volunteer Manager",
      slug: "volunteer_manager",
      description: "Manages the volunteer directory, verification, availability and assignment overrides.",
      isSystem: true,
      keys: ["requests.read", "cases.read", "cases.assign", "volunteers.read", "volunteers.update", "reports.read"],
    },
    {
      name: "Accounts Manager",
      slug: "accounts_manager",
      description: "Manages donations, receipts, 80G certificates, expense approval and financial reports.",
      isSystem: true,
      keys: [
        "donations.read", "donations.create", "donations.update", "donations.export",
        "campaigns.read",
        "expenses.read", "expenses.approve",
        "reports.read", "reports.export",
      ],
    },
    {
      name: "Content Manager",
      slug: "content_manager",
      description: "Manages pages, blogs, FAQs, testimonials, media and all SEO metadata.",
      isSystem: true,
      keys: ["cms.read", "cms.create", "cms.update", "media.create", "seo.read", "seo.update", "campaigns.read", "campaigns.update"],
    },
    {
      name: "Support Executive",
      slug: "support_executive",
      description: "Handles contact enquiries and inbound calls; can log a request on behalf of a caller.",
      isSystem: true,
      keys: ["requests.create", "requests.read", "cases.read", "enquiries.read", "enquiries.update"],
    },
    {
      name: "Volunteer",
      slug: "volunteer",
      description: "Field volunteer — sees only cases assigned to them.",
      isSystem: true,
      keys: ["cases.read", "media.create"],
    },
    {
      name: "Donor",
      slug: "donor",
      description: "Self-service donor portal: own donation history, receipts and 80G certificates.",
      isSystem: true,
      keys: ["donations.read"],
    },
  ];

/** Exported so seedAll.ts (and tests) can run this against an already-open connection instead of
 * each seed script opening and closing its own — cheap in production against a real replica set,
 * but repeated connect/disconnect cycles are enough to destabilize a local single-node test one. */
export async function seedPermissions(): Promise<void> {
  const keyToId = new Map<string, string>();

  for (const perm of PERMISSIONS) {
    const key = `${perm.module}.${perm.action}`;
    const doc = await Permission.findOneAndUpdate(
      { key },
      {
        key,
        module: perm.module,
        action: perm.action,
        label: perm.label,
        scopeQualifier: perm.scopeQualifier ?? "ALL",
      },
      { upsert: true, new: true }
    );
    keyToId.set(key, doc._id.toString());
  }
  logger.info(`Seeded ${PERMISSIONS.length} permissions`);
  let createdCount = 0;
  for (const role of ROLE_SEEDS) {
    const exists = await Role.exists({ slug: role.slug });
    if (exists) continue;

    const permissionIds = role.keys.map((key) => {
      const id = keyToId.get(key);
      if (!id) throw new Error(`Unknown permission key in role seed: ${key}`);
      return id;
    });

    await Role.create({
      name: role.name,
      slug: role.slug,
      description: role.description,
      isSystem: role.isSystem,
      permissionIds,
    });
    createdCount++;
  }
  logger.info(`Seeded ${createdCount} new role(s) (${ROLE_SEEDS.length - createdCount} already existed, left untouched)`);
  const superAdminRole = await Role.findOne({ slug: "super_admin" });
  if (superAdminRole) {
    const allPermissionIds = ALL_KEYS.map((key) => {
      const id = keyToId.get(key);
      if (!id) throw new Error(`Unknown permission key while syncing super_admin: ${key}`);
      return id;
    });
    const missingCount = allPermissionIds.filter(
      (id) => !superAdminRole.permissionIds.some((existing) => existing.toString() === id)
    ).length;
    if (missingCount > 0) {
      superAdminRole.permissionIds = allPermissionIds as unknown as typeof superAdminRole.permissionIds;
      await superAdminRole.save();
      logger.info(`Synced super_admin role with ${missingCount} newly-added permission key(s)`);
    }
  }
}
if (require.main === module) {
  connectDB()
    .then(seedPermissions)
    .then(disconnectDB)
    .catch((err) => {
      logger.error("Failed to seed permissions/roles", { err });
      process.exit(1);
    });
}
