import { maybeDecrypt } from "../../lib/crypto";
import { NamoSupportRequest, INamoSupportRequest, NamoSupportGender } from "../../models/namoSupportRequest.model";
import { notifyAdmins } from "../../lib/adminNotify.service";

interface CreateInput {
  name: string; email: string; mobile: string; gender: NamoSupportGender; dob: Date;
  supportType: string; fullAddress: string; state: string; city: string;
  prefferedContribution: string; message: string;
}

function serialize(entry: INamoSupportRequest) {
  const value = entry.toObject() as Record<string, unknown>;
  for (const field of ["email", "mobile", "fullAddress", "message"]) {
    if (typeof value[field] === "string") value[field] = maybeDecrypt(value[field] as string);
  }
  return value;
}

export async function create(organisationId: string, input: CreateInput) {
  const entry = await NamoSupportRequest.create({ organisationId, ...input });
  await notifyAdmins("NAMOGANGE", "SUPPORT", `New support request — ${input.name}`, input.supportType, "/namo-support-requests");
  return serialize(entry);
}

export async function listAdmin(organisationId: string) {
  const entries = await NamoSupportRequest.find({ organisationId }).sort({ createdAt: -1 });
  return entries.map(serialize);
}
