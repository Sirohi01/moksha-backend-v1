import mongoose from "mongoose";
import { User, IUser } from "../../models/user.model";
import { Volunteer, IVolunteer } from "../../models/volunteer.model";
import { VolunteerAssignment } from "../../models/volunteerAssignment.model";
import { Case } from "../../models/case.model";
import { Role } from "../../models/role.model";
import { ApiError } from "../../utils/ApiError";
import { env } from "../../config/env";
import { hashPassword } from "../../lib/password.service";
import { issueTokenPair, DeviceInfo } from "../../lib/session.service";
import { notify } from "../../lib/notify.service";
import { writeAuditLog } from "../../lib/audit.service";
import {
  VolunteerStatus,
  VolunteerAvailability,
  VolunteerGender,
  VolunteerBloodGroup,
  VolunteerSchedulePreference,
  VolunteerPreferredRole,
} from "../../utils/constants";
import { compactFilter } from "../../utils/compactFilter";
import { decryptField, maybeDecrypt } from "../../lib/crypto";
import { PaginationParams, buildMeta } from "../../utils/pagination";

interface RegisterVolunteerInput {
  name: string;
  phone: string;
  email: string;
  password: string;
  city: string;
  skills: string[];
  dateOfBirth?: Date;
  gender?: VolunteerGender;
  bloodGroup?: VolunteerBloodGroup;
  address?: string;
  state?: string;
  pincode?: string;
  motivation?: string;
  experience?: string;
  schedulePreference?: VolunteerSchedulePreference;
  preferredRole?: VolunteerPreferredRole;
}

/** PRD FR-VOL-01 — public volunteer sign-up. Creates the unified User (userType VOLUNTEER, role
 * "volunteer") and its Volunteer profile in one transaction — a user without a profile (or vice
 * versa) would be a broken half-account, not a recoverable partial state. */
export async function registerVolunteer(input: RegisterVolunteerInput, deviceInfo?: DeviceInfo) {
  const existing = await User.findOne({ $or: [{ phone: input.phone }, { email: input.email }] });
  if (existing) throw ApiError.conflict("An account with this phone or email already exists");

  const volunteerRole = await Role.findOne({ slug: "volunteer" }).select("_id");
  const passwordHash = await hashPassword(input.password);

  const session = await mongoose.startSession();
  let user: IUser;
  let volunteer: IVolunteer;
  try {
    await session.withTransaction(async () => {
      const createdUsers = await User.create(
        [
          {
            name: input.name,
            phone: input.phone,
            email: input.email,
            passwordHash,
            userType: "VOLUNTEER",
            roleId: volunteerRole?._id,
            lastLoginAt: new Date(),
          },
        ],
        { session }
      );
      user = createdUsers[0];

      const createdVolunteers = await Volunteer.create(
        [
          {
            userId: user._id,
            city: input.city,
            skills: input.skills,
            dateOfBirth: input.dateOfBirth,
            gender: input.gender,
            bloodGroup: input.bloodGroup,
            address: input.address,
            state: input.state,
            pincode: input.pincode,
            motivation: input.motivation,
            experience: input.experience,
            schedulePreference: input.schedulePreference,
            preferredRole: input.preferredRole,
          },
        ],
        { session }
      );
      volunteer = createdVolunteers[0];
    });
  } finally {
    await session.endSession();
  }

  await notify("volunteer.registered", { userId: user!._id.toString(), email: user!.email }, {
    name: input.name,
    city: input.city,
  });

  const { accessToken, refreshToken } = await issueTokenPair(user!._id.toString(), env.JWT_REFRESH_EXPIRY, deviceInfo);

  // The submitter is viewing their own just-submitted data — always decrypt, never gated (same
  // convention as request.service.ts's createRequest).
  const volunteerObj = volunteer!.toObject();
  if (volunteerObj.address) volunteerObj.address = decryptField(volunteerObj.address);

  return { user: user!, volunteer: volunteerObj, accessToken, refreshToken };
}

export async function listVolunteersForAdmin(
  filter: { status?: VolunteerStatus; city?: string },
  pagination?: PaginationParams
) {
  const mongoFilter = compactFilter(filter);
  const query = Volunteer.find(mongoFilter).sort({ createdAt: -1 });
  if (pagination?.requested) query.skip(pagination.skip).limit(pagination.limit);

  const [volunteers, total] = await Promise.all([
    query,
    pagination?.requested ? Volunteer.countDocuments(mongoFilter) : Promise.resolve(undefined),
  ]);
  const users = await User.find({ _id: { $in: volunteers.map((v) => v.userId) } }).select("name phone email");
  const userById = new Map(users.map((u) => [u._id.toString(), u]));

  const items = volunteers.map((v) => {
    const u = userById.get(v.userId.toString());
    const obj = v.toObject();
    return { ...obj, address: obj.address ? maybeDecrypt(obj.address) : obj.address, name: u?.name, phone: u?.phone, email: u?.email };
  });
  const meta = pagination?.requested ? buildMeta(pagination.page, pagination.limit, total!) : undefined;
  return { volunteers: items, meta };
}

async function getVolunteerWithUser(volunteerId: string) {
  const volunteer = await Volunteer.findById(volunteerId);
  if (!volunteer) throw ApiError.notFound("Volunteer not found");
  const user = await User.findById(volunteer.userId).select("name phone email");
  const obj = volunteer.toObject();
  return { ...obj, address: obj.address ? maybeDecrypt(obj.address) : obj.address, name: user?.name, phone: user?.phone, email: user?.email };
}

export const getVolunteerForAdmin = getVolunteerWithUser;

export async function updateVolunteerStatus(volunteerId: string, status: VolunteerStatus, actorUserId: string) {
  const volunteer = await Volunteer.findByIdAndUpdate(volunteerId, { status }, { new: true });
  if (!volunteer) throw ApiError.notFound("Volunteer not found");

  await writeAuditLog({
    userId: actorUserId,
    action: "volunteer.status_changed",
    entityType: "Volunteer",
    entityId: volunteer._id.toString(),
    after: { status },
  });

  return volunteer;
}

async function findMyVolunteerProfile(userId: string): Promise<IVolunteer> {
  const volunteer = await Volunteer.findOne({ userId });
  if (!volunteer) throw ApiError.notFound("Volunteer profile not found");
  return volunteer;
}

/** The volunteer viewing their own profile — always decrypts `address`, never gated behind
 * EXPOSE_DECRYPTED_DATA, since this is the account holder reading their own data (same reasoning
 * documented on registerVolunteer's response and request.service.ts's createRequest). */
export async function getMyProfile(userId: string) {
  const volunteer = await findMyVolunteerProfile(userId);
  const user = await User.findById(userId).select("name phone email avatarUrl");
  const obj = volunteer.toObject();
  return {
    ...obj,
    address: obj.address ? decryptField(obj.address) : obj.address,
    name: user?.name,
    phone: user?.phone,
    email: user?.email,
    avatarUrl: user?.avatarUrl,
  };
}

export async function updateMyAvailability(userId: string, availability: VolunteerAvailability) {
  const volunteer = await findMyVolunteerProfile(userId);
  volunteer.availability = availability;
  await volunteer.save();
  return volunteer;
}

/** Enriches each assignment with a small Case summary (human-readable caseId, status, city,
 * priority) — the raw `caseId` field on VolunteerAssignment is just a Mongo ObjectId, useless for
 * a volunteer trying to tell one assignment apart from another at a glance. */
export async function listMyAssignments(userId: string) {
  const volunteer = await findMyVolunteerProfile(userId);
  const assignments = await VolunteerAssignment.find({ volunteerId: volunteer._id }).sort({ createdAt: -1 });

  const cases = await Case.find({ _id: { $in: assignments.map((a) => a.caseId) } }).select(
    "caseId status city priority scheduledAt"
  );
  const caseById = new Map(cases.map((c) => [c._id.toString(), c]));

  return assignments.map((a) => {
    const kase = caseById.get(a.caseId.toString());
    return {
      ...a.toObject(),
      case: kase
        ? { caseId: kase.caseId, status: kase.status, city: kase.city, priority: kase.priority, scheduledAt: kase.scheduledAt }
        : null,
    };
  });
}

/** A volunteer accepting/declining their own assignment — deliberately restricted to the
 * assignment's own volunteer (checked via the Volunteer profile owned by req.auth.userId, never
 * trusted from the client) and only while it's still in the ASSIGNED state. */
export async function respondToAssignment(userId: string, assignmentId: string, response: "ACCEPTED" | "DECLINED") {
  const volunteer = await findMyVolunteerProfile(userId);

  const assignment = await VolunteerAssignment.findOne({ _id: assignmentId, volunteerId: volunteer._id });
  if (!assignment) throw ApiError.notFound("Assignment not found");
  if (assignment.status !== "ASSIGNED") {
    throw ApiError.conflict("This assignment has already been responded to");
  }

  assignment.status = response;
  assignment.respondedAt = new Date();
  await assignment.save();

  if (response === "ACCEPTED") {
    volunteer.totalAssignments += 1;
    await volunteer.save();
  }

  return assignment;
}
