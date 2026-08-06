import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/ApiResponse";
import { ApiError } from "../../utils/ApiError";
import { uploadBuffer } from "../../lib/cloudinary";

export const uploadFile = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw ApiError.badRequest("No file provided");
  const folder = typeof req.query.folder === "string" ? req.query.folder : "moksha-sewa";
  const result = await uploadBuffer(req.file.buffer, folder);
  sendSuccess(res, 201, "File uploaded successfully", result);
});
