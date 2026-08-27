import "dotenv/config";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { connectDB, disconnectDB } from "../config/db";
import { logger } from "../config/logger";
import { getSettings } from "../modules/setting/setting.service";

async function loadDefaultSections(filename: string): Promise<any> {
  const adminDefaults = path.resolve(__dirname, `../../../moksha-admin-v1/lib/${filename}`);
  return await import(pathToFileURL(adminDefaults).href);
}

export async function seedWebsite(): Promise<void> {
  const landingModule = await loadDefaultSections("landingContent.ts");
  const aboutModule = await loadDefaultSections("aboutContent.ts");
  const extraModule = await loadDefaultSections("extraPagesContent.ts");

  const settings = await getSettings();

  // Landing & About
  settings.landingPage = { sections: landingModule.defaultLandingSections as never };
  settings.aboutPage = { sections: aboutModule.defaultAboutSections as never };

  // Extra Pages
  settings.servicesPage = { sections: extraModule.defaultServicesSections as never };
  settings.ambulancePage = { sections: extraModule.defaultAmbulanceSections as never };
  settings.panditPage = { sections: extraModule.defaultPanditSections as never };
  settings.funeralPage = { sections: extraModule.defaultFuneralSections as never };
  settings.funeralDecorationPage = { sections: extraModule.defaultFuneralDecorationSections as never };
  settings.prayerHallPage = { sections: extraModule.defaultPrayerHallSections as never };
  settings.specialServicePage = { sections: extraModule.defaultSpecialServiceSections as never };
  settings.callingRelativesPage = { sections: extraModule.defaultCallingRelativesSections as never };
  settings.harsevanPage = { sections: extraModule.defaultHarsevanSections as never };
  settings.unclaimedBodyPage = { sections: extraModule.defaultUnclaimedBodySections as never };
  settings.volunteerPage = { sections: extraModule.defaultVolunteerSections as never };
  settings.partnershipPage = { sections: extraModule.defaultPartnershipSections as never };
  settings.csrPage = { sections: extraModule.defaultCSRSections as never };
  settings.requestHelpPage = { sections: extraModule.defaultRequestHelpSections as never };
  settings.donationPage = { sections: extraModule.defaultDonationSections as never };
  settings.contactPage = { sections: extraModule.defaultContactSections as never };
  settings.trackPage = { sections: extraModule.defaultTrackSections as never };

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
