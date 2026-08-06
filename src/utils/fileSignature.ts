/** Magic-byte file type detection (PRD SEC-06) — the client-supplied mimetype/extension is never
 * trusted on its own, since both are attacker-controlled request metadata. Every accepted signature
 * here is checked against the file's actual leading bytes, not what the upload claims to be. */

export interface DetectedFileType {
  mime: string;
  ext: string;
}

type Signature = DetectedFileType & {
  match: (buf: Buffer) => boolean;
};

const SIGNATURES: Signature[] = [
  { mime: "image/jpeg", ext: "jpg", match: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    mime: "image/png",
    ext: "png",
    match: (b) =>
      b.length >= 8 &&
      b[0] === 0x89 &&
      b[1] === 0x50 &&
      b[2] === 0x4e &&
      b[3] === 0x47 &&
      b[4] === 0x0d &&
      b[5] === 0x0a &&
      b[6] === 0x1a &&
      b[7] === 0x0a,
  },
  {
    mime: "image/gif",
    ext: "gif",
    match: (b) => b.length >= 6 && ["GIF87a", "GIF89a"].includes(b.toString("ascii", 0, 6)),
  },
  {
    mime: "image/webp",
    ext: "webp",
    match: (b) => b.length >= 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP",
  },
  { mime: "application/pdf", ext: "pdf", match: (b) => b.length >= 5 && b.toString("ascii", 0, 5) === "%PDF-" },
];

/** The set of types this platform accepts for case documents, gallery photos, and receipts —
 * intentionally narrow. Extend this list deliberately, not by loosening the signature match. */
export const ALLOWED_UPLOAD_MIME_TYPES = new Set(SIGNATURES.map((s) => s.mime));

export function detectFileType(buffer: Buffer): DetectedFileType | null {
  for (const sig of SIGNATURES) {
    if (sig.match(buffer)) return { mime: sig.mime, ext: sig.ext };
  }
  return null;
}
