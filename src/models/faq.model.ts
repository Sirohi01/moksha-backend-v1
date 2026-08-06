import { Schema, model, Document, Types } from "mongoose";

export interface IFaq extends Document {
  _id: Types.ObjectId;
  question: string;
  answer: string;
  category?: string;
  order: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const faqSchema = new Schema<IFaq>(
  {
    question: { type: String, required: true },
    answer: { type: String, required: true },
    category: { type: String },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Faq = model<IFaq>("Faq", faqSchema);
