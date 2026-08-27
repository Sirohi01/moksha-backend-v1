import { maybeDecrypt } from "../../lib/crypto";
import { NamoEnquiry, INamoEnquiry } from "../../models/namoEnquiry.model";
import { notifyAdmins } from "../../lib/adminNotify.service";

interface CreateInput { name: string; email: string; mobile: string; message: string }

function serialize(entry: INamoEnquiry) {
  const value = entry.toObject() as Record<string, unknown>;
  for (const field of ["email", "mobile", "message"]) {
    if (typeof value[field] === "string") value[field] = maybeDecrypt(value[field] as string);
  }
  return value;
}

export async function create(organisationId: string, input: CreateInput) {
  const entry = await NamoEnquiry.create({ organisationId, ...input });
  await notifyAdmins("NAMOGANGE", "ENQUIRY", `New contact enquiry — ${input.name}`, input.message, "/namo-enquiries");
  return serialize(entry);
}

export async function listAdmin(organisationId: string) {
  const entries = await NamoEnquiry.find({ organisationId }).sort({ createdAt: -1 });
  return entries.map(serialize);
}
