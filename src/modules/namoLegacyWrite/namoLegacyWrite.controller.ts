import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import { Organisation } from "../../models/organisation.model";
import { uploadBuffer } from "../../lib/cloudinary";
import { detectFileType, ALLOWED_UPLOAD_MIME_TYPES } from "../../utils/fileSignature";
import * as jobService from "../job/job.service";
import * as memberService from "../member/member.service";
import { memberApplicationBody } from "../member/member.validation";

async function orgId(): Promise<string> {
  const organisation = await Organisation.findOne({ code: "NAMOGANGE", status: "ACTIVE" }).select("_id");
  if (!organisation) throw ApiError.notFound("Namo Gange organisation is not configured");
  return organisation._id.toString();
}
export const jobsList = asyncHandler(async (_req: Request, res: Response) => {
  const jobs = await jobService.listPublicJobs(await orgId());
  const shaped = jobs.map((job) => ({
    _id: job._id.toString(),
    title: job.title,
    exp: job.experienceText ?? "",
    salary: job.salaryText ?? "",
    location: job.location,
    desc: job.requirements.length > 0 ? job.requirements : [job.summary],
  }));
  res.json({ success: true, data: shaped });
});
export const membersCreate = asyncHandler(async (req: Request, res: Response) => {
  const file = req.file;
  let profilePic: string | undefined;
  if (file) {
    const detected = detectFileType(file.buffer);
    if (!detected || !ALLOWED_UPLOAD_MIME_TYPES.has(detected.mime) || !detected.mime.startsWith("image/")) {
      throw ApiError.badRequest("Profile image must be a valid image file");
    }
    const uploaded = await uploadBuffer(file.buffer, "members", { organisationCode: "NAMOGANGE" });
    profilePic = uploaded.url;
  }

  const body = req.body as Record<string, string>;
  const mapped = {
    applicantName: body.fullName,
    email: body.email,
    mobile: body.mobile,
    dob: body.dob || undefined,
    gender: body.gender,
    occupation: body.occupation,
    organizationName: body.organization,
    website: body.website,
    address: body.address,
    city: body.city,
    state: body.state,
    district: body.district,
    pinCode: body.pincode,
    profilePic,
  };
  const parsed = memberApplicationBody.parse(mapped);
  await memberService.createMember(await orgId(), parsed);
  res.status(201).json({ success: true, message: "Registration successful" });
});
