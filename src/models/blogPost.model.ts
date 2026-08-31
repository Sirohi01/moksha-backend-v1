import { Schema, model, Document, Types } from "mongoose";

export interface ISeoOptions {
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string;
  canonicalUrl?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  schemaMarkup?: string;
  h1Tag?: string;
  breadcrumbName?: string;
  internalLinks?: { label: string; url: string }[];
  robotsIndex?: boolean;
  robotsFollow?: boolean;
}

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
  seo?: ISeoOptions;
  createdAt: Date;
  updatedAt: Date;
}

const seoSchema = new Schema<ISeoOptions>(
  {
    metaTitle: { type: String, trim: true, maxlength: 65 },
    metaDescription: { type: String, trim: true, maxlength: 155 },
    metaKeywords: { type: String, trim: true },
    canonicalUrl: { type: String, trim: true },
    ogTitle: { type: String, trim: true },
    ogDescription: { type: String, trim: true },
    ogImage: { type: String, trim: true },
    schemaMarkup: { type: String, trim: true },
    h1Tag: { type: String, trim: true },
    breadcrumbName: { type: String, trim: true },
    robotsIndex: { type: Boolean, default: true },
    robotsFollow: { type: Boolean, default: true },
    internalLinks: {
      type: [
        {
          label: { type: String, trim: true },
          url: { type: String, trim: true },
        },
      ],
      default: [],
    },
  },
  { _id: false }
);

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
    seo: { type: seoSchema },
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
