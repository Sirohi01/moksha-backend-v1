import { Organisation, IOrganisation } from "../../models/organisation.model";
import { ApiError } from "../../utils/ApiError";
import { compactFilter } from "../../utils/compactFilter";
import { OrganisationStatus } from "../../utils/constants";

interface OrganisationInput {
  code: string;
  name: string;
  slug: string;
  status?: OrganisationStatus;
  legalDetails?: IOrganisation["legalDetails"];
  contactDetails?: IOrganisation["contactDetails"];
  settings?: Record<string, unknown>;
}

export async function createOrganisation(input: OrganisationInput): Promise<IOrganisation> {
  const existing = await Organisation.findOne({
    $or: [{ code: input.code.toUpperCase() }, { slug: input.slug.toLowerCase() }],
  });
  if (existing) throw ApiError.conflict("An organisation with this code or slug already exists");

  return Organisation.create(input);
}

export async function updateOrganisation(
  id: string,
  updates: Partial<Omit<OrganisationInput, "code">>
): Promise<IOrganisation> {
  const organisation = await Organisation.findById(id);
  if (!organisation) throw ApiError.notFound("Organisation not found");

  if (updates.slug && updates.slug !== organisation.slug) {
    const clash = await Organisation.findOne({ slug: updates.slug.toLowerCase(), _id: { $ne: id } });
    if (clash) throw ApiError.conflict("Another organisation already uses this slug");
  }

  Object.assign(organisation, updates);
  await organisation.save();
  return organisation;
}

export async function listOrganisations(filter: { status?: OrganisationStatus }) {
  return Organisation.find(compactFilter(filter)).sort({ name: 1 });
}

export async function getOrganisationById(id: string): Promise<IOrganisation> {
  const organisation = await Organisation.findById(id);
  if (!organisation) throw ApiError.notFound("Organisation not found");
  return organisation;
}
export async function getOrganisationByCode(code: string): Promise<IOrganisation | null> {
  return Organisation.findOne({ code: code.toUpperCase(), status: "ACTIVE" });
}
