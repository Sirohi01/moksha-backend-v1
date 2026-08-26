import { connectDB, disconnectDB } from "../config/db";
import { logger } from "../config/logger";
import { Organisation } from "../models/organisation.model";
import { Project } from "../models/project.model";
interface ProjectSeed {
  organisationCode: string;
  programCode: string;
  code: string;
  name: string;
  editionLabel: string;
}

const PROJECTS: ProjectSeed[] = [
  {
    organisationCode: "AROGYA",
    programCode: "AROGYA-SANGOSHTI",
    code: "AROGYA-SANGOSHTI-2026",
    name: "18th Integrated Arogya Sangosthi 2026",
    editionLabel: "2026",
  },
];

const RETIRED_NAMOGANGE_PROJECT_CODES = ["AGS-2026", "TGYM-2026"];

export async function seedProjects(): Promise<void> {
  const namoGange = await Organisation.findOne({ code: "NAMOGANGE" });
  if (namoGange) {
    const retired = await Project.updateMany(
      { organisationId: namoGange._id, code: { $in: RETIRED_NAMOGANGE_PROJECT_CODES }, status: "ACTIVE" },
      { $set: { status: "INACTIVE" } }
    );
    if (retired.modifiedCount) {
      logger.info(`Deactivated ${retired.modifiedCount} retired Namo Gange project seed record(s)`);
    }
  }

  let createdCount = 0;
  for (const seed of PROJECTS) {
    const exists = await Project.exists({ code: seed.code });
    if (exists) continue;

    const organisation = await Organisation.findOne({ code: seed.organisationCode });
    if (!organisation) {
      logger.warn(`seedProjects: organisation ${seed.organisationCode} not found — run seed:organisations first, skipping ${seed.code}`);
      continue;
    }

    await Project.create({
      organisationId: organisation._id,
      programCode: seed.programCode,
      code: seed.code,
      name: seed.name,
      editionLabel: seed.editionLabel,
      status: "ACTIVE",
    });
    createdCount++;
  }
  logger.info(`Seeded ${createdCount} new project(s) (${PROJECTS.length - createdCount} already existed, left untouched)`);
}

if (require.main === module) {
  connectDB()
    .then(seedProjects)
    .then(disconnectDB)
    .catch((err) => {
      logger.error("Failed to seed projects", { err });
      process.exit(1);
    });
}
