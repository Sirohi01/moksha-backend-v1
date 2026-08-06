import { Request, Response } from "express";
import { BlogPost } from "../../models/blogPost.model";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/ApiResponse";
import { ApiError } from "../../utils/ApiError";

export const listPublicPosts = asyncHandler(async (_req: Request, res: Response) => {
  const posts = await BlogPost.find({ isPublished: true }).sort({ publishedAt: -1 });
  sendSuccess(res, 200, "Blog posts fetched", posts);
});

export const getPublicPostBySlug = asyncHandler(async (req: Request, res: Response) => {
  const post = await BlogPost.findOne({ slug: req.params.slug, isPublished: true });
  if (!post) throw ApiError.notFound("Blog post not found");
  sendSuccess(res, 200, "Blog post fetched", post);
});
