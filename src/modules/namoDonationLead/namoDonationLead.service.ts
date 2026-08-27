import { maybeDecrypt } from "../../lib/crypto";
import { NamoDonationLead, INamoDonationLead, NamoDonationLeadGender } from "../../models/namoDonationLead.model";
import { notifyAdmins } from "../../lib/adminNotify.service";

interface CreateInput {
  fullName: string; email: string; phone: string; gender?: NamoDonationLeadGender;
  country: string; state: string; city: string; address: string;
  sewaType: string; donationPackage: string; amount: number;
  pan?: string; message?: string; anonymous?: boolean;
}

function serialize(entry: INamoDonationLead) {
  const value = entry.toObject() as Record<string, unknown>;
  for (const field of ["email", "phone", "address", "pan"]) {
    if (typeof value[field] === "string") value[field] = maybeDecrypt(value[field] as string);
  }
  return value;
}

export async function create(organisationId: string, input: CreateInput) {
  const entry = await NamoDonationLead.create({ organisationId, ...input });
  await notifyAdmins("NAMOGANGE", "DONATION", `New donation pledge — ${input.anonymous ? "Anonymous" : input.fullName}`, `₹${input.amount.toLocaleString("en-IN")} · ${input.sewaType}`, "/namo-donation-leads");
  return serialize(entry);
}

export async function listAdmin(organisationId: string) {
  const entries = await NamoDonationLead.find({ organisationId }).sort({ createdAt: -1 });
  return entries.map(serialize);
}
