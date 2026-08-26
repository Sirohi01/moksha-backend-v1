import { Types } from "mongoose";
import { ArogyaCategory, ArogyaCategoryType } from "../../models/arogyaCategory.model";
import { ApiError } from "../../utils/ApiError";
import { compactFilter } from "../../utils/compactFilter";

interface CategoryInput { name: string; type: ArogyaCategoryType }

export const listPublic = (organisationId: string, type?: ArogyaCategoryType) =>
  ArogyaCategory.find({ organisationId, ...compactFilter({ type }) }).sort({ name: 1 });

export async function create(organisationId: string, input: CategoryInput) {
  return ArogyaCategory.create({ ...input, organisationId });
}
export async function update(organisationId: string, id: string, input: Partial<CategoryInput>) {
  if (!Types.ObjectId.isValid(id)) throw ApiError.notFound("Category not found");
  const category = await ArogyaCategory.findOneAndUpdate({ _id: id, organisationId }, input, { new: true, runValidators: true });
  if (!category) throw ApiError.notFound("Category not found");
  return category;
}
export async function remove(organisationId: string, id: string) {
  if (!Types.ObjectId.isValid(id)) throw ApiError.notFound("Category not found");
  const category = await ArogyaCategory.findOneAndDelete({ _id: id, organisationId });
  if (!category) throw ApiError.notFound("Category not found");
  return category;
}
