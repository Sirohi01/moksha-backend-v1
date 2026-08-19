import { NextFunction, Request, Response } from "express";
import multer from "multer";
import { ApiError } from "../../utils/ApiError";
import { detectFileType, ALLOWED_UPLOAD_MIME_TYPES } from "../../utils/fileSignature";

/** In-memory storage — files are streamed straight to Cloudinary, never written to disk. */
export const uploadSingleFile = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
}).single("file");

export const uploadVolunteerFiles = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 2 },
}).fields([{ name: "photograph", maxCount: 1 }, { name: "idProof", maxCount: 1 }]);

export function verifyVolunteerFiles(req: Request, _res: Response, next: NextFunction): void {
  const files = req.files as Record<string, Express.Multer.File[]> | undefined;
  const photograph = files?.photograph?.[0];
  const idProof = files?.idProof?.[0];
  if (!photograph || !idProof) return next(ApiError.badRequest("Photograph and ID proof attachments are required"));
  for (const file of [photograph, idProof]) {
    const detected = detectFileType(file.buffer);
    if (!detected || !ALLOWED_UPLOAD_MIME_TYPES.has(detected.mime)) return next(ApiError.badRequest(`Unsupported file: ${file.originalname}`));
  }
  const photoType = detectFileType(photograph.buffer);
  if (!photoType?.mime.startsWith("image/")) return next(ApiError.badRequest("Photograph must be an image"));
  next();
}

export function normalizeVolunteerMultipart(req: Request, _res: Response, next: NextFunction): void {
  for (const key of ["skills", "volunteerAreas", "availabilityDays", "preferredTimes", "emergencyContact"]) {
    if (typeof req.body[key] === "string") {
      try { req.body[key] = JSON.parse(req.body[key]); } catch { return next(ApiError.badRequest(`Invalid ${key}`)); }
    }
  }
  for (const key of ["emergencyOnCall", "canParticipateFieldCases", "ownVehicle", "volunteeredBefore", "declarationAccepted"]) {
    if (typeof req.body[key] === "string") req.body[key] = req.body[key] === "true";
  }
  next();
}

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

export function verifyOptionalFileSignature(req: Request, _res: Response, next: NextFunction): void {
  if (!req.file) return next();
  const detected = detectFileType(req.file.buffer);
  if (!detected || !ALLOWED_UPLOAD_MIME_TYPES.has(detected.mime)) {
    return next(ApiError.badRequest("Unsupported or unrecognized file type"));
  }
  next();
}
