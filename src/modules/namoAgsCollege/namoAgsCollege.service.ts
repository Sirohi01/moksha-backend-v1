import { Types } from "mongoose";
import { NamoAgsCollege } from "../../models/namoAgsCollege.model";
import { ApiError } from "../../utils/ApiError";

export async function list(organisationId: string) {
  return NamoAgsCollege.find({ organisationId }).sort({ collegeName: 1 });
}

export async function create(organisationId: string, input: Record<string, unknown>) {
  return NamoAgsCollege.create({ organisationId, ...input });
}

export async function update(organisationId: string, id: string, input: Record<string, unknown>) {
  if (!Types.ObjectId.isValid(id)) throw ApiError.notFound("College not found");
  const entry = await NamoAgsCollege.findOneAndUpdate({ _id: id, organisationId }, input, { new: true, runValidators: true });
  if (!entry) throw ApiError.notFound("College not found");
  return entry;
}

export async function remove(organisationId: string, id: string) {
  if (!Types.ObjectId.isValid(id)) throw ApiError.notFound("College not found");
  const entry = await NamoAgsCollege.findOneAndDelete({ _id: id, organisationId });
  if (!entry) throw ApiError.notFound("College not found");
  return entry;
}
