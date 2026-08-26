import { Types } from "mongoose";
import { Job, JobStatus } from "../../models/job.model";
import { ApiError } from "../../utils/ApiError";

export interface JobInput {
  title: string;
  slug: string;
  department?: string;
  location: string;
  employmentType: string;
  summary: string;
  description: string;
  requirements?: string[];
  applicationUrl?: string;
  applicationEmail?: string;
  status?: JobStatus;
  closesAt?: Date;
}

function ensureObjectId(id: string): void {
  if (!Types.ObjectId.isValid(id)) throw ApiError.notFound("Job not found");
}

export async function listPublicJobs(organisationId: string) {
  return Job.find({
    organisationId,
    status: "PUBLISHED",
    $or: [{ closesAt: { $exists: false } }, { closesAt: null }, { closesAt: { $gte: new Date() } }],
  }).sort({ publishedAt: -1, createdAt: -1 });
}

export async function getPublicJob(organisationId: string, slug: string) {
  const job = await Job.findOne({ organisationId, slug, status: "PUBLISHED" });
  if (!job || (job.closesAt && job.closesAt < new Date())) throw ApiError.notFound("Job not found");
  return job;
}

export async function listAdminJobs(organisationId: string, status?: JobStatus) {
  return Job.find({ organisationId, ...(status ? { status } : {}) }).sort({ createdAt: -1 });
}

export async function createJob(organisationId: string, input: JobInput) {
  try {
    return await Job.create({ ...input, organisationId });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === 11000) {
      throw ApiError.conflict("A job with this slug already exists for Namo Gange");
    }
    throw error;
  }
}

export async function updateJob(organisationId: string, id: string, input: Partial<JobInput>) {
  ensureObjectId(id);
  const update = { ...input } as Partial<JobInput> & { publishedAt?: Date };
  if (input.status === "PUBLISHED") update.publishedAt = new Date();
  try {
    const job = await Job.findOneAndUpdate({ _id: id, organisationId }, update, { new: true, runValidators: true });
    if (!job) throw ApiError.notFound("Job not found");
    return job;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === 11000) {
      throw ApiError.conflict("A job with this slug already exists for Namo Gange");
    }
    throw error;
  }
}

export async function deleteJob(organisationId: string, id: string) {
  ensureObjectId(id);
  const job = await Job.findOneAndDelete({ _id: id, organisationId });
  if (!job) throw ApiError.notFound("Job not found");
  return job;
}
