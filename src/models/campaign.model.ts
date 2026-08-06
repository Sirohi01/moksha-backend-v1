import { Schema, model, Document, Types } from "mongoose";
import { CampaignStatus, CAMPAIGN_STATUSES, DonationCause, DONATION_CAUSES } from "../utils/constants";

/** PRD §11.4 "campaigns" — an optional fundraising push a donation can be attributed to (e.g.
 * "Winter Ambulance Drive 2026"). Independent of `cause`, which every donation always has —
 * a campaign groups donations for a marketing push; cause is the permanent ledger category.
 * goalAmount/raisedAmount are integer paise (PRD §11.1) — the service layer converts to/from
 * rupees at the API boundary, never here. */
export interface ICampaign extends Document {
  _id: Types.ObjectId;
  title: string;
  slug: string;
  description?: string;
  coverImage?: string;
  cause: DonationCause;
  goalAmount?: number;
  raisedAmount: number;
  status: CampaignStatus;
  startDate?: Date;
  endDate?: Date;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const campaignSchema = new Schema<ICampaign>(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
    description: { type: String, trim: true },
    coverImage: { type: String },
    cause: { type: String, enum: DONATION_CAUSES, default: "general" },
    goalAmount: { type: Number, min: 1, validate: { validator: Number.isInteger, message: "goalAmount must be an integer (paise)" } },
    raisedAmount: {
      type: Number,
      default: 0,
      validate: { validator: Number.isInteger, message: "raisedAmount must be an integer (paise)" },
    },
    status: { type: String, enum: CAMPAIGN_STATUSES, default: "DRAFT", index: true },
    startDate: { type: Date },
    endDate: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

export const Campaign = model<ICampaign>("Campaign", campaignSchema);
