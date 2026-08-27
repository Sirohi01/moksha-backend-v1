import { Types } from "mongoose";
import { NamoLookup, NamoLookupType } from "../../models/namoLookup.model";
import { ApiError } from "../../utils/ApiError";

export async function list(organisationId: string, type?: NamoLookupType, status?: "ACTIVE" | "INACTIVE") {
  const query: Record<string, unknown> = { organisationId };
  if (type) query.type = type;
  if (status) query.status = status;
  return NamoLookup.find(query).sort({ name: 1 });
}

export async function create(organisationId: string, input: { type: NamoLookupType; name: string; payload?: Record<string, unknown>; status?: "ACTIVE" | "INACTIVE" }) {
  return NamoLookup.create({ organisationId, ...input });
}

export async function update(organisationId: string, id: string, input: Partial<{ name: string; payload: Record<string, unknown>; status: "ACTIVE" | "INACTIVE" }>) {
  if (!Types.ObjectId.isValid(id)) throw ApiError.notFound("Lookup entry not found");
  const entry = await NamoLookup.findOneAndUpdate({ _id: id, organisationId }, input, { new: true, runValidators: true });
  if (!entry) throw ApiError.notFound("Lookup entry not found");
  return entry;
}

export async function remove(organisationId: string, id: string) {
  if (!Types.ObjectId.isValid(id)) throw ApiError.notFound("Lookup entry not found");
  const entry = await NamoLookup.findOneAndDelete({ _id: id, organisationId });
  if (!entry) throw ApiError.notFound("Lookup entry not found");
  return entry;
}
