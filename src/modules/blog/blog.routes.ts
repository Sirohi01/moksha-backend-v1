import { Router } from "express";
import { BlogPost } from "../../models/blogPost.model";
import { authorize, requireAuth } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { buildAdminCrudHandlers, mountAdminCrudRoutes } from "../../utils/crudFactory";
import * as blogController from "./blog.controller";
import { createBlogPostSchema, updateBlogPostSchema } from "./blog.validation";

const router = Router();
const adminGuards = [requireAuth, authorize("cms.update")];
const handlers = buildAdminCrudHandlers(BlogPost, "Blog post");

router.get("/", blogController.listPublicPosts);
mountAdminCrudRoutes(router, handlers, adminGuards);
router.post("/admin", ...adminGuards, validate(createBlogPostSchema), handlers.create);
router.put("/admin/:id", ...adminGuards, validate(updateBlogPostSchema), handlers.update);
router.get("/:slug", blogController.getPublicPostBySlug);

export default router;
