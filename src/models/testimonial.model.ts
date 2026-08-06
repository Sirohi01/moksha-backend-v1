import { Schema, model, Document, Types } from "mongoose";

export interface ITestimonial extends Document {
  _id: Types.ObjectId;
  name: string;
  photo?: string;
  message: string;
  rating: number;
  isApproved: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const testimonialSchema = new Schema<ITestimonial>(
  {
    name: { type: String, required: true, trim: true },
    photo: { type: String },
    message: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    isApproved: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Testimonial = model<ITestimonial>("Testimonial", testimonialSchema);
