import { Partner, IPartner } from "../../models/partner.model";
import { ApiError } from "../../utils/ApiError";
import { compactFilter } from "../../utils/compactFilter";
import { PartnerType, PartnerStatus } from "../../utils/constants";

interface PartnerInput {
  name: string;
  type: PartnerType;
  status: PartnerStatus;
  contactPerson?: string;
  contactPhone?: string;
  contactEmail?: string;
  address?: string;
  agreementDetails?: string;
  notes?: string;
}

export async function createPartner(input: PartnerInput): Promise<IPartner> {
  return Partner.create(input);
}

export async function updatePartner(id: string, updates: Partial<PartnerInput>): Promise<IPartner> {
  const partner = await Partner.findById(id);
  if (!partner) throw ApiError.notFound("Partner not found");

  Object.assign(partner, updates);
  await partner.save();
  return partner;
}

export async function listPartners(filter: { type?: PartnerType; status?: PartnerStatus }) {
  return Partner.find(compactFilter(filter)).sort({ createdAt: -1 });
}

export async function getPartnerById(id: string): Promise<IPartner> {
  const partner = await Partner.findById(id);
  if (!partner) throw ApiError.notFound("Partner not found");
  return partner;
}
