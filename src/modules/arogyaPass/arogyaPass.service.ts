import { Types } from "mongoose";
import { ArogyaPass, ArogyaPassApplicableTo } from "../../models/arogyaPass.model";
import { ApiError } from "../../utils/ApiError";

interface PassInput {
  name: string; price: number; daysText?: string; applicableTo?: ArogyaPassApplicableTo;
  includes?: string[]; isMostPopular?: boolean; status?: string; order?: number;
}

export function listPublic(organisationId: string, opts: { all?: boolean; type?: ArogyaPassApplicableTo }) {
  const filter: Record<string, unknown> = { organisationId };
  if (!opts.all) filter.status = "active";
  if (opts.type) filter.applicableTo = { $in: [opts.type, "both"] };
  return ArogyaPass.find(filter).sort({ order: 1, price: 1 });
}
export async function create(organisationId: string, input: PassInput) {
  return ArogyaPass.create({ ...input, organisationId });
}
export async function update(organisationId: string, id: string, input: Partial<PassInput>) {
  if (!Types.ObjectId.isValid(id)) throw ApiError.notFound("Pass not found");
  const pass = await ArogyaPass.findOneAndUpdate({ _id: id, organisationId }, input, { new: true, runValidators: true });
  if (!pass) throw ApiError.notFound("Pass not found");
  return pass;
}
export async function remove(organisationId: string, id: string) {
  if (!Types.ObjectId.isValid(id)) throw ApiError.notFound("Pass not found");
  const pass = await ArogyaPass.findOneAndDelete({ _id: id, organisationId });
  if (!pass) throw ApiError.notFound("Pass not found");
  return pass;
}

/** Server-side price lookup — the ONLY trustworthy source of a pass's price. The legacy checkout
 * trusted a client-supplied `price` string all the way to payment (see UNIFIED_PLATFORM_STATE.md
 * §H P-09) — this is what arogyaPayment.service.ts calls instead. */
export async function getTrustedPrice(organisationId: string, passId: string): Promise<{ name: string; price: number }> {
  if (!Types.ObjectId.isValid(passId)) throw ApiError.badRequest("Invalid pass selected");
  const pass = await ArogyaPass.findOne({ _id: passId, organisationId, status: "active" });
  if (!pass) throw ApiError.badRequest("Selected pass is not available");
  return { name: pass.name, price: pass.price };
}
