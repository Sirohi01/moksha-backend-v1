import { Schema, model, Document, Types } from "mongoose";
import { UserType, USER_TYPES, NewUserStatus, NEW_USER_STATUSES } from "../utils/constants";
import { encryptField } from "../lib/crypto";

/**
 * PRD §11.3 "users" — the single account collection for internal staff, volunteers and donors,
 * replacing the old separate User/Admin models. `userType` says which surface the account may use;
 * `roleId` says what it's allowed to do (resolved to permissions fresh on every request, see
 * auth.middleware.ts — never trusted from the JWT).
 */
export interface IUserAddress {
  line1: string;
  city: string;
  state: string;
  pincode: string;
}

export interface IUser extends Document {
  _id: Types.ObjectId;
  name: string;
  email?: string;
  phone: string;
  avatarUrl?: string;
  passwordHash?: string;
  roleId?: Types.ObjectId;
  userType: UserType;
  status: NewUserStatus;
  isPhoneVerified: boolean;
  isEmailVerified: boolean;
  otpHash?: string;
  otpExpiresAt?: Date;
  addresses: IUserAddress[];
  twoFactor: {
    enabled: boolean;
    secret?: string;
    backupCodeHashes?: string[];
  };
  failedLoginCount: number;
  lockedUntil?: Date;
  lastLoginAt?: Date;
  passwordChangedAt?: Date;
  passwordResetTokenHash?: string;
  passwordResetExpiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const addressSchema = new Schema<IUserAddress>(
  {
    line1: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
  },
  { _id: false }
);

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    // email/phone are login-lookup keys — never encrypted, same documented constraint as the
    // fields this replaces (see fieldEncryption.ts's own note on why lookup keys are excluded).
    email: { type: String, trim: true, lowercase: true, sparse: true, unique: true },
    phone: { type: String, required: true, unique: true, trim: true, index: true },
    avatarUrl: { type: String, trim: true },
    passwordHash: { type: String, select: false },
    roleId: { type: Schema.Types.ObjectId, ref: "Role", index: true },
    userType: { type: String, enum: USER_TYPES, default: "DONOR", index: true },
    status: { type: String, enum: NEW_USER_STATUSES, default: "ACTIVE" },
    isPhoneVerified: { type: Boolean, default: false },
    isEmailVerified: { type: Boolean, default: false },
    otpHash: { type: String, select: false },
    otpExpiresAt: { type: Date, select: false },
    addresses: { type: [addressSchema], default: [] },
    twoFactor: {
      enabled: { type: Boolean, default: false },
      secret: { type: String, select: false },
      backupCodeHashes: { type: [String], select: false, default: undefined },
    },
    failedLoginCount: { type: Number, default: 0 },
    lockedUntil: { type: Date },
    lastLoginAt: { type: Date },
    passwordChangedAt: { type: Date },
    // Only the SHA-256 hash is ever stored — the raw token lives solely in the emailed link, same
    // reasoning as otpHash never storing the OTP itself.
    passwordResetTokenHash: { type: String, select: false },
    passwordResetExpiresAt: { type: Date, select: false },
  },
  { timestamps: true }
);

// Street address is PII and isn't a lookup key — encrypted at rest like every other address field
// in this codebase. city/state/pincode stay plain (needed for filtering/reporting later).
// `addresses` is an array (unlike Booking's single embedded address), so this needs its own hook
// rather than the generic encryptFieldsOnSave — that helper only walks a single dot-path, and
// "addresses.0.line1" would silently leave a 2nd/3rd saved address unencrypted.
userSchema.pre("save", function (next) {
  if (this.isModified("addresses")) {
    this.addresses = this.addresses.map((address) => {
      const isAlreadyEncrypted = address.line1.split(":").length === 3;
      if (isAlreadyEncrypted) return address;
      return { ...address, line1: encryptField(address.line1) };
    });
  }
  next();
});

export const User = model<IUser>("User", userSchema);
