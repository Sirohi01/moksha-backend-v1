import { Schema, model, Document, Types } from "mongoose";

export interface IBlogPost extends Document {
  _id: Types.ObjectId;
  title: string;
  slug: string;
  excerpt?: string;
  content: string;
  coverImage?: string;
  author: string;
  tags: string[];
  isPublished: boolean;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const blogPostSchema = new Schema<IBlogPost>(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true, index: true },
    excerpt: { type: String },
    content: { type: String, required: true },
    coverImage: { type: String },
    author: { type: String, required: true },
    tags: { type: [String], default: [] },
    isPublished: { type: Boolean, default: false },
    publishedAt: { type: Date },
  },
  { timestamps: true }
);

blogPostSchema.pre("save", function (next) {
  if (this.isModified("isPublished") && this.isPublished && !this.publishedAt) {
    this.publishedAt = new Date();
  }
  next();
});

blogPostSchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate() as Partial<IBlogPost> | null;
  if (update?.isPublished && !update.publishedAt) {
    update.publishedAt = new Date();
    this.setUpdate(update);
  }
  next();
});

export const BlogPost = model<IBlogPost>("BlogPost", blogPostSchema);
