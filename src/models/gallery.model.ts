import { Schema, model, Document, Types } from "mongoose";

export interface IGalleryItem extends Document {
  _id: Types.ObjectId;
  type: "image" | "video";
  url: string;
  thumbnailUrl?: string;
  publicId?: string;
  thumbnailPublicId?: string;
  alt: string;
  caption?: string;
  description?: string;
  category?: string;
  credit?: string;
  sortOrder: number;
  downloadCount: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const galleryItemSchema = new Schema<IGalleryItem>(
  {
    type: { type: String, enum: ["image", "video"], required: true },
    url: { type: String, required: true },
    thumbnailUrl: { type: String },
    publicId: { type: String },
    thumbnailPublicId: { type: String },
    alt: { type: String, required: true, trim: true },
    caption: { type: String },
    description: { type: String },
    category: { type: String },
    credit: { type: String },
    sortOrder: { type: Number, default: 0 },
    downloadCount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const GalleryItem = model<IGalleryItem>("GalleryItem", galleryItemSchema);
