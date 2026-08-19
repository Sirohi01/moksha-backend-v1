import { z } from "zod";
import { zBoolean } from "../../utils/zodHelpers";

export const createGalleryItemSchema = z.object({
  body: z.object({
    type: z.enum(["image", "video"]),
    url: z.string().trim().min(1),
    thumbnailUrl: z.string().trim().optional(),
    publicId: z.string().trim().optional(),
    thumbnailPublicId: z.string().trim().optional(),
    alt: z.string().trim().min(3, "Alt text is required"),
    caption: z.string().trim().optional(),
    description: z.string().trim().max(500).optional(),
    category: z.string().trim().optional(),
    credit: z.string().trim().optional(),
    sortOrder: z.coerce.number().int().min(0).default(0),
    isActive: zBoolean(true),
  }),
});

export const updateGalleryItemSchema = z.object({
  params: z.object({ id: z.string().trim().min(1) }),
  body: createGalleryItemSchema.shape.body.partial(),
});

export const listPublicGallerySchema = z.object({
  query: z.object({
    type: z.enum(["image", "video"]).optional(),
  }),
});
