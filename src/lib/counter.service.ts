import { Counter } from "../models/counter.model";

/** Atomically increments and returns the next value for `key` — safe under concurrent requests
 * because the increment and the read happen in one findOneAndUpdate, not read-then-write. */
export async function getNextSequence(key: string): Promise<number> {
  const counter = await Counter.findByIdAndUpdate(
    key,
    { $inc: { seq: 1 } },
    { upsert: true, new: true }
  );
  return counter.seq;
}

/** PRD §1.1 / §11.4 — Case ID format MS-<year>-<6-digit sequence>, e.g. MS-2026-000125. */
export async function generateCaseId(): Promise<string> {
  const year = new Date().getFullYear();
  const seq = await getNextSequence(`case:${year}`);
  return `MS-${year}-${String(seq).padStart(6, "0")}`;
}

/** Assistance request intake reference, e.g. REQ-2026-004512 (PRD §11.4 assistanceRequests). */
export async function generateRequestNo(): Promise<string> {
  const year = new Date().getFullYear();
  const seq = await getNextSequence(`request:${year}`);
  return `REQ-${year}-${String(seq).padStart(6, "0")}`;
}

/** 80G receipt number, e.g. MS/80G/2026/000123 (PRD §11.4 receipts). */
export async function generateReceiptNo(): Promise<string> {
  const year = new Date().getFullYear();
  const seq = await getNextSequence(`receipt:${year}`);
  return `MS/80G/${year}/${String(seq).padStart(6, "0")}`;
}
export async function generateVolunteerCode(): Promise<string> {
  const year = new Date().getFullYear();
  const seq = await getNextSequence(`volunteer:${year}`);
  return `MSV-${year}-${String(seq).padStart(6, "0")}`;
}

/** AGS registration number, e.g. AGS/2026/000045. The legacy Namo Gange system hardcoded the
 * edition ("15th") directly into this string and derived the sequence by scanning-and-sorting
 * existing documents rather than an atomic counter — both a yearly maintenance bug and a real
 * race condition under concurrent submissions. This fixes both: the year is read live, and the
 * atomic $inc here can never hand out the same number twice, however many requests land at once. */
/** Arogya delegate code, e.g. AROGYA/2026/000045 — one global atomic sequence per year, same
 * reasoning as generateAgsRegistrationNo (the legacy system's own numbering had no atomic counter
 * at all — see migration-tools/arogya-payment-migration-requirements.md). */
export async function generateArogyaDelegateCode(): Promise<string> {
  const year = new Date().getFullYear();
  const seq = await getNextSequence(`arogya-delegate:${year}`);
  return `AROGYA/${year}/${String(seq).padStart(6, "0")}`;
}

export async function generateAgsRegistrationNo(): Promise<string> {
  const year = new Date().getFullYear();
  const seq = await getNextSequence(`ags-registration:${year}`);
  return `AGS/${year}/${String(seq).padStart(6, "0")}`;
}
