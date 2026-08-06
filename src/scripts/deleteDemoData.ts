import fs from "fs";
import path from "path";
import { connectDB, disconnectDB } from "../config/db";
import { logger } from "../config/logger";
import { CaseTimeline } from "../models/caseTimeline.model";
import { VolunteerAssignment } from "../models/volunteerAssignment.model";
import { CaseExpense } from "../models/caseExpense.model";
import { Case } from "../models/case.model";
import { AssistanceRequest } from "../models/assistanceRequest.model";
import { Receipt } from "../models/receipt.model";
import { Donation } from "../models/donation.model";
import { Donor } from "../models/donor.model";
import { Volunteer } from "../models/volunteer.model";
import { RefreshToken } from "../models/refreshToken.model";
import { User } from "../models/user.model";
import { Enquiry } from "../models/enquiry.model";
import { ExpenseCategory } from "../models/expenseCategory.model";

const MANIFEST_PATH = path.resolve(__dirname, "../../.demo-seed-manifest.json");

interface Manifest {
  createdAt: string;
  requestIds: string[];
  caseIds: string[];
  assignmentIds: string[];
  expenseIds: string[];
  volunteerIds: string[];
  volunteerUserIds: string[];
  donationIds: string[];
  donorIds: string[];
  receiptIds: string[];
  enquiryIds: string[];
  expenseCategoryId: string | null;
  expenseCategoryCreated: boolean;
}

/** Removes exactly what seedDemoData.ts created (by ID, from its manifest) — never a broad
 * "delete everything matching a name pattern" sweep, so it can't touch real data by accident.
 * Deliberately leaves AuditLog/NotificationLog entries alone: both are documented in this
 * codebase as append-only/immutable (BR-08 for the audit trail), so a handful of demo-seed
 * entries staying in "Recent Activity" is the correct tradeoff over violating that invariant. */
async function main() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    logger.info("No demo-seed manifest found — nothing to clean up.");
    return;
  }

  const manifest: Manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf-8"));
  await connectDB();

  const results: Record<string, number> = {};

  results.caseTimeline = (await CaseTimeline.deleteMany({ caseId: { $in: manifest.caseIds } })).deletedCount ?? 0;
  results.volunteerAssignments = (await VolunteerAssignment.deleteMany({ _id: { $in: manifest.assignmentIds } })).deletedCount ?? 0;
  results.caseExpenses = (await CaseExpense.deleteMany({ _id: { $in: manifest.expenseIds } })).deletedCount ?? 0;
  results.cases = (await Case.deleteMany({ _id: { $in: manifest.caseIds } })).deletedCount ?? 0;
  results.assistanceRequests = (await AssistanceRequest.deleteMany({ _id: { $in: manifest.requestIds } })).deletedCount ?? 0;
  results.receipts = (await Receipt.deleteMany({ _id: { $in: manifest.receiptIds } })).deletedCount ?? 0;
  results.donations = (await Donation.deleteMany({ _id: { $in: manifest.donationIds } })).deletedCount ?? 0;
  results.donors = (await Donor.deleteMany({ _id: { $in: manifest.donorIds } })).deletedCount ?? 0;
  results.volunteers = (await Volunteer.deleteMany({ _id: { $in: manifest.volunteerIds } })).deletedCount ?? 0;
  results.refreshTokens = (await RefreshToken.deleteMany({ userId: { $in: manifest.volunteerUserIds } })).deletedCount ?? 0;
  results.users = (await User.deleteMany({ _id: { $in: manifest.volunteerUserIds } })).deletedCount ?? 0;
  results.enquiries = (await Enquiry.deleteMany({ _id: { $in: manifest.enquiryIds } })).deletedCount ?? 0;

  if (manifest.expenseCategoryCreated && manifest.expenseCategoryId) {
    results.expenseCategories = (await ExpenseCategory.deleteMany({ _id: manifest.expenseCategoryId })).deletedCount ?? 0;
  }

  fs.unlinkSync(MANIFEST_PATH);

  logger.info("Demo data removed", results);
  logger.info(
    "Note: AuditLog/NotificationLog entries from the demo actions were left in place — both are append-only by design in this codebase."
  );

  await disconnectDB();
}

main().catch((err) => {
  logger.error("Failed to delete demo data", { err });
  process.exit(1);
});
