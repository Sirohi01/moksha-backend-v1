import { AssistanceRequest, IAssistanceRequest } from "../../models/assistanceRequest.model";
import { ApiError } from "../../utils/ApiError";
import { decryptField, maybeDecrypt } from "../../lib/crypto";
import { generateRequestNo } from "../../lib/counter.service";
import { writeAuditLog } from "../../lib/audit.service";
import { notify } from "../../lib/notify.service";
import { AssistanceRequestStatus, RequestType, DUPLICATE_REQUEST_WINDOW_HOURS } from "../../utils/constants";
import { compactFilter } from "../../utils/compactFilter";
import { PaginationParams, buildMeta } from "../../utils/pagination";
function serializeRequest(request: IAssistanceRequest, reveal: (v: string) => string) {
  const obj = request.toObject();
  if (obj.requester.email) obj.requester.email = reveal(obj.requester.email);
  obj.deceased.name = reveal(obj.deceased.name);
  obj.location.address = reveal(obj.location.address);
  return obj;
}

interface CreateRequestInput {
  type: RequestType;
  requester: {
    name: string;
    phone: string;
    altPhone?: string;
    email?: string;
    relation: string;
  };
  deceased: {
    name: string;
    age?: number;
    gender?: string;
    dateOfDeath?: Date;
  };
  location: {
    address: string;
    area?: string;
    city: string;
    state: string;
    pincode: string;
  };
  cremationPreference?: "WOOD" | "ELECTRIC" | "AS_AVAILABLE";
  notes?: string;
  consent: {
    dataProcessing: boolean;
    publishStory: boolean;
  };
}

async function checkForDuplicate(
  phone: string,
  deceasedName: string
): Promise<{ duplicateOfRequestId?: string; duplicateNote?: string }> {
  const windowStart = new Date(Date.now() - DUPLICATE_REQUEST_WINDOW_HOURS * 60 * 60 * 1000);
  const recentSamePhone = await AssistanceRequest.find({
    "requester.phone": phone,
    createdAt: { $gte: windowStart },
  }).sort({ createdAt: -1 });

  if (recentSamePhone.length === 0) return {};

  const mostRecent = recentSamePhone[0];
  const sameName = decryptField(mostRecent.deceased.name).trim().toLowerCase() === deceasedName.trim().toLowerCase();

  return {
    duplicateOfRequestId: mostRecent._id.toString(),
    duplicateNote: sameName
      ? `Same phone and deceased name as request ${mostRecent.requestNo}, submitted ${mostRecent.createdAt.toISOString()}`
      : `Same phone as request ${mostRecent.requestNo} (different deceased name given), submitted ${mostRecent.createdAt.toISOString()}`,
  };
}
export async function createRequest(input: CreateRequestInput) {
  if (!input.consent.dataProcessing) {
    throw ApiError.badRequest("Consent to process this information is required to submit a request");
  }

  const requestNo = await generateRequestNo();
  const duplicate = await checkForDuplicate(input.requester.phone, input.deceased.name);
  const request = await AssistanceRequest.create({ ...input, requestNo, source: "WEBSITE", ...duplicate });

  await writeAuditLog({
    action: "request.created",
    entityType: "AssistanceRequest",
    entityId: request._id.toString(),
  });
  if (input.requester.email) {
    await notify(
      "request.received",
      { email: input.requester.email },
      { name: input.requester.name, requestNo }
    );
  }

  return serializeRequest(request, decryptField);
}

export async function listRequestsForAdmin(
  filter: { status?: AssistanceRequestStatus; type?: RequestType },
  pagination?: PaginationParams
) {
  const mongoFilter = compactFilter(filter);
  const query = AssistanceRequest.find(mongoFilter).sort({ createdAt: -1 });
  if (pagination?.requested) query.skip(pagination.skip).limit(pagination.limit);

  const [docs, total] = await Promise.all([
    query,
    pagination?.requested ? AssistanceRequest.countDocuments(mongoFilter) : Promise.resolve(undefined),
  ]);
  // Admin viewing other people's PII — gated by the EXPOSE_DECRYPTED_DATA toggle.
  const requests = docs.map((request) => serializeRequest(request, maybeDecrypt));
  const meta = pagination?.requested ? buildMeta(pagination.page, pagination.limit, total!) : undefined;
  return { requests, meta };
}

export async function getRequestForAdmin(id: string) {
  const request = await AssistanceRequest.findById(id);
  if (!request) throw ApiError.notFound("Request not found");
  return serializeRequest(request, maybeDecrypt);
}

export async function findRequestDocById(id: string): Promise<IAssistanceRequest> {
  const request = await AssistanceRequest.findById(id);
  if (!request) throw ApiError.notFound("Request not found");
  return request;
}

export async function updateRequest(id: string, updates: Partial<CreateRequestInput>) {
  const request = await AssistanceRequest.findById(id);
  if (!request) throw ApiError.notFound("Request not found");
  if (request.status !== "SUBMITTED") {
    throw ApiError.conflict("Only a request that hasn't been converted or rejected can be edited");
  }

  Object.assign(request, updates);
  await request.save();

  return serializeRequest(request, maybeDecrypt);
}

export async function rejectRequest(id: string, userId: string) {
  const request = await AssistanceRequest.findById(id);
  if (!request) throw ApiError.notFound("Request not found");
  if (request.status !== "SUBMITTED") {
    throw ApiError.conflict("Only a submitted request can be rejected");
  }

  request.status = "REJECTED";
  await request.save();

  await writeAuditLog({
    userId,
    action: "request.rejected",
    entityType: "AssistanceRequest",
    entityId: request._id.toString(),
  });

  return serializeRequest(request, maybeDecrypt);
}
