import { Request, Response } from "express";
import { GalleryItem } from "../../models/gallery.model";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/ApiResponse";
import { ApiError } from "../../utils/ApiError";

export const listPublicGallery = asyncHandler(async (req: Request, res: Response) => {
  const filter: Record<string, unknown> = { isActive: true };
  if (req.query.type) filter.type = req.query.type;

  const items = await GalleryItem.find(filter).sort({ sortOrder: 1, createdAt: -1 });
  sendSuccess(res, 200, "Gallery fetched", items);
});

export const registerDownload = asyncHandler(async (req: Request, res: Response) => {
  const item = await GalleryItem.findOneAndUpdate(
    { _id: req.params.id, type: "image", isActive: true },
    { $inc: { downloadCount: 1 } },
    { new: true }
  ).select("url downloadCount");
  if (!item) throw ApiError.notFound("Gallery image not found");
  sendSuccess(res, 200, "Download registered", { url: item.url, downloadCount: item.downloadCount });
});
