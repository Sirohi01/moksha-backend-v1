import { Types } from "mongoose";
import { ArogyaContent, ArogyaContentKind, ArogyaContentStatus } from "../../models/arogyaContent.model";
import { ApiError } from "../../utils/ApiError";

export interface ArogyaContentInput {
  kind: ArogyaContentKind;
  slug?: string;
  title?: string;
  payload: Record<string, unknown>;
  status?: ArogyaContentStatus;
  order?: number;
}

function rethrowDuplicate(error: unknown): never {
  if (error instanceof Error && "code" in error && error.code === 11000) throw ApiError.conflict("Content identifier already exists for this type");
  throw error;
}

export const listPublic = (organisationId: string, kind: ArogyaContentKind) => ArogyaContent.find({ organisationId, kind, status: "ACTIVE" }).sort({ order: 1, createdAt: -1 });
export async function getPublic(organisationId: string, kind: ArogyaContentKind, slug: string) {
  const entry = await ArogyaContent.findOne({ organisationId, kind, slug, status: "ACTIVE" });
  if (!entry) throw ApiError.notFound("Content not found");
  return entry;
}
export const listAdmin = (organisationId: string, kind?: ArogyaContentKind, status?: ArogyaContentStatus) => ArogyaContent.find({ organisationId, ...(kind ? { kind } : {}), ...(status ? { status } : {}) }).sort({ kind: 1, order: 1, createdAt: -1 });
export async function create(organisationId: string, input: ArogyaContentInput) {
  try { return await ArogyaContent.create({ ...input, organisationId }); } catch (error) { return rethrowDuplicate(error); }
}
export async function update(organisationId: string, id: string, input: Partial<ArogyaContentInput>) {
  if (!Types.ObjectId.isValid(id)) throw ApiError.notFound("Content not found");
  try {
    const entry = await ArogyaContent.findOneAndUpdate({ _id: id, organisationId }, input, { new: true, runValidators: true });
    if (!entry) throw ApiError.notFound("Content not found");
    return entry;
  } catch (error) { return rethrowDuplicate(error); }
}
export async function remove(organisationId: string, id: string) {
  if (!Types.ObjectId.isValid(id)) throw ApiError.notFound("Content not found");
  const entry = await ArogyaContent.findOneAndDelete({ _id: id, organisationId });
  if (!entry) throw ApiError.notFound("Content not found");
  return entry;
}
