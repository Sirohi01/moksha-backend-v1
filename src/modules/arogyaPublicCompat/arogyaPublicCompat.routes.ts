import { Router } from "express";
import * as controller from "./arogyaPublicCompat.controller";

const router = Router();

router.get("/hero/all", controller.heroAll);
router.get("/settings", controller.settingsGet);
router.get("/glimpse/settings", controller.glimpseSettings);
router.get("/glimpse/years", controller.glimpseYears);
router.get("/glimpse/categories", controller.glimpseCategories);
router.get("/glimpse/gallery", controller.glimpseGallery);
router.get("/glimpse/counters", controller.glimpseCounters);
router.get("/glimpse/videos", controller.glimpseVideos);
router.get("/global-voices/settings", controller.globalVoicesSettings);
router.get("/global-voices/categories", controller.globalVoicesCategories);
router.get("/global-voices/counters", controller.globalVoicesCounters);
router.get("/global-voices/speakers", controller.globalVoicesSpeakers);
router.get("/global-voices/carousel-speakers", controller.globalVoicesCarouselSpeakers);
router.get("/testimonials/settings", controller.testimonialsSettings);
router.get("/testimonials/items", controller.testimonialsItems);
router.get("/testimonials/counters", controller.testimonialsCounters);
router.get("/testimonials/videos", controller.testimonialsVideos);
router.get("/previous-speakers/heading", controller.previousSpeakersHeading);
router.get("/previous-speakers/items", controller.previousSpeakersItems);
router.get("/social-media", controller.socialMedia);
router.get("/faq", controller.faqGet);
router.get("/partners-page", controller.partnersPageGet);
router.get("/organising-committee", controller.organisingCommittee);
router.get("/eminent-speakers", controller.eminentSpeakers);

// NOT YET IMPLEMENTED (see UNIFIED_PLATFORM_STATE.md §H P-07/P-08/P-09) — the Arogya-frontend
// will 404 on these until the delegate/payment/coupon module and CRM lookups are built:
//   /supported-by, /countries, /states, /cities, /categories, /coupons/validate,
//   /payment/create-order, /payment/verify, /delegates-registration/*

export default router;
