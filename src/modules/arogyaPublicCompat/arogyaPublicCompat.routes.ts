import { Router } from "express";
import * as controller from "./arogyaPublicCompat.controller";

const router = Router();

router.get("/chairman-message", controller.chairmanMessage);
router.get("/founder-message", controller.founderMessage);
router.get("/seo", controller.seoAll);
router.get("/seo/all", controller.seoAll);
router.get("/speakers/hero", controller.speakerHero);
router.get("/speakers/counters", controller.speakerCounters);
router.get("/expert-speakers/heading", controller.expertSpeakersHeading);
router.get("/expert-speakers", controller.expertSpeakers);
router.get("/more-speakers/categories", controller.moreSpeakerCategories);
router.get("/more-speakers/items", controller.moreSpeakerItems);

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

// /supported-by: NOT a gap — confirmed against the real backend-arogya source that this route
// never existed there either (no supportedByRoutes.js anywhere, no mount for it in server.js).
// Arogya-frontend's supportedByApi already handles the failed fetch by returning null, same as it
// always did in production. Nothing to migrate because nothing real ever existed to migrate.
//
// /countries, /states, /cities, /categories, /coupons/validate, /payment/create-order,
// /payment/verify, /delegates-registration/* are implemented elsewhere — see crmLocation,
// arogyaCategory, arogyaCoupon, arogyaDelegateRegistration modules, all mounted under
// /legacy/arogya/api in routes/index.ts.

export default router;
