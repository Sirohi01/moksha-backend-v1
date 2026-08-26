import { Types } from "mongoose";
import { decryptField, maybeDecrypt } from "../../lib/crypto";
import { INamoVolunteer, NamoVolunteer, NamoVolunteerStatus } from "../../models/namoVolunteer.model";
import { ApiError } from "../../utils/ApiError";

function duplicate(error: unknown): never { if (error instanceof Error && "code" in error && error.code === 11000) throw ApiError.conflict("A volunteer with this mobile or email already exists for Namo Gange"); throw error; }
function serialize(row: INamoVolunteer, detail = false) {
  const value = row.toObject() as Record<string, unknown>;
  for (const field of ["mobile", "alternateMobile", "email", "address", "emergencyContact", "businessAddress", "businessContactNo"]) if (typeof value[field] === "string") value[field] = maybeDecrypt(value[field] as string);
  delete value.mobileHash; delete value.emailHash; delete value.aadhaarHash; delete value.aadhaar; delete value.accountNo;
  if (detail && row.aadhaar) value.aadhaarMasked = `********${decryptField(row.aadhaar).slice(-4)}`;
  if (detail && row.accountNo) value.accountMasked = `********${decryptField(row.accountNo).slice(-4)}`;
  return value;
}
export async function apply(organisationId: string, input: Record<string, unknown>) { try { const row = await NamoVolunteer.create({ ...input, organisationId, status: "PENDING_REVIEW" }); return { id: row._id.toString(), status: row.status }; } catch (error) { return duplicate(error); } }
export async function list(organisationId: string, status?: NamoVolunteerStatus) { return (await NamoVolunteer.find({ organisationId, ...(status ? { status } : {}) }).sort({ createdAt: -1 })).map((row) => serialize(row)); }
export async function get(organisationId: string, id: string) { if (!Types.ObjectId.isValid(id)) throw ApiError.notFound("Volunteer not found"); const row = await NamoVolunteer.findOne({ _id: id, organisationId }).select("+aadhaar +accountNo"); if (!row) throw ApiError.notFound("Volunteer not found"); return serialize(row, true); }
export async function update(organisationId: string, id: string, input: Record<string, unknown>) { if (!Types.ObjectId.isValid(id)) throw ApiError.notFound("Volunteer not found"); const row = await NamoVolunteer.findOne({ _id: id, organisationId }).select("+aadhaar +accountNo"); if (!row) throw ApiError.notFound("Volunteer not found"); row.set(input); try { await row.save(); } catch (error) { return duplicate(error); } return get(organisationId, id); }
