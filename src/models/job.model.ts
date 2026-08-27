import { Document, model, Schema, Types } from "mongoose";

export const JOB_STATUSES = ["DRAFT", "PUBLISHED", "CLOSED"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export interface IJob extends Document {
  _id: Types.ObjectId;
  organisationId: Types.ObjectId;
  legacyId?: string;
  title: string;
  slug: string;
  department?: string;
  location: string;
  employmentType: string;
  summary: string;
  description: string;
  requirements: string[];
  experienceText?: string;
  salaryText?: string;
  applicationUrl?: string;
  applicationEmail?: string;
  status: JobStatus;
  publishedAt?: Date;
  closesAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const jobSchema = new Schema<IJob>({
  organisationId: { type: Schema.Types.ObjectId, ref: "Organisation", required: true, index: true },
  legacyId: { type: String, trim: true },
  title: { type: String, required: true, trim: true },
  slug: { type: String, required: true, trim: true, lowercase: true },
  department: { type: String, trim: true },
  location: { type: String, required: true, trim: true },
  employmentType: { type: String, required: true, trim: true },
  summary: { type: String, required: true, trim: true },
  description: { type: String, required: true, trim: true },
  requirements: { type: [String], default: [] },
  experienceText: { type: String, trim: true },
  salaryText: { type: String, trim: true },
  applicationUrl: { type: String, trim: true },
  applicationEmail: { type: String, trim: true, lowercase: true },
  status: { type: String, enum: JOB_STATUSES, default: "DRAFT", index: true },
  publishedAt: Date,
  closesAt: Date,
}, { timestamps: true });

jobSchema.index({ organisationId: 1, slug: 1 }, { unique: true });
jobSchema.index({ organisationId: 1, legacyId: 1 }, { unique: true, partialFilterExpression: { legacyId: { $type: "string" } } });
jobSchema.index({ organisationId: 1, status: 1, publishedAt: -1 });

jobSchema.pre("save", function (next) {
  if (this.isModified("status") && this.status === "PUBLISHED" && !this.publishedAt) {
    this.publishedAt = new Date();
  }
  next();
});

export const Job = model<IJob>("Job", jobSchema);
