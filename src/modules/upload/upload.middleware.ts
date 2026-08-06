import { NextFunction, Request, Response } from "express";
import multer from "multer";
import { ApiError } from "../../utils/ApiError";
import { detectFileType, ALLOWED_UPLOAD_MIME_TYPES } from "../../utils/fileSignature";

/** In-memory storage — files are streamed straight to Cloudinary, never written to disk. */
export const uploadSingleFile = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
}).single("file");

/** PRD SEC-06 — verifies the file's actual magic bytes, not the client-supplied mimetype/filename
 * extension (both are attacker-controlled request metadata and prove nothing on their own). Must
 * run after uploadSingleFile so req.file.buffer is populated. */
export function verifyFileSignature(req: Request, _res: Response, next: NextFunction): void {
  if (!req.file) return next(ApiError.badRequest("No file provided"));

  const detected = detectFileType(req.file.buffer);
  if (!detected || !ALLOWED_UPLOAD_MIME_TYPES.has(detected.mime)) {
    return next(ApiError.badRequest("Unsupported or unrecognized file type"));
  }

  next();
}
