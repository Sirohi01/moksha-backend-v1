import fs from "fs";
import path from "path";
import { connectDB, disconnectDB } from "../config/db";
import { logger } from "../config/logger";
import { User } from "../models/user.model";
import { Case } from "../models/case.model";
import { ExpenseCategory } from "../models/expenseCategory.model";
import { Enquiry } from "../models/enquiry.model";
import { createRequest } from "../modules/request/request.service";
import { convertRequestToCase, transitionCaseStatus, assignVolunteer, addCaseExpense } from "../modules/case/case.service";
import { registerVolunteer, respondToAssignment } from "../modules/volunteer/volunteer.service";
import { recordOfflineDonation } from "../modules/donation/donation.service";
import { CaseStatus, CasePriority, DonationCause, PaymentMode } from "../utils/constants";

/**
 * Preview-only demo data — creates a handful of real records (through the same service functions
 * the app itself uses, so every business rule/encryption/audit hook runs exactly as it would in
 * production) purely so the admin dashboard's charts and KPI tiles have something real to render.
 * Every ID this script creates is written to MANIFEST_PATH so `deleteDemoData.ts` can remove
 * exactly these records and nothing else. Refuses to run twice in a row without a cleanup in
 * between, so a stale manifest never gets silently orphaned.
 */
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

const manifest: Manifest = {
  createdAt: new Date().toISOString(),
  requestIds: [],
  caseIds: [],
  assignmentIds: [],
  expenseIds: [],
  volunteerIds: [],
  volunteerUserIds: [],
  donationIds: [],
  donorIds: [],
  receiptIds: [],
  enquiryIds: [],
  expenseCategoryId: null,
  expenseCategoryCreated: false,
};

const PIPELINE: CaseStatus[] = [
  "NEW",
  "UNDER_VERIFICATION",
  "APPROVED",
  "VOLUNTEER_ASSIGNED",
  "TRANSPORT_ARRANGED",
  "CREMATION_IN_PROGRESS",
  "CREMATION_COMPLETED",
  "DOCS_UPLOADED",
];

async function advanceCaseTo(
  caseId: string,
  targetStatus: CaseStatus,
  adminId: string,
  volunteer?: { volunteerId: string; volunteerUserId: string }
) {
  const targetIndex = PIPELINE.indexOf(targetStatus);
  for (let i = 1; i <= targetIndex; i++) {
    const status = PIPELINE[i];
    if (status === "VOLUNTEER_ASSIGNED" && volunteer) {
      const assignment = await assignVolunteer(
        caseId,
        { volunteerId: volunteer.volunteerId, role: "PRIMARY", note: "Demo seed assignment" },
        adminId
      );
      await respondToAssignment(volunteer.volunteerUserId, assignment._id.toString(), "ACCEPTED");
      manifest.assignmentIds.push(assignment._id.toString());
    }
    await transitionCaseStatus(caseId, status, adminId, `Demo seed: advanced to ${status}`);
  }
}

interface CaseSpec {
  requesterName: string;
  deceasedName: string;
  city: string;
  state: string;
  priority: CasePriority;
  targetStatus: CaseStatus;
  backdateHours?: number;
  volunteerIndex?: number;
}

async function main() {
  if (fs.existsSync(MANIFEST_PATH)) {
    throw new Error(
      `A demo-seed manifest already exists at ${MANIFEST_PATH}. Run "npm run seed:demo:clean" first, then re-run this script.`
    );
  }

  await connectDB();

  const admin = await User.findOne({ userType: "INTERNAL" }).sort({ createdAt: 1 });
  if (!admin) {
    throw new Error("No INTERNAL (staff/admin) user found — run seed:admin first.");
  }
  const adminId = admin._id.toString();

  // --- Volunteers -----------------------------------------------------------------------------
  const volunteerSpecs = [
    { name: "[DEMO] Ramesh Kulkarni", phone: "9999900001", email: "demo.volunteer1@mokshasewa-demo.local", city: "Mumbai" },
    { name: "[DEMO] Sunita Verma", phone: "9999900002", email: "demo.volunteer2@mokshasewa-demo.local", city: "Delhi" },
    { name: "[DEMO] Arjun Nair", phone: "9999900003", email: "demo.volunteer3@mokshasewa-demo.local", city: "Bengaluru" },
  ];
  const volunteers: { volunteerId: string; volunteerUserId: string }[] = [];
  for (const spec of volunteerSpecs) {
    const { user, volunteer } = await registerVolunteer({
      name: spec.name,
      phone: spec.phone,
      email: spec.email,
      password: "DemoSeed@12345",
      city: spec.city,
      skills: ["Transport Support", "Documentation"],
      gender: "Male",
      schedulePreference: "Flexible",
      preferredRole: "Field Volunteer",
    });
    manifest.volunteerIds.push(volunteer._id.toString());
    manifest.volunteerUserIds.push(user._id.toString());
    volunteers.push({ volunteerId: volunteer._id.toString(), volunteerUserId: user._id.toString() });
  }
  logger.info(`Seeded ${volunteers.length} demo volunteers`);

  // --- Cases (via AssistanceRequest -> Case, walked through real status transitions) ----------
  const caseSpecs: CaseSpec[] = [
    { requesterName: "[DEMO] Priya Sharma", deceasedName: "Late Mohan Sharma", city: "Mumbai", state: "Maharashtra", priority: "NORMAL", targetStatus: "NEW", backdateHours: 3 },
    { requesterName: "[DEMO] Anil Kumar", deceasedName: "Late Radha Kumar", city: "Delhi", state: "Delhi", priority: "NORMAL", targetStatus: "UNDER_VERIFICATION" },
    { requesterName: "[DEMO] Meena Iyer", deceasedName: "Late Krishnan Iyer", city: "Bengaluru", state: "Karnataka", priority: "HIGH", targetStatus: "APPROVED" },
    { requesterName: "[DEMO] Sanjay Rao", deceasedName: "Late Lakshmi Rao", city: "Hyderabad", state: "Telangana", priority: "NORMAL", targetStatus: "VOLUNTEER_ASSIGNED", volunteerIndex: 0 },
    { requesterName: "[DEMO] Farah Khan", deceasedName: "Late Yusuf Khan", city: "Lucknow", state: "Uttar Pradesh", priority: "CRITICAL", targetStatus: "CREMATION_IN_PROGRESS", volunteerIndex: 1, backdateHours: 30 },
    { requesterName: "[DEMO] Deepak Joshi", deceasedName: "Late Kamla Joshi", city: "Jaipur", state: "Rajasthan", priority: "NORMAL", targetStatus: "DOCS_UPLOADED", volunteerIndex: 0 },
  ];

  const caseIdByIndex: string[] = [];
  for (const spec of caseSpecs) {
    const request = await createRequest({
      type: "NORMAL",
      requester: { name: spec.requesterName, phone: `98888${String(caseSpecs.indexOf(spec)).padStart(5, "0")}`, relation: "Son/Daughter" },
      deceased: { name: spec.deceasedName, age: 68 },
      location: { address: "12 Demo Lane", city: spec.city, state: spec.state, pincode: "400001" },
      consent: { dataProcessing: true, publishStory: false },
    });
    manifest.requestIds.push(request._id.toString());

    const kase = await convertRequestToCase(request._id.toString(), adminId, spec.priority);
    const caseId = kase._id.toString();
    manifest.caseIds.push(caseId);
    caseIdByIndex.push(caseId);

    const volunteer = spec.volunteerIndex !== undefined ? volunteers[spec.volunteerIndex] : undefined;
    await advanceCaseTo(caseId, spec.targetStatus, adminId, volunteer);

    if (spec.backdateHours) {
      await Case.updateOne({ _id: caseId }, { $set: { createdAt: new Date(Date.now() - spec.backdateHours * 60 * 60 * 1000) } });
    }

    logger.info(`Seeded case ${kase.caseId} -> ${spec.targetStatus}`);
  }

  // --- Expenses (left SUBMITTED/pending, so "Expenses Pending" has real numbers) ---------------
  let expenseCategory = await ExpenseCategory.findOne({ isActive: true });
  if (!expenseCategory) {
    expenseCategory = await ExpenseCategory.create({ name: "Transport (Demo)", isActive: true });
    manifest.expenseCategoryCreated = true;
  }
  manifest.expenseCategoryId = expenseCategory._id.toString();

  const expense1 = await addCaseExpense(
    caseIdByIndex[4],
    { categoryId: expenseCategory._id.toString(), amount: 2200, expenseDate: new Date(), paymentMode: "CASH" },
    adminId
  );
  const expense2 = await addCaseExpense(
    caseIdByIndex[5],
    { categoryId: expenseCategory._id.toString(), amount: 1500, expenseDate: new Date(), paymentMode: "UPI" },
    adminId
  );
  manifest.expenseIds.push(expense1._id.toString(), expense2._id.toString());
  logger.info("Seeded 2 pending case expenses");

  // --- Donations (one per cause, so "Donations by Cause" has all four bars) --------------------
  const donationSpecs: { name: string; email: string; phone: string; cause: DonationCause; amount: number; paymentMode: PaymentMode }[] = [
    { name: "[DEMO] Vikram Desai", email: "demo.donor1@mokshasewa-demo.local", phone: "9999900011", cause: "general", amount: 5000, paymentMode: "UPI" },
    { name: "[DEMO] Alka Mehta", email: "demo.donor2@mokshasewa-demo.local", phone: "9999900012", cause: "cremation", amount: 12000, paymentMode: "BANK_TRANSFER" },
    { name: "[DEMO] Suresh Pillai", email: "demo.donor3@mokshasewa-demo.local", phone: "9999900013", cause: "ambulance", amount: 3000, paymentMode: "CASH" },
    { name: "[DEMO] Neha Kapoor", email: "demo.donor4@mokshasewa-demo.local", phone: "9999900014", cause: "annadan", amount: 7500, paymentMode: "CHEQUE" },
  ];
  for (const spec of donationSpecs) {
    const donation = await recordOfflineDonation(
      { donorName: spec.name, donorEmail: spec.email, donorPhone: spec.phone, cause: spec.cause, amount: spec.amount, paymentMode: spec.paymentMode },
      adminId
    );
    manifest.donationIds.push(donation._id.toString());
    manifest.donorIds.push(donation.donorId.toString());
    if (donation.receiptId) manifest.receiptIds.push(donation.receiptId.toString());
  }
  logger.info(`Seeded ${donationSpecs.length} demo donations`);

  // --- Enquiries --------------------------------------------------------------------------------
  const enquiry1 = await Enquiry.create({ name: "[DEMO] Rohit Bansal", phone: "9999900021", email: "demo.enquiry1@mokshasewa-demo.local", message: "Wanted to know how to volunteer on weekends." });
  const enquiry2 = await Enquiry.create({ name: "[DEMO] Kavita Singh", phone: "9999900022", message: "Asking about corporate CSR partnership for cremation support." });
  manifest.enquiryIds.push(enquiry1._id.toString(), enquiry2._id.toString());
  logger.info("Seeded 2 demo enquiries");

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  logger.info(`Demo data seeded. Manifest written to ${MANIFEST_PATH}`);
  logger.info('Run "npm run seed:demo:clean" whenever you want it all removed again.');

  await disconnectDB();
}

main().catch((err) => {
  logger.error("Failed to seed demo data", { err });
  process.exit(1);
});
