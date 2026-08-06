import { AuditLog } from "../models/auditLog.model";

interface WriteAuditLogInput {
  userId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
}

/** Fire-and-forget audit trail write (BR-08). Never blocks or fails the caller's main operation —
 * an audit log write failing shouldn't stop, say, a case status transition from succeeding. */
export async function writeAuditLog(input: WriteAuditLogInput): Promise<void> {
  try {
    await AuditLog.create(input);
  } catch {
    // Deliberately swallowed — see comment above. A monitoring/alerting pass on audit-write
    // failures is a reasonable future addition, not a blocker for the action it's auditing.
  }
}
