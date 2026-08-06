import { z } from "zod";
import { zBoolean } from "../../utils/zodHelpers";

export const createGalleryItemSchema = z.object({
  body: z.object({
    type: z.enum(["image", "video"]),
    url: z.string().trim().min(1),
    thumbnailUrl: z.string().trim().optional(),
    caption: z.string().trim().optional(),
    category: z.string().trim().optional(),
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
