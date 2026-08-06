import { AuditLog } from "../../models/auditLog.model";
import { User } from "../../models/user.model";
import { compactFilter } from "../../utils/compactFilter";
import { buildMeta } from "../../utils/pagination";

interface ListAuditLogsFilter {
  entityType?: string;
  action?: string;
  userId?: string;
  from?: Date;
  to?: Date;
  limit: number;
  page?: number;
}

/** Read-only, admin-facing view over the write-only AuditLog collection (BR-08 — nothing here
 * ever updates or deletes an entry, only lists them). Resolves each entry's actor name for
 * display; entries with no userId (system/webhook-triggered actions) show as "System". `limit`
 * has always bounded the page size (default 200); `page` is new and optional — omitting it keeps
 * today's behavior (the most recent `limit` entries, no meta), matching every existing caller. */
export async function listAuditLogs(filter: ListAuditLogsFilter) {
  const query = compactFilter({
    entityType: filter.entityType,
    action: filter.action,
    userId: filter.userId,
  }) as Record<string, unknown>;

  if (filter.from || filter.to) {
    query.at = compactFilter({ $gte: filter.from, $lte: filter.to });
  }

  const mongoQuery = AuditLog.find(query).sort({ at: -1 }).limit(filter.limit);
  if (filter.page) mongoQuery.skip((filter.page - 1) * filter.limit);

  const [docs, total] = await Promise.all([mongoQuery, filter.page ? AuditLog.countDocuments(query) : Promise.resolve(undefined)]);

  const userIds = [...new Set(docs.map((l) => l.userId?.toString()).filter(Boolean))];
  const users = await User.find({ _id: { $in: userIds } }).select("name email");
  const userById = new Map(users.map((u) => [u._id.toString(), u]));

  const logs = docs.map((log) => {
    const actor = log.userId ? userById.get(log.userId.toString()) : undefined;
    return { ...log.toObject(), actorName: actor?.name ?? "System" };
  });
  const meta = filter.page ? buildMeta(filter.page, filter.limit, total!) : undefined;
  return { logs, meta };
}

export async function listAuditActionTypes(): Promise<string[]> {
  return AuditLog.distinct("action");
}

export async function listAuditEntityTypes(): Promise<string[]> {
  return AuditLog.distinct("entityType");
}
