import crypto from "crypto";
import { Document, model, Schema, Types } from "mongoose";
import { encryptFieldsOnSave } from "../lib/fieldEncryption";

/** AGS is a Namo Gange organisation-level programme, not a Project (locked platform rule — see
 * UNIFIED_PLATFORM_STATE.md and the architecture audit's "Organisation & Project model" section:
 * AGS/TGYM are permanent ongoing programmes, not dated/archivable event editions the way an
 * Arogya conference edition is, so they scope only by organisationId). */

/** The legacy `AGSDelegate.status` field — a simple active/inactive flag on the record itself,
 * unrelated to the client's pipeline stage below. */
export const AGS_DELEGATE_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export type AgsDelegateStatus = (typeof AGS_DELEGATE_STATUSES)[number];

/** The legacy `clientStatus` was an unvalidated free-text string — any value a staff member
 * happened to type, with no enum enforced anywhere in the old backend (confirmed by full-code
 * audit). This enum is derived from the *only* values the legacy admin UI's own status-change
 * dropdown actually offered (AgsOverview.jsx), which is the closest thing to a real, audited
 * source of truth available — but it was not independently verified against the full distinct
 * set of values present in the legacy production data, so treat it as a strong starting point,
 * not a certainty, and confirm with the Namo Gange team before assuming it's exhaustive.
 * NEW = no status set yet (the legacy "New Data" bucket was simply an unset field). Deliberately
 * no transition table is enforced here: the legacy system never enforced one, so building one now
 * would be inventing a business rule that was never confirmed to exist. A staff member can move a
 * delegate to any status from any other, exactly matching current real-world behaviour — every
 * change is recorded to AuditLog so the history is at least traceable, which the old system did
 * not reliably do either. */
export const AGS_CLIENT_STATUSES = [
  "NEW",
  "WARM",
  "HOT",
  "REGISTERED",
  "PAYMENT_REFUNDED",
  "NOT_INTERESTED",
] as const;
export type AgsClientStatus = (typeof AGS_CLIENT_STATUSES)[number];

export interface INamoAgsDelegate extends Document {
  _id: Types.ObjectId;
  organisationId: Types.ObjectId;
  legacyId?: string;
  title?: string;
  firstName: string;
  lastName?: string;
  profession?: string;
  age?: number;
  event?: string;
  mobile: string;
  mobileHash: string;
  alternate?: string;
  landline?: string;
  email?: string;
  emailHash?: string;
  address?: string;
  country?: string;
  state?: string;
  city?: string;
  pin?: string;
  category?: string;
  college?: string;
  university?: string;
  enquiryFor?: string;
  leadForward?: string;
  mode?: string;
  status: AgsDelegateStatus;
  clientStatus: AgsClientStatus;
  coordinator?: string;
  remark?: string;
  companyName?: string;
  companyAddress?: string;
  companyCountry?: string;
  companyState?: string;
  companyCity?: string;
  companyPin?: string;
  createdAt: Date;
  updatedAt: Date;
}

const hash = (value: string) => crypto.createHash("sha256").update(value.trim().toLowerCase()).digest("hex");

const schema = new Schema<INamoAgsDelegate>(
  {
    organisationId: { type: Schema.Types.ObjectId, ref: "Organisation", required: true, index: true },
    legacyId: { type: String, trim: true },
    title: { type: String, trim: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, trim: true },
    profession: { type: String, trim: true },
    age: Number,
    event: { type: String, trim: true },
    mobile: { type: String, required: true },
    mobileHash: { type: String, required: true, select: false },
    alternate: String,
    landline: { type: String, trim: true },
    email: String,
    emailHash: { type: String, select: false },
    address: String,
    country: { type: String, trim: true },
    state: { type: String, trim: true },
    city: { type: String, trim: true },
    pin: { type: String, trim: true },
    category: { type: String, trim: true },
    college: { type: String, trim: true },
    university: { type: String, trim: true },
    enquiryFor: { type: String, trim: true },
    leadForward: { type: String, trim: true },
    mode: { type: String, trim: true },
    status: { type: String, enum: AGS_DELEGATE_STATUSES, default: "ACTIVE", index: true },
    clientStatus: { type: String, enum: AGS_CLIENT_STATUSES, default: "NEW", index: true },
    coordinator: { type: String, trim: true },
    remark: String,
    companyName: { type: String, trim: true },
    companyAddress: String,
    companyCountry: { type: String, trim: true },
    companyState: { type: String, trim: true },
    companyCity: { type: String, trim: true },
    companyPin: { type: String, trim: true },
  },
  { timestamps: true }
);

// Deliberately NOT a unique index: this is a coordinator-facing lead list, and the legacy system
// tolerated (and in practice relied on) the same person appearing more than once — a second
// enquiry through a different channel is a real signal, not a data-entry error, unlike a formal
// Member/Volunteer application. Indexed for lookup speed only.
schema.index({ organisationId: 1, mobileHash: 1 });
schema.index({ organisationId: 1, legacyId: 1 }, { unique: true, partialFilterExpression: { legacyId: { $type: "string" } } });

schema.pre("validate", function (next) {
  if (this.isModified("mobile")) this.mobileHash = hash(this.mobile.replace(/\D/g, ""));
  if (this.isModified("email") && this.email) this.emailHash = hash(this.email);
  next();
});

encryptFieldsOnSave(schema, ["mobile", "alternate", "email", "address", "companyAddress"]);

export const NamoAgsDelegate = model<INamoAgsDelegate>("NamoAgsDelegate", schema);
