import { Schema, model, Document, Types } from "mongoose";
import { RoleScope, ROLE_SCOPES } from "../utils/constants";

/** Named bundles of permission keys — PRD §11.3 "roles". Created and edited entirely from the
 * admin panel; the API never hard-codes a role name, only permission keys. */
export interface IRole extends Document {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  description?: string;
  permissionIds: Types.ObjectId[];
  isSystem: boolean;
  scope: RoleScope;
  status: "ACTIVE" | "INACTIVE";
  createdAt: Date;
  updatedAt: Date;
}

const roleSchema = new Schema<IRole>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true, index: true },
    description: { type: String, trim: true },
    permissionIds: [{ type: Schema.Types.ObjectId, ref: "Permission" }],
    isSystem: { type: Boolean, default: false },
    scope: { type: String, enum: ROLE_SCOPES, default: "GLOBAL" },
    status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" },
  },
  { timestamps: true }
);

export const Role = model<IRole>("Role", roleSchema);
