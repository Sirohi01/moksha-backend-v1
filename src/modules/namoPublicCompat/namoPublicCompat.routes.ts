import { Router } from "express";
import * as controller from "./namoPublicCompat.controller";

const router = Router();

router.get("/objectives", controller.objectives);
router.get("/initiatives", controller.initiatives);
router.get("/achievements", controller.achievements);
router.get("/testimonials", controller.testimonials);
router.get("/blog", controller.blog);
router.get("/about-us", controller.aboutUs);
router.get("/trust-bodies", controller.trustBodies);
router.get("/banner", controller.banner);
router.get("/heroes", controller.heroes);
router.get("/newsletters", controller.newsletters);
router.get("/recent-updates", controller.recentUpdates);
router.get("/category-image", controller.categoryImage);
router.get("/galleryImage", controller.galleryImage);
router.get("/gallery-video", controller.galleryVideo);
router.get("/published", controller.published);
router.get("/events", controller.events);
router.get("/social-media/get", controller.socialMedia);
router.get("/seo", controller.seoSitemap);
router.get("/seo/page/:path", controller.seoPage);
export default router;
