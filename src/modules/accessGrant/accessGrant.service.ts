import { AccessGrant, IAccessGrant } from "../../models/accessGrant.model";
import { Organisation } from "../../models/organisation.model";
import { Role } from "../../models/role.model";
import { User } from "../../models/user.model";
import { ApiError } from "../../utils/ApiError";
import { compactFilter } from "../../utils/compactFilter";

interface CreateAccessGrantInput {
  userId: string;
  organisationId?: string | null;
  programCode?: string | null;
  roleId: string;
  expiresAt?: Date;
}

/** Populated for the admin UI — a grant is meaningless to display as three bare ObjectIds. */
const POPULATE = [
  { path: "userId", select: "name email phone" },
  { path: "organisationId", select: "code name" },
  { path: "roleId", select: "name slug" },
  { path: "grantedBy", select: "name email" },
];

export async function createAccessGrant(
  input: CreateAccessGrantInput,
  grantedBy: string
): Promise<IAccessGrant> {
  const user = await User.findById(input.userId);
  if (!user) throw ApiError.badRequest("userId does not match an existing user");

  const role = await Role.findById(input.roleId);
  if (!role) throw ApiError.badRequest("roleId does not match an existing role");

  if (input.organisationId) {
    const organisation = await Organisation.findById(input.organisationId);
    if (!organisation) throw ApiError.badRequest("organisationId does not match an existing organisation");
  }

  const grant = await AccessGrant.create({
    userId: input.userId,
    organisationId: input.organisationId ?? null,
    programCode: input.programCode ?? null,
    roleId: input.roleId,
    status: "ACTIVE",
    grantedBy,
    grantedAt: new Date(),
    expiresAt: input.expiresAt,
  });
  return grant.populate(POPULATE);
}

export async function listAccessGrants(filter: { userId?: string; organisationId?: string; status?: string }) {
  return AccessGrant.find(compactFilter(filter)).sort({ createdAt: -1 }).populate(POPULATE);
}

export async function getAccessGrantById(id: string): Promise<IAccessGrant> {
  const grant = await AccessGrant.findById(id).populate(POPULATE);
  if (!grant) throw ApiError.notFound("Access grant not found");
  return grant;
}

/** Sets/clears an ACTIVE grant's expiry — the one field on an existing grant that's legitimately
 * editable (extending or shortening how long it lasts) without it being a materially different
 * grant. See accessGrant.validation.ts for why userId/organisationId/programCode/roleId are not. */
export async function updateAccessGrantExpiry(id: string, expiresAt?: Date): Promise<IAccessGrant> {
  const grant = await AccessGrant.findById(id);
  if (!grant) throw ApiError.notFound("Access grant not found");
  if (grant.status !== "ACTIVE") throw ApiError.badRequest("Only an active grant's expiry can be changed");

  grant.expiresAt = expiresAt;
  await grant.save();
  return grant.populate(POPULATE);
}

export async function revokeAccessGrant(id: string): Promise<IAccessGrant> {
  const grant = await AccessGrant.findById(id);
  if (!grant) throw ApiError.notFound("Access grant not found");
  if (grant.status === "REVOKED") return grant.populate(POPULATE); // idempotent

  grant.status = "REVOKED";
  await grant.save();
  return grant.populate(POPULATE);
}
