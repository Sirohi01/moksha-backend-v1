import { Types } from "mongoose";
import { NamoContent, NamoContentKind, NamoContentStatus } from "../../models/namoContent.model";
import { ApiError } from "../../utils/ApiError";

export interface NamoContentInput {
  kind: NamoContentKind;
  slug?: string;
  title?: string;
  payload: Record<string, unknown>;
  status?: NamoContentStatus;
  order?: number;
}

function rethrowDuplicate(error: unknown): never {
  if (error instanceof Error && "code" in error && error.code === 11000) throw ApiError.conflict("Content identifier already exists for this type");
  throw error;
}

export const listPublic = (organisationId: string, kind: NamoContentKind) => NamoContent.find({ organisationId, kind, status: "ACTIVE" }).sort({ order: 1, createdAt: -1 });
export async function getPublic(organisationId: string, kind: NamoContentKind, slug: string) {
  const entry = await NamoContent.findOne({ organisationId, kind, slug, status: "ACTIVE" });
  if (!entry) throw ApiError.notFound("Content not found");
  return entry;
}
export const listAdmin = (organisationId: string, kind?: NamoContentKind, status?: NamoContentStatus) => NamoContent.find({ organisationId, ...(kind ? { kind } : {}), ...(status ? { status } : {}) }).sort({ kind: 1, order: 1, createdAt: -1 });
export async function create(organisationId: string, input: NamoContentInput) {
  try { return await NamoContent.create({ ...input, organisationId }); } catch (error) { return rethrowDuplicate(error); }
}
export async function update(organisationId: string, id: string, input: Partial<NamoContentInput>) {
  if (!Types.ObjectId.isValid(id)) throw ApiError.notFound("Content not found");
  try {
    const entry = await NamoContent.findOneAndUpdate({ _id: id, organisationId }, input, { new: true, runValidators: true });
    if (!entry) throw ApiError.notFound("Content not found");
    return entry;
  } catch (error) { return rethrowDuplicate(error); }
}
export async function remove(organisationId: string, id: string) {
  if (!Types.ObjectId.isValid(id)) throw ApiError.notFound("Content not found");
  const entry = await NamoContent.findOneAndDelete({ _id: id, organisationId });
  if (!entry) throw ApiError.notFound("Content not found");
  return entry;
}
