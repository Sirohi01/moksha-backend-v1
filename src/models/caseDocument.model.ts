import { Schema, model, Document, Types } from "mongoose";
import { DocumentType, DOCUMENT_TYPES } from "../utils/constants";

/** PRD §11.4 "caseDocuments" — proof and supporting documents attached to a case. Stored via the
 * existing Cloudinary upload pipeline (lib/cloudinary.ts); `isProof` is what the CLOSED transition
 * guard checks for (PRD BR-03 — a case can't close without at least one proof document). */
export interface ICaseDocument extends Document {
  _id: Types.ObjectId;
  caseId: Types.ObjectId;
  docType: DocumentType;
  url: string;
  cloudinaryPublicId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  isProof: boolean;
  uploadedBy: Types.ObjectId;
  createdAt: Date;
}

const caseDocumentSchema = new Schema<ICaseDocument>(
  {
    caseId: { type: Schema.Types.ObjectId, ref: "Case", required: true, index: true },
    docType: { type: String, enum: DOCUMENT_TYPES, required: true },
    url: { type: String, required: true },
    cloudinaryPublicId: { type: String, required: true },
    fileName: { type: String, required: true },
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
    isProof: { type: Boolean, default: false },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const CaseDocument = model<ICaseDocument>("CaseDocument", caseDocumentSchema);
