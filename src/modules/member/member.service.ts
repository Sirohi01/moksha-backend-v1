import { Types } from "mongoose";
import { decryptField, maybeDecrypt } from "../../lib/crypto";
import { IMember, Member, MemberStatus } from "../../models/member.model";
import { ApiError } from "../../utils/ApiError";

type MemberInput = Record<string, unknown>;

function duplicateError(error: unknown): never {
  if (error instanceof Error && "code" in error && error.code === 11000) {
    throw ApiError.conflict("A member with this mobile or email already exists for Namo Gange");
  }
  throw error;
}

function serialize(member: IMember) {
  const value = member.toObject() as Record<string, unknown>;
  for (const field of ["mobile", "alternateNo", "email", "address", "emergencyContact"]) {
    if (typeof value[field] === "string") value[field] = maybeDecrypt(value[field] as string);
  }
  delete value.aadharNo;
  delete value.aadharHash;
  delete value.mobileHash;
  delete value.emailHash;
  return value;
}

export async function createMember(organisationId: string, input: MemberInput) {
  try {
    const member = await Member.create({ ...input, organisationId, status: "PENDING" });
    return { id: member._id.toString(), status: member.status };
  } catch (error) { return duplicateError(error); }
}

export async function listMembers(organisationId: string, status?: MemberStatus) {
  const members = await Member.find({ organisationId, ...(status ? { status } : {}) }).sort({ createdAt: -1 });
  return members.map(serialize);
}

export async function getMember(organisationId: string, id: string) {
  if (!Types.ObjectId.isValid(id)) throw ApiError.notFound("Member not found");
  const member = await Member.findOne({ _id: id, organisationId }).select("+aadharNo");
  if (!member) throw ApiError.notFound("Member not found");
  const value = serialize(member);
  if (member.aadharNo) {
    const plain = decryptField(member.aadharNo);
    value.aadharMasked = `********${plain.slice(-4)}`;
  }
  return value;
}

export async function updateMember(organisationId: string, id: string, input: MemberInput) {
  if (!Types.ObjectId.isValid(id)) throw ApiError.notFound("Member not found");
  const member = await Member.findOne({ _id: id, organisationId }).select("+aadharNo");
  if (!member) throw ApiError.notFound("Member not found");
  member.set(input);
  try { await member.save(); } catch (error) { return duplicateError(error); }
  return getMember(organisationId, id);
}
