import { logger } from "../config/logger";

/**
 * Free geocoding via Nominatim (OpenStreetMap) — no API key, no billing account. Used instead of
 * Google's Geocoding API because there's no budget for it (see notify.service.ts's own "never
 * blocks the caller" precedent for the same reasoning pattern applied here).
 *
 * Nominatim's usage policy (https://operations.osmfoundation.org/policies/nominatim/) caps
 * unauthenticated use at 1 request/second and requires a real identifying User-Agent — the queue
 * below enforces the former in-process (every geocodeAddress() call across the whole app shares
 * one throttle), the header satisfies the latter.
 */
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "MokshaSewa/1.0 (NGO cremation-assistance platform)";
const MIN_INTERVAL_MS = 1100;

let lastRequestAt = 0;
let queue: Promise<unknown> = Promise.resolve();

function throttle<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const wait = MIN_INTERVAL_MS - (Date.now() - lastRequestAt);
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastRequestAt = Date.now();
    return fn();
  });
  // The shared queue must keep advancing even if this particular lookup fails — otherwise one bad
  // request would permanently stall every geocoding call queued after it.
  queue = run.catch(() => undefined);
  return run;
}

export interface Coordinates {
  lat: number;
  lng: number;
}

/**
 * Best-effort address → coordinates lookup. Never throws — a failed or rate-limited lookup
 * degrades to "no coordinates yet" (the caller just doesn't get map/distance features for that
 * record), it must never block or fail the request/volunteer-profile flow that triggered it.
 */
export async function geocodeAddress(query: string): Promise<Coordinates | null> {
  const q = query.trim();
  if (!q) return null;

  return throttle(async () => {
    try {
      const url = `${NOMINATIM_URL}?format=json&limit=1&countrycodes=in&q=${encodeURIComponent(q)}`;
      const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
      if (!res.ok) return null;

      const results = (await res.json()) as { lat: string; lon: string }[];
      if (!results.length) return null;

      const lat = parseFloat(results[0].lat);
      const lng = parseFloat(results[0].lon);
      if (Number.isNaN(lat) || Number.isNaN(lng)) return null;

      return { lat, lng };
    } catch (err) {
      logger.warn("geocodeAddress(): lookup failed", { err, query: q });
      return null;
    }
  });
}

/** Haversine distance in kilometers — good enough for "which volunteer is closest" ranking, not
 * turn-by-turn routing. */
export function distanceKm(a: Coordinates, b: Coordinates): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
