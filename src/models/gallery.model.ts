import { Schema, model, Document, Types } from "mongoose";

export interface IGalleryItem extends Document {
  _id: Types.ObjectId;
  type: "image" | "video";
  url: string;
  thumbnailUrl?: string;
  caption?: string;
  category?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const galleryItemSchema = new Schema<IGalleryItem>(
  {
    type: { type: String, enum: ["image", "video"], required: true },
    url: { type: String, required: true },
    thumbnailUrl: { type: String },
    caption: { type: String },
    category: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const GalleryItem = model<IGalleryItem>("GalleryItem", galleryItemSchema);
