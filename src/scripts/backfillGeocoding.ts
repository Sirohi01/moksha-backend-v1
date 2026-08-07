import { connectDB, disconnectDB } from "../config/db";
import { logger } from "../config/logger";
import { AssistanceRequest } from "../models/assistanceRequest.model";
import { Volunteer } from "../models/volunteer.model";
import { geocodeAddress } from "../lib/geocoding";
import { decryptField } from "../lib/crypto";

/**
 * One-time (re-runnable) backfill for every AssistanceRequest/Volunteer that predates the
 * geocoding feature and so has no location.lat/lng yet. Runs sequentially — geocodeAddress()
 * already throttles to Nominatim's 1 request/second limit internally, so awaiting each call in
 * turn (rather than Promise.all-ing them) is what keeps this script within that budget instead of
 * firing a burst of requests all at once.
 */
async function backfillRequests(): Promise<number> {
  const requests = await AssistanceRequest.find({
    "location.lat": { $exists: false },
  });

  let updated = 0;
  for (const request of requests) {
    const address = decryptField(request.location.address);
    const query = [address, request.location.area, request.location.city, request.location.state, request.location.pincode, "India"]
      .filter(Boolean)
      .join(", ");

    const coords = await geocodeAddress(query);
    if (coords) {
      request.location.lat = coords.lat;
      request.location.lng = coords.lng;
      await request.save();
      updated += 1;
    }
  }
  return updated;
}

async function backfillVolunteers(): Promise<number> {
  const volunteers = await Volunteer.find({ lat: { $exists: false } });

  let updated = 0;
  for (const volunteer of volunteers) {
    const address = volunteer.address ? decryptField(volunteer.address) : undefined;
    const query = [address, volunteer.city, volunteer.state, volunteer.pincode, "India"].filter(Boolean).join(", ");

    const coords = await geocodeAddress(query);
    if (coords) {
      volunteer.lat = coords.lat;
      volunteer.lng = coords.lng;
      await volunteer.save();
      updated += 1;
    }
  }
  return updated;
}

export async function backfillGeocoding(): Promise<void> {
  const requestsUpdated = await backfillRequests();
  logger.info(`Geocoded ${requestsUpdated} assistance request(s)`);

  const volunteersUpdated = await backfillVolunteers();
  logger.info(`Geocoded ${volunteersUpdated} volunteer(s)`);
}

if (require.main === module) {
  connectDB()
    .then(backfillGeocoding)
    .then(disconnectDB)
    .catch((err) => {
      logger.error("Failed to backfill geocoding", { err });
      process.exit(1);
    });
}
