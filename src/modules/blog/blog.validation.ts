import { z } from "zod";
import { zBoolean } from "../../utils/zodHelpers";

export const createBlogPostSchema = z.object({
  body: z.object({
    title: z.string().trim().min(3),
    slug: z.string().trim().min(3).regex(/^[a-z0-9-]+$/, "Slug must be lowercase, alphanumeric and hyphens only"),
    excerpt: z.string().trim().optional(),
    content: z.string().trim().min(20),
    coverImage: z.string().trim().optional(),
    author: z.string().trim().min(2),
    tags: z.array(z.string()).default([]),
    isPublished: zBoolean(false),
  }),
});

export const updateBlogPostSchema = z.object({
  params: z.object({ id: z.string().trim().min(1) }),
  body: createBlogPostSchema.shape.body.partial(),
});
