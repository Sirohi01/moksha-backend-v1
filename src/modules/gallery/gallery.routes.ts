import { Router } from "express";
import { GalleryItem } from "../../models/gallery.model";
import { authorize, requireAuth } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { buildAdminCrudHandlers, mountAdminCrudRoutes } from "../../utils/crudFactory";
import * as galleryController from "./gallery.controller";
import { createGalleryItemSchema, listPublicGallerySchema, updateGalleryItemSchema } from "./gallery.validation";

const router = Router();
const adminGuards = [requireAuth, authorize("cms.update")];
const handlers = buildAdminCrudHandlers(GalleryItem, "Gallery item");

router.get("/", validate(listPublicGallerySchema), galleryController.listPublicGallery);

mountAdminCrudRoutes(router, handlers, adminGuards);
router.post("/admin", ...adminGuards, validate(createGalleryItemSchema), handlers.create);
router.put("/admin/:id", ...adminGuards, validate(updateGalleryItemSchema), handlers.update);

export default router;
