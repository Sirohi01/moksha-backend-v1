import { v2 as cloudinary } from "cloudinary";
import { ApiError } from "../utils/ApiError";
import { resolveCloudinaryConfig } from "./integrationConfig.service";

export interface UploadOptions {
  organisationCode?: string;
  sensitive?: boolean;
}

const ORGANISATION_FOLDERS: Record<string, string> = {
  MOKSHA: "moksha-sewa",
  NAMOGANGE: "namo-gange",
  AROGYA: "arogya",
};

export function buildUploadFolder(organisationCode: string, requestedFolder: string): string {
  const code = organisationCode.trim().toUpperCase();
  const root = ORGANISATION_FOLDERS[code];
  if (!root) throw ApiError.internal(`Upload folder is not defined for organisation ${code || "(empty)"}`);

  const normalised = requestedFolder.trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  const relative = normalised === root ? "" : normalised.startsWith(`${root}/`) ? normalised.slice(root.length + 1) : normalised;
  if (relative && !/^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(relative)) {
    throw ApiError.badRequest("Invalid upload folder");
  }
  return relative ? `${root}/${relative}` : root;
}

export function uploadBuffer(
  buffer: Buffer,
  folder: string,
  options: UploadOptions = {}
): Promise<{ url: string; publicId: string }> {
  const organisationCode = options.organisationCode ?? "MOKSHA";
  const config = resolveCloudinaryConfig(organisationCode);
  const scopedFolder = buildUploadFolder(organisationCode, folder);
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({
      folder: scopedFolder,
      resource_type: "auto",
      type: options.sensitive ? "authenticated" : "upload",
      cloud_name: config.cloudName,
      api_key: config.apiKey,
      api_secret: config.apiSecret,
    }, (err, result) => {
      if (err || !result) return reject(err ?? new Error("Cloudinary upload failed"));
      resolve({ url: result.secure_url, publicId: result.public_id });
    });
    stream.end(buffer);
  });
}
