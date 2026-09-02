import { connectDB, disconnectDB } from "../config/db";
import { logger } from "../config/logger";
import { Permission } from "../models/permission.model";
import { Role } from "../models/role.model";
import { PermissionAction } from "../utils/constants";

/**
 * PRD §11.3 "permissions" — seeded at deployment from this versioned fixture so new
 * permissions arrive with the code that uses them (PRD's own convention). Idempotent: reruns
 * upsert rather than duplicate.
 */
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

  { module: "systemServices", action: "read", label: "View external services & expiry" },
  { module: "systemServices", action: "update", label: "Manage external services & expiry" },

  { module: "audit", action: "read", label: "View audit logs" },

  { module: "enquiries", action: "read", label: "View contact enquiries" },
  { module: "enquiries", action: "update", label: "Handle/close contact enquiries" },
];

const ALL_KEYS = PERMISSIONS.map((p) => `${p.module}.${p.action}`);

/** PRD §6.2 permission matrix, condensed to the key set above. Not a perfect cell-by-cell
 * transcription (some F/W/R/A/O nuances collapse to a single ALL-scope key for now) — roles are
 * data and can be refined from the admin panel without a code change, per the PRD's own design. */
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

  // Roles are only ever CREATED here, never updated — once a role exists, its permission set is
  // admin-owned data (editable from the Roles UI), and a re-run of this script must not silently
  // clobber those edits. A newly-added permission key reaching an existing role is therefore a
  // conscious admin decision, not something a redeploy does automatically.
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
}

// Only run standalone (own connection) when invoked directly — `npm run seed:permissions` or
// `tsx src/scripts/seedPermissions.ts`. seedAll.ts imports seedPermissions() and reuses its own.
if (require.main === module) {
  connectDB()
    .then(seedPermissions)
    .then(disconnectDB)
    .catch((err) => {
      logger.error("Failed to seed permissions/roles", { err });
      process.exit(1);
    });
}
