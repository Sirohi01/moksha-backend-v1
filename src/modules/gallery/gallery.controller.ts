import { Request, Response } from "express";
import { GalleryItem } from "../../models/gallery.model";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/ApiResponse";

export const listPublicGallery = asyncHandler(async (req: Request, res: Response) => {
  const filter: Record<string, unknown> = { isActive: true };
  if (req.query.type) filter.type = req.query.type;

  const items = await GalleryItem.find(filter).sort({ createdAt: -1 });
  sendSuccess(res, 200, "Gallery fetched", items);
});
