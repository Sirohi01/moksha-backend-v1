import { Router } from "express";
import authRoutes from "../modules/auth/auth.routes";
import userRoutes from "../modules/user/user.routes";
import blogRoutes from "../modules/blog/blog.routes";
import galleryRoutes from "../modules/gallery/gallery.routes";
import testimonialRoutes from "../modules/testimonial/testimonial.routes";
import enquiryRoutes from "../modules/enquiry/enquiry.routes";
import faqRoutes from "../modules/faq/faq.routes";
import settingRoutes from "../modules/setting/setting.routes";
import uploadRoutes from "../modules/upload/upload.routes";
import donationRoutes from "../modules/donation/donation.routes";
import requestRoutes from "../modules/request/request.routes";
import caseRoutes from "../modules/case/case.routes";
import volunteerRoutes from "../modules/volunteer/volunteer.routes";
import campaignRoutes from "../modules/campaign/campaign.routes";
import reportRoutes from "../modules/report/report.routes";
import vehicleRoutes from "../modules/vehicle/vehicle.routes";
import serviceProviderRoutes from "../modules/serviceProvider/serviceProvider.routes";
import expenseCategoryRoutes from "../modules/expenseCategory/expenseCategory.routes";
import partnerRoutes from "../modules/partner/partner.routes";
import roleRoutes from "../modules/role/role.routes";
import auditRoutes from "../modules/audit/audit.routes";
import newsletterRoutes from "../modules/newsletter/newsletter.routes";
import adminNotificationRoutes from "../modules/adminNotification/adminNotification.routes";
import organisationRoutes from "../modules/organisation/organisation.routes";
import projectRoutes from "../modules/project/project.routes";
import accessGrantRoutes from "../modules/accessGrant/accessGrant.routes";
import jobRoutes from "../modules/job/job.routes";
import memberRoutes from "../modules/member/member.routes";
import namoContentRoutes from "../modules/namoContent/namoContent.routes";
import namoVolunteerRoutes from "../modules/namoVolunteer/namoVolunteer.routes";
import namoAgsDelegateRoutes from "../modules/namoAgsDelegate/namoAgsDelegate.routes";
import namoAgsPaymentRoutes from "../modules/namoAgsPayment/namoAgsPayment.routes";
import arogyaContentRoutes from "../modules/arogyaContent/arogyaContent.routes";
import arogyaPublicCompatRoutes from "../modules/arogyaPublicCompat/arogyaPublicCompat.routes";
import crmLocationRoutes from "../modules/crmLocation/crmLocation.routes";
import arogyaCategoryRoutes from "../modules/arogyaCategory/arogyaCategory.routes";
import arogyaPassRoutes from "../modules/arogyaPass/arogyaPass.routes";
import arogyaCouponRoutes from "../modules/arogyaCoupon/arogyaCoupon.routes";
import arogyaDelegateRegistrationRoutes from "../modules/arogyaDelegateRegistration/arogyaDelegateRegistration.routes";
import arogyaPaymentRoutes from "../modules/arogyaDelegateRegistration/arogyaPayment.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/blog", blogRoutes);
router.use("/gallery", galleryRoutes);
router.use("/testimonials", testimonialRoutes);
router.use("/enquiries", enquiryRoutes);
router.use("/faqs", faqRoutes);
router.use("/settings", settingRoutes);
router.use("/uploads", uploadRoutes);
router.use("/donations", donationRoutes);
router.use("/requests", requestRoutes);
router.use("/cases", caseRoutes);
router.use("/volunteers", volunteerRoutes);
router.use("/campaigns", campaignRoutes);
router.use("/reports", reportRoutes);
router.use("/vehicles", vehicleRoutes);
router.use("/service-providers", serviceProviderRoutes);
router.use("/expense-categories", expenseCategoryRoutes);
router.use("/partners", partnerRoutes);
router.use("/roles", roleRoutes);
router.use("/audit", auditRoutes);
router.use("/newsletter", newsletterRoutes);
router.use("/notifications", adminNotificationRoutes);
router.use("/organisations", organisationRoutes);
router.use("/projects", projectRoutes);
router.use("/access-grants", accessGrantRoutes);
router.use("/jobs", jobRoutes);
router.use("/members", memberRoutes);
router.use("/namo-content", namoContentRoutes);
router.use("/namo-volunteers", namoVolunteerRoutes);
router.use("/ags-delegates", namoAgsDelegateRoutes);
router.use("/ags-payments", namoAgsPaymentRoutes);
router.use("/arogya-content", arogyaContentRoutes);
// Arogya-frontend's own api.js appends "/api" to whatever base URL it's given unless the base
// already ends with that literal segment (a quirk in that repo, not something we control) — the
// trailing /api here exists ONLY to satisfy that, matching VITE_API_URL=.../legacy/arogya with
// zero changes needed in Arogya-frontend's own code. See UNIFIED_PLATFORM_STATE.md §D/§E.
router.use("/legacy/arogya/api", arogyaPublicCompatRoutes);
// Bare reference-data lookups — no admin CRUD by design (see crmLocation.routes.ts), so this is
// their only mount point.
router.use("/legacy/arogya/api", crmLocationRoutes);

// Clean admin-facing mounts (moksha-admin's future Arogya delegates/passes/coupons screens).
router.use("/arogya-categories", arogyaCategoryRoutes);
router.use("/arogya-passes", arogyaPassRoutes);
router.use("/arogya-coupons", arogyaCouponRoutes);
// Same routers, mounted again under the legacy-compat prefix so Arogya-frontend's real
// `/categories?type=` and `/coupons/validate` calls resolve without any change on its side.
router.use("/legacy/arogya/api/categories", arogyaCategoryRoutes);
router.use("/legacy/arogya/api/coupons", arogyaCouponRoutes);
router.use("/legacy/arogya/api/delegates-registration", arogyaDelegateRegistrationRoutes);
router.use("/legacy/arogya/api/payment", arogyaPaymentRoutes);
// Clean admin-facing mount for moksha-admin's delegate registrations viewer (the /admin/* routes
// only — the public initiate/verify/verify-group routes are also reachable here, harmlessly, but
// the frontend only ever calls the legacy-prefixed mount above).
router.use("/arogya-delegates", arogyaDelegateRegistrationRoutes);

export default router;
