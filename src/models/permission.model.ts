import { Schema, model, Document, Types } from "mongoose";
import { PermissionAction, PermissionScopeQualifier, PERMISSION_ACTIONS, PERMISSION_SCOPE_QUALIFIERS } from "../utils/constants";

/**
 * The permission registry — PRD §6, §11.3 "permissions". The source of truth for access
 * control: routes declare a `key` (e.g. "cases.approve") and the authorize() middleware checks
 * the actor's resolved role against it. Never checked by role name directly.
 */
export interface IPermission extends Document {
  _id: Types.ObjectId;
  module: string;
  action: PermissionAction;
  key: string;
  label: string;
  scopeQualifier: PermissionScopeQualifier;
  createdAt: Date;
  updatedAt: Date;
}

const permissionSchema = new Schema<IPermission>(
  {
    module: { type: String, required: true, trim: true, lowercase: true },
    action: { type: String, enum: PERMISSION_ACTIONS, required: true },
    key: { type: String, required: true, unique: true, index: true },
    label: { type: String, required: true, trim: true },
    scopeQualifier: { type: String, enum: PERMISSION_SCOPE_QUALIFIERS, default: "ALL" },
  },
  { timestamps: true }
);

permissionSchema.index({ module: 1, action: 1 });

export const Permission = model<IPermission>("Permission", permissionSchema);
