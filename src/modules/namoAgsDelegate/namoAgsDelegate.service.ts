import { Types } from "mongoose";
import { maybeDecrypt } from "../../lib/crypto";
import { writeAuditLog } from "../../lib/audit.service";
import {
  AgsClientStatus,
  AgsDelegateStatus,
  INamoAgsDelegate,
  NamoAgsDelegate,
} from "../../models/namoAgsDelegate.model";
import { ApiError } from "../../utils/ApiError";
import { compactFilter } from "../../utils/compactFilter";

type DelegateInput = Record<string, unknown>;

function serialize(delegate: INamoAgsDelegate) {
  const value = delegate.toObject() as Record<string, unknown>;
  for (const field of ["mobile", "alternate", "email", "address", "companyAddress"]) {
    if (typeof value[field] === "string") value[field] = maybeDecrypt(value[field] as string);
  }
  delete value.mobileHash;
  delete value.emailHash;
  return value;
}

export async function createDelegate(organisationId: string, input: DelegateInput, userId: string) {
  const delegate = await NamoAgsDelegate.create({ ...input, organisationId });
  await writeAuditLog({
    userId,
    action: "ags_delegate.created",
    entityType: "NamoAgsDelegate",
    entityId: delegate._id.toString(),
    after: { clientStatus: delegate.clientStatus, status: delegate.status },
  });
  return serialize(delegate);
}

export async function listDelegates(
  organisationId: string,
  filter: { status?: AgsDelegateStatus; clientStatus?: AgsClientStatus; search?: string }
) {
  const query: Record<string, unknown> = { organisationId, ...compactFilter({ status: filter.status, clientStatus: filter.clientStatus }) };
  // Search only covers plaintext fields — mobile/email/address are encrypted at rest (see the
  // model), so a database-side regex can't match them without decrypting every candidate row
  // first, which the Member module doesn't attempt either. Coordinators can still filter by
  // status/clientStatus precisely; free-text search is a "narrow down the visible list" aid, not
  // an exhaustive lookup, until a real search index is worth building.
  if (filter.search) {
    const re = new RegExp(filter.search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    query.$or = [{ firstName: re }, { lastName: re }, { companyName: re }, { coordinator: re }, { event: re }];
  }
  const delegates = await NamoAgsDelegate.find(query).sort({ createdAt: -1 });
  return delegates.map(serialize);
}

export async function getDelegate(organisationId: string, id: string) {
  if (!Types.ObjectId.isValid(id)) throw ApiError.notFound("Delegate not found");
  const delegate = await NamoAgsDelegate.findOne({ _id: id, organisationId });
  if (!delegate) throw ApiError.notFound("Delegate not found");
  return serialize(delegate);
}

export async function updateDelegate(organisationId: string, id: string, input: DelegateInput, userId: string) {
  if (!Types.ObjectId.isValid(id)) throw ApiError.notFound("Delegate not found");
  const delegate = await NamoAgsDelegate.findOne({ _id: id, organisationId });
  if (!delegate) throw ApiError.notFound("Delegate not found");

  const before = { clientStatus: delegate.clientStatus, status: delegate.status };
  delegate.set(input);
  await delegate.save();
  const after = { clientStatus: delegate.clientStatus, status: delegate.status };

  if (before.clientStatus !== after.clientStatus || before.status !== after.status) {
    await writeAuditLog({
      userId,
      action: "ags_delegate.status_changed",
      entityType: "NamoAgsDelegate",
      entityId: delegate._id.toString(),
      before,
      after,
    });
  }
  return serialize(delegate);
}

export async function deleteDelegate(organisationId: string, id: string, userId: string) {
  if (!Types.ObjectId.isValid(id)) throw ApiError.notFound("Delegate not found");
  const delegate = await NamoAgsDelegate.findOneAndDelete({ _id: id, organisationId });
  if (!delegate) throw ApiError.notFound("Delegate not found");
  await writeAuditLog({
    userId,
    action: "ags_delegate.deleted",
    entityType: "NamoAgsDelegate",
    entityId: delegate._id.toString(),
    before: { clientStatus: delegate.clientStatus, status: delegate.status },
  });
}
