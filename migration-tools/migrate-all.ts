import "dotenv/config";
import { execSync } from "child_process";
const STEPS: { label: string; script: string }[] = [
  { label: "Seed organisations (MOKSHA / NAMOGANGE / AROGYA)", script: "src/scripts/seedOrganisations.ts" },
  { label: "Arogya — CMS content", script: "migration-tools/arogya-cms-import.ts" },
  { label: "Arogya — CRM lookups (countries/states/cities/categories/passes/coupons)", script: "migration-tools/arogya-lookups-import.ts" },
  { label: "Namo Gange — CMS content", script: "migration-tools/namogange-cms-import.ts" },
  { label: "Namo Gange — Jobs", script: "migration-tools/namogange-jobs-import.ts" },
  { label: "Namo Gange — Members", script: "migration-tools/namogange-members-import.ts" },
  { label: "Namo Gange — Volunteers", script: "migration-tools/namogange-volunteers-import.ts" },
  { label: "Namo Gange — Leads (job applications, enquiries, support, donations)", script: "migration-tools/namogange-leads-import.ts" },
  { label: "Namo Gange — Remaining (lookups, AGS events, colleges, client statuses)", script: "migration-tools/namogange-remaining-import.ts" },
  { label: "Sync permissions", script: "src/scripts/seedPermissions.ts" },
];

function maskUri(uri: string | undefined): string {
  if (!uri) return "(not set)";
  return uri.replace(/\/\/[^@]+@/, "//<credentials-hidden>@");
}

function main() {
  console.log("=== Migration target/source (host only, credentials hidden) ===");
  console.log("Target  MONGODB_URI:                 ", maskUri(process.env.MONGODB_URI));
  console.log("Source  MIGRATION_AROGYA_MONGO_URI:   ", maskUri(process.env.MIGRATION_AROGYA_MONGO_URI));
  console.log("Source  MIGRATION_NAMOGANGE_MONGO_URI:", maskUri(process.env.MIGRATION_NAMOGANGE_MONGO_URI));
  console.log("=================================================================\n");

  if (!process.env.MIGRATION_AROGYA_MONGO_URI || !process.env.MIGRATION_NAMOGANGE_MONGO_URI) {
    console.error("MIGRATION_AROGYA_MONGO_URI and/or MIGRATION_NAMOGANGE_MONGO_URI are not set in .env — aborting.");
    process.exit(1);
  }

  for (const [index, step] of STEPS.entries()) {
    console.log(`\n--- Step ${index + 1}/${STEPS.length}: ${step.label} ---`);
    try {
      execSync(`npx tsx ${step.script}`, { stdio: "inherit" });
    } catch {
      console.error(`\nFAILED at step ${index + 1} (${step.label}). Fix the error above and re-run — earlier steps are safe to repeat.`);
      process.exit(1);
    }
  }

  console.log("\n=== All migration steps completed successfully. ===");
}

main();
