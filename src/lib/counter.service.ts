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
