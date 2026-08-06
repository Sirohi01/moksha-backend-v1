import { Campaign, ICampaign } from "../../models/campaign.model";
import { ApiError } from "../../utils/ApiError";
import { compactFilter } from "../../utils/compactFilter";
import { CampaignStatus } from "../../utils/constants";
import { toPaise, toRupees } from "../../utils/money";

interface CreateCampaignInput {
  title: string;
  slug: string;
  description?: string;
  coverImage?: string;
  cause: string;
  goalAmount?: number;
  status: CampaignStatus;
  startDate?: Date;
  endDate?: Date;
}

/** Campaigns store goalAmount/raisedAmount as integer paise (PRD §11.1); this is the one place
 * that converts back to rupees before a campaign ever reaches an API response. */
function withCampaignInRupees(campaign: ICampaign) {
  const obj = campaign.toObject();
  return {
    ...obj,
    goalAmount: obj.goalAmount === undefined ? undefined : toRupees(obj.goalAmount),
    raisedAmount: toRupees(obj.raisedAmount),
  };
}

export async function createCampaign(input: CreateCampaignInput, userId: string) {
  const existing = await Campaign.findOne({ slug: input.slug });
  if (existing) throw ApiError.conflict("A campaign with this slug already exists");

  const campaign = await Campaign.create({
    ...input,
    goalAmount: input.goalAmount === undefined ? undefined : toPaise(input.goalAmount),
    createdBy: userId,
  });
  return withCampaignInRupees(campaign);
}

export async function updateCampaign(id: string, updates: Partial<CreateCampaignInput>) {
  const campaign = await Campaign.findById(id);
  if (!campaign) throw ApiError.notFound("Campaign not found");

  Object.assign(campaign, {
    ...updates,
    ...(updates.goalAmount !== undefined ? { goalAmount: toPaise(updates.goalAmount) } : {}),
  });
  await campaign.save();
  return withCampaignInRupees(campaign);
}

export async function listCampaignsForAdmin(filter: { status?: CampaignStatus }) {
  const campaigns = await Campaign.find(compactFilter(filter)).sort({ createdAt: -1 });
  return campaigns.map(withCampaignInRupees);
}

/** Public — only campaigns actively fundraising, used to populate the donation page's cause
 * picker. Draft/paused/archived campaigns are never exposed outside the admin panel. */
export async function listPublicCampaigns() {
  const campaigns = await Campaign.find({ status: "ACTIVE" }).sort({ createdAt: -1 });
  return campaigns.map(withCampaignInRupees);
}

export async function getCampaignById(id: string) {
  const campaign = await Campaign.findById(id);
  if (!campaign) throw ApiError.notFound("Campaign not found");
  return withCampaignInRupees(campaign);
}
