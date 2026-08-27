import { Types } from "mongoose";
import { maybeDecrypt } from "../../lib/crypto";
import { NamoJobApplication, INamoJobApplication, NamoJobApplicationStatus } from "../../models/namoJobApplication.model";
import { ApiError } from "../../utils/ApiError";
import { notifyAdmins } from "../../lib/adminNotify.service";

interface CreateInput {
  name: string;
  email?: string;
  phone?: string;
  city?: string;
  state?: string;
  currentLocation?: string;
  role?: string;
  message?: string;
}

function serialize(entry: INamoJobApplication) {
  const value = entry.toObject() as Record<string, unknown>;
  for (const field of ["email", "phone", "message"]) {
    if (typeof value[field] === "string") value[field] = maybeDecrypt(value[field] as string);
  }
  return value;
}

export async function create(organisationId: string, input: CreateInput) {
  const entry = await NamoJobApplication.create({ organisationId, ...input });
  await notifyAdmins("NAMOGANGE", "JOB_APPLICATION", `New career application — ${input.name}`, input.role ?? "Role not specified", "/namo-job-applications");
  return serialize(entry);
}

export async function listAdmin(organisationId: string, status?: NamoJobApplicationStatus) {
  const query: Record<string, unknown> = { organisationId };
  if (status) query.status = status;
  const entries = await NamoJobApplication.find(query).sort({ createdAt: -1 });
  return entries.map(serialize);
}

export async function getAdmin(organisationId: string, id: string) {
  if (!Types.ObjectId.isValid(id)) throw ApiError.notFound("Application not found");
  const entry = await NamoJobApplication.findOne({ _id: id, organisationId });
  if (!entry) throw ApiError.notFound("Application not found");
  return serialize(entry);
}

export async function updateStatus(organisationId: string, id: string, status: NamoJobApplicationStatus) {
  if (!Types.ObjectId.isValid(id)) throw ApiError.notFound("Application not found");
  const entry = await NamoJobApplication.findOneAndUpdate({ _id: id, organisationId }, { status }, { new: true });
  if (!entry) throw ApiError.notFound("Application not found");
  return serialize(entry);
}
