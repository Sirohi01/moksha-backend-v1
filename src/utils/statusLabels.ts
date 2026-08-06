import { CaseStatus } from "./constants";

/** Family-facing wording for each Case status — used only in outbound notifications (email/
 * WhatsApp copy). Kept separate from the internal enum so the family never sees a raw status
 * code like "CREMATION_IN_PROGRESS" in a message. */
export const CASE_STATUS_LABELS: Record<CaseStatus, string> = {
  NEW: "Request Received",
  UNDER_VERIFICATION: "Verifying Details",
  APPROVED: "Approved — Arranging Support",
  VOLUNTEER_ASSIGNED: "Volunteer Assigned",
  TRANSPORT_ARRANGED: "Transport Arranged",
  CREMATION_IN_PROGRESS: "Cremation In Progress",
  CREMATION_COMPLETED: "Cremation Completed",
  DOCS_UPLOADED: "Documents Uploaded",
  CLOSED: "Case Closed",
  REJECTED: "Request Could Not Be Approved",
  CANCELLED: "Request Cancelled",
};
