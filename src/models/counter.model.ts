import { Schema, model, Document } from "mongoose";

/** PRD §11.4 "counters" — atomic sequence generator for human-facing identifiers like Case IDs.
 * Incremented via findOneAndUpdate $inc, never by counting existing records (which isn't safe
 * under concurrency). */
export interface ICounter extends Omit<Document, "_id"> {
  _id: string;
  seq: number;
}

const counterSchema = new Schema<ICounter>({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

export const Counter = model<ICounter>("Counter", counterSchema);
