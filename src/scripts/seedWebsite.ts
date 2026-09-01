import "dotenv/config";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { connectDB, disconnectDB } from "../config/db";
import { logger } from "../config/logger";
import { getSettings } from "../modules/setting/setting.service";

async function loadDefaultSections(filename: string): Promise<any> {
  const adminDefaults = path.resolve(__dirname, `../../../moksha-admin/lib/${filename}`);
  return await import(pathToFileURL(adminDefaults).href);
}

async function loadFrontendSeo(): Promise<any> {
  const seoSource = path.resolve(__dirname, "../../../moksha_clone_voyage/lib/seo.ts");
  return await import(pathToFileURL(seoSource).href);
}

type FrontendSeoRoute = {
  path: string;
  label: string;
  title: string;
  description: string;
  keywords: string[];
  ogImage: string;
  index?: boolean;
};

function pageSeo(route: FrontendSeoRoute, siteUrl: string) {
  const canonicalUrl = new URL(route.path, siteUrl).toString();

  return {
    metaTitle: route.title,
    metaDescription: route.description,
    metaKeywords: route.keywords.join(", "),
    canonicalUrl,
    ogTitle: route.title,
    ogDescription: route.description,
    ogImage: new URL(route.ogImage, siteUrl).toString(),
    h1Tag: route.label,
    breadcrumbName: route.label,
    robotsIndex: route.index !== false,
    robotsFollow: true,
    schemaMarkup: JSON.stringify({
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: route.title,
      description: route.description,
      url: canonicalUrl,
      isPartOf: {
        "@type": "WebSite",
        name: "Moksha Sewa",
        url: siteUrl,
      },
    }),
  };
}

export async function seedWebsite(): Promise<void> {
  const landingModule = await loadDefaultSections("landingContent.ts");
  const aboutModule = await loadDefaultSections("aboutContent.ts");
  const extraModule = await loadDefaultSections("extraPagesContent.ts");
  const seoModule = await loadFrontendSeo();
  const siteUrl = seoModule.SITE_URL as string;
  const seoRoutes = seoModule.seoRoutes as FrontendSeoRoute[];
  const seoByPath = new Map(seoRoutes.map((route) => [route.path, pageSeo(route, siteUrl)]));
  const seo = (routePath: string) => seoByPath.get(routePath);

  const settings = await getSettings();

  // Landing & About
  settings.landingPage = { sections: landingModule.defaultLandingSections as never, seo: seo("/") };
  settings.aboutPage = { sections: aboutModule.defaultAboutSections as never, seo: seo("/about") };

  // Extra Pages
  settings.servicesPage = { sections: extraModule.defaultServicesSections as never, seo: seo("/our-services") };
  settings.ambulancePage = { sections: extraModule.defaultAmbulanceSections as never, seo: seo("/ambulanceservices") };
  settings.panditPage = { sections: extraModule.defaultPanditSections as never, seo: seo("/panditservices") };
  settings.funeralPage = { sections: extraModule.defaultFuneralSections as never, seo: seo("/furalservices") };
  settings.funeralDecorationPage = { sections: extraModule.defaultFuneralDecorationSections as never, seo: seo("/furaldecoration") };
  settings.prayerHallPage = { sections: extraModule.defaultPrayerHallSections as never, seo: seo("/prayerhallservices") };
  settings.specialServicePage = { sections: extraModule.defaultSpecialServiceSections as never, seo: seo("/specialservices") };
  settings.callingRelativesPage = { sections: extraModule.defaultCallingRelativesSections as never, seo: seo("/callingrelativesservices") };
  settings.harsevanPage = { sections: extraModule.defaultHarsevanSections as never, seo: seo("/harsevanservices") };
  settings.unclaimedBodyPage = { sections: extraModule.defaultUnclaimedBodySections as never, seo: seo("/unclaimed-body-sewa") };
  settings.volunteerPage = { sections: extraModule.defaultVolunteerSections as never, seo: seo("/volunteer/register") };
  settings.partnershipPage = { sections: extraModule.defaultPartnershipSections as never, seo: seo("/partnership") };
  settings.csrPage = { sections: extraModule.defaultCSRSections as never, seo: seo("/csr") };
  settings.requestHelpPage = { sections: extraModule.defaultRequestHelpSections as never, seo: seo("/request-help") };
  settings.donationPage = { sections: extraModule.defaultDonationSections as never, seo: seo("/donation") };
  settings.contactPage = { sections: extraModule.defaultContactSections as never, seo: seo("/contact") };
  settings.trackPage = { sections: extraModule.defaultTrackSections as never, seo: seo("/track") };

  // Legal Pages
  settings.privacyPage = { sections: extraModule.defaultPrivacySections as never, seo: seo("/privacy-policy") };
  settings.termsPage = { sections: extraModule.defaultTermsSections as never, seo: seo("/terms") };
  settings.refundPage = { sections: extraModule.defaultRefundSections as never, seo: seo("/refund-policy") };
  settings.conductPage = { sections: extraModule.defaultConductSections as never, seo: seo("/code-of-conduct") };

  await settings.save();
  logger.info(`All website pages seeded successfully.`);
}

if (require.main === module) {
  connectDB()
    .then(seedWebsite)
    .then(disconnectDB)
    .catch((err) => {
      logger.error("Failed to seed website pages", { err });
      process.exit(1);
    });
}
