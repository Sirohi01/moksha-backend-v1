import { Schema, model, Document, Types } from "mongoose";

export const ACCESS_GRANT_STATUSES = ["ACTIVE", "REVOKED"] as const;
export type AccessGrantStatus = (typeof ACCESS_GRANT_STATUSES)[number];

/**
 * Namo Gange Unified Platform — grants a Role to a User within a scope: an Organisation, and
 * optionally one Project's programCode within it. This is deliberately a separate join collection
 * rather than arrays embedded on User, so a single grant can be revoked/audited/expired
 * independently of any other grant the same user holds (PRD-equivalent rationale to why Moksha
 * itself keeps RefreshToken as its own collection rather than an array on User).
 *
 * `organisationId: null` means ALL organisations — reserved for Super Admin. `programCode: null`
 * means all projects within the granted organisation (or, combined with a null organisationId,
 * truly everything). A user may hold multiple grants (e.g. "Event Coordinator" scoped to
 * NAMOGANGE/AGS and a separate, narrower grant scoped to NAMOGANGE/TGYM).
 *
 * This model is intentionally NOT read by the existing `requireAuth`/`authorize()` pair in
 * auth.middleware.ts — those remain exactly as they were for Moksha's own non-project-scoped
 * modules. AccessGrant is resolved only by the new `authorizeScoped()` middleware
 * (access.middleware.ts), which routes opt into explicitly. See that file for the resolution
 * order and the default-deny rule.
 */
export interface IAccessGrant extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  organisationId: Types.ObjectId | null;
  programCode: string | null;
  roleId: Types.ObjectId;
  status: AccessGrantStatus;
  grantedBy: Types.ObjectId;
  grantedAt: Date;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const accessGrantSchema = new Schema<IAccessGrant>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    organisationId: { type: Schema.Types.ObjectId, ref: "Organisation", default: null },
    programCode: { type: String, trim: true, uppercase: true, default: null },
    roleId: { type: Schema.Types.ObjectId, ref: "Role", required: true },
    status: { type: String, enum: ACCESS_GRANT_STATUSES, default: "ACTIVE", index: true },
    grantedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    grantedAt: { type: Date, default: () => new Date() },
    expiresAt: { type: Date },
  },
  { timestamps: true }
);

// The exact lookup authorizeScoped() performs on every scoped request: "does this user have any
// active grant at all", narrowed further in application code by organisationId/programCode/expiry
// (can't be a single compound index since organisationId/programCode may be null-meaning-wildcard,
// which Mongo indexes can't express as "matches everything").
accessGrantSchema.index({ userId: 1, status: 1 });
accessGrantSchema.index({ userId: 1, organisationId: 1, programCode: 1 });

export const AccessGrant = model<IAccessGrant>("AccessGrant", accessGrantSchema);
