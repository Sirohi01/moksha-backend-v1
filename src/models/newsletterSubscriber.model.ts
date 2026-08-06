import { Schema, model, Document, Types } from "mongoose";

/** The footer's "share your email, we'll contact you" capture — deliberately its own minimal
 * collection rather than reusing Enquiry (which requires phone + a message neither footer form
 * collects). Idempotent on email: re-submitting the same address is a no-op, not a duplicate row. */
export interface INewsletterSubscriber extends Document {
  _id: Types.ObjectId;
  email: string;
  source?: string;
  createdAt: Date;
}

const newsletterSubscriberSchema = new Schema<INewsletterSubscriber>(
  {
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
    source: { type: String, trim: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const NewsletterSubscriber = model<INewsletterSubscriber>("NewsletterSubscriber", newsletterSubscriberSchema);
