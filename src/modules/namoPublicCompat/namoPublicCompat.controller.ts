import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import { NamoContent, NamoContentKind, INamoContent } from "../../models/namoContent.model";
import { Organisation } from "../../models/organisation.model";
let cachedOrgId: string | null = null;
async function orgId(): Promise<string> {
  if (cachedOrgId) return cachedOrgId;
  const organisation = await Organisation.findOne({ code: "NAMOGANGE", status: "ACTIVE" }).select("_id");
  if (!organisation) throw ApiError.notFound("Namo Gange organisation is not configured");
  cachedOrgId = organisation._id.toString();
  return cachedOrgId;
}

function toLegacyShape(entry: INamoContent): Record<string, unknown> {
  return { _id: entry.legacyId ?? entry._id.toString(), ...entry.payload };
}

async function listActive(kind: NamoContentKind) {
  const entries = await NamoContent.find({ organisationId: await orgId(), kind, status: "ACTIVE" }).sort({ order: 1, createdAt: -1 });
  return entries.map(toLegacyShape);
}
async function singleton(kind: NamoContentKind) {
  const entry = await NamoContent.findOne({ organisationId: await orgId(), kind, status: "ACTIVE" });
  return entry ? toLegacyShape(entry) : null;
}

const list = (kind: NamoContentKind) => asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, data: await listActive(kind) });
});

export const objectives = list("OBJECTIVE");
export const initiatives = list("INITIATIVE");
export const achievements = list("ACHIEVEMENT");
export const testimonials = list("TESTIMONIAL");
export const blog = list("BLOG");
export const aboutUs = list("ABOUT");
export const trustBodies = list("TRUST_BODY");
export const banner = list("BANNER");
export const heroes = list("HERO");
export const newsletters = list("NEWSLETTER");
export const recentUpdates = list("RECENT_UPDATE");
export const categoryImage = list("CATEGORY_IMAGE");
export const galleryImage = list("GALLERY_IMAGE");
export const published = list("PUBLISHED");
export const events = list("EVENT");
export const galleryVideo = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, videos: await listActive("GALLERY_VIDEO") });
});
export const socialMedia = asyncHandler(async (_req: Request, res: Response) => {
  const entry = await singleton("SOCIAL_MEDIA");
  res.json({ success: true, data: entry ? [entry] : [] });
});
export const seoSitemap = asyncHandler(async (_req: Request, res: Response) => {
  const entries = await NamoContent.find({ organisationId: await orgId(), kind: "SEO", status: "ACTIVE" }).select("payload");
  res.json({ success: true, data: entries.map((e) => ({ page_path: e.payload.page_path })) });
});
export const seoPage = asyncHandler(async (req: Request, res: Response) => {
  const path = decodeURIComponent(req.params.path);
  const entry = await NamoContent.findOne({ organisationId: await orgId(), kind: "SEO", status: "ACTIVE", slug: path.toLowerCase() });
  if (!entry) { res.json({ success: true, data: null }); return; }
  const codeEntry = await singleton("SEO_CODE");
  res.json({ success: true, data: { ...toLegacyShape(entry), ...(codeEntry ?? {}) } });
});
