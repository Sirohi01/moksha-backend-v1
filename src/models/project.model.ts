import { Schema, model, Document, Types } from "mongoose";
import { ProjectStatus, PROJECT_STATUSES } from "../utils/constants";
export interface IProject extends Document {
  _id: Types.ObjectId;
  organisationId: Types.ObjectId;
  programCode: string;
  code: string;
  name: string;
  editionLabel?: string;
  status: ProjectStatus;
  description?: string;
  branding?: {
    logo?: {
      publicId?: string;
      secureUrl?: string;
    };
    primaryColor?: string;
  };
  settings?: Record<string, unknown>;
  startDate?: Date;
  endDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const projectSchema = new Schema<IProject>(
  {
    organisationId: {
      type: Schema.Types.ObjectId,
      ref: "Organisation",
      required: true,
      index: true,
      immutable: true,
    },
    programCode: { type: String, required: true, trim: true, uppercase: true, immutable: true },
    code: { type: String, required: true, unique: true, trim: true, uppercase: true, immutable: true },
    name: { type: String, required: true, trim: true },
    editionLabel: { type: String, trim: true },
    status: { type: String, enum: PROJECT_STATUSES, default: "ACTIVE", index: true },
    description: { type: String, trim: true },
    branding: {
      logo: {
        publicId: { type: String, trim: true },
        secureUrl: { type: String, trim: true },
      },
      primaryColor: { type: String, trim: true },
    },
    settings: { type: Schema.Types.Mixed, default: {} },
    startDate: { type: Date },
    endDate: { type: Date },
  },
  { timestamps: true }
);
projectSchema.index({ organisationId: 1, programCode: 1 });

export const Project = model<IProject>("Project", projectSchema);
