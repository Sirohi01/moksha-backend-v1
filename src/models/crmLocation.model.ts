import { Schema, model, Document } from "mongoose";

/** Shared, organisation-agnostic reference data (country/state/city names) — not tied to any
 * organisationId. The legacy Arogya system had its own copy of this (backend-arogya/models/
 * crm/Crm{Country,State,City}.js, numeric-code-linked, not ObjectId refs) — preserved as-is
 * rather than switched to ObjectId refs, since every existing record and the registration form's
 * own client-side logic (country->state->city cascade) is keyed on these numeric codes. */

export interface ICrmCountry extends Document {
  countryCode: number;
  sortName: string;
  name: string;
}
const crmCountrySchema = new Schema<ICrmCountry>({
  countryCode: { type: Number, required: true, unique: true },
  sortName: { type: String, required: true },
  name: { type: String, required: true, index: true },
});
export const CrmCountry = model<ICrmCountry>("CrmCountry", crmCountrySchema);

export interface ICrmState extends Document {
  stateCode: number;
  name: string;
  countryCode: number;
}
const crmStateSchema = new Schema<ICrmState>({
  stateCode: { type: Number, required: true, unique: true },
  name: { type: String, required: true, index: true },
  countryCode: { type: Number, required: true, index: true },
});
export const CrmState = model<ICrmState>("CrmState", crmStateSchema);

export interface ICrmCity extends Document {
  cityCode: number;
  name: string;
  stateCode: number;
}
const crmCitySchema = new Schema<ICrmCity>({
  cityCode: { type: Number, required: true, unique: true },
  name: { type: String, required: true, index: true },
  stateCode: { type: Number, required: true, index: true },
});
export const CrmCity = model<ICrmCity>("CrmCity", crmCitySchema);
