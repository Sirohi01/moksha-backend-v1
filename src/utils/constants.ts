export const USER_ROLES = ["customer"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const ADMIN_ROLES = ["superadmin", "manager", "staff"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export const SERVICE_CATEGORIES = [
  "ambulance",
  "pandit",
  "funeral-services",
  "funeral-decoration",
  "har-sevan",
  "prayer-hall",
  "calling-relatives",
  "special-services",
] as const;
export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];

export const BOOKING_STATUSES = [
  "pending",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const PAYMENT_STATUSES = ["unpaid", "paid", "refunded"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_GATEWAY_STATUSES = ["created", "paid", "failed", "refunded"] as const;
export type PaymentGatewayStatus = (typeof PAYMENT_GATEWAY_STATUSES)[number];

export const ENQUIRY_STATUSES = ["new", "contacted", "closed"] as const;
export type EnquiryStatus = (typeof ENQUIRY_STATUSES)[number];

export const DONATION_CAUSES = ["general", "cremation", "ambulance", "annadan"] as const;
export type DonationCause = (typeof DONATION_CAUSES)[number];

export const DONATION_FREQUENCIES = ["once", "monthly"] as const;
export type DonationFrequency = (typeof DONATION_FREQUENCIES)[number];

// ============================================================================
// PRD domain (Moksha Sewa — free cremation assistance NGO platform).
// Added alongside the existing paid-booking enums above during the rearchitect
// to the PRD's case/volunteer/donation model; the old enums are migrated off
// module by module rather than deleted in one pass. See §C.1 of the PRD.
// ============================================================================

export const CASE_STATUSES = [
  "NEW",
  "UNDER_VERIFICATION",
  "APPROVED",
  "VOLUNTEER_ASSIGNED",
  "TRANSPORT_ARRANGED",
  "CREMATION_IN_PROGRESS",
  "CREMATION_COMPLETED",
  "DOCS_UPLOADED",
  "CLOSED",
  "REJECTED",
  "CANCELLED",
] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

/** PRD §8.3 — the only legal next states from each case status. Enforced by the
 * transition endpoint, not by the schema itself (Mongoose can't express this). */
export const CASE_STATUS_TRANSITIONS: Record<CaseStatus, CaseStatus[]> = {
  NEW: ["UNDER_VERIFICATION", "CANCELLED"],
  UNDER_VERIFICATION: ["APPROVED", "REJECTED", "CANCELLED"],
  APPROVED: ["VOLUNTEER_ASSIGNED", "CANCELLED"],
  VOLUNTEER_ASSIGNED: ["TRANSPORT_ARRANGED", "CANCELLED"],
  TRANSPORT_ARRANGED: ["CREMATION_IN_PROGRESS", "CANCELLED"],
  // Once cremation is actually underway, "cancel" no longer makes real-world sense — the only
  // way forward from here is completion.
  CREMATION_IN_PROGRESS: ["CREMATION_COMPLETED"],
  CREMATION_COMPLETED: ["DOCS_UPLOADED"],
  DOCS_UPLOADED: ["CLOSED"],
  CLOSED: [],
  REJECTED: [],
  CANCELLED: [],
};

// PRD BR — SLA thresholds for the admin breach sweep (case.service.ts's listSlaBreaches). Named
// constants so operations can tune response-time expectations without hunting through query logic.
export const SLA_NEW_CASE_RESPONSE_HOURS = 2; // NEW must move to UNDER_VERIFICATION within this window
export const SLA_CRITICAL_CASE_OPEN_HOURS = 24; // CRITICAL priority cases open longer than this breach
export const SLA_EXECUTION_STALL_HOURS = 12; // TRANSPORT_ARRANGED/CREMATION_IN_PROGRESS stuck this long

// PRD BR — a second AssistanceRequest from the same phone within this window gets flagged (not
// blocked) as a possible duplicate, for a Case Manager to review during verification.
export const DUPLICATE_REQUEST_WINDOW_HOURS = 48;

export const CASE_PRIORITIES = ["LOW", "NORMAL", "HIGH", "CRITICAL"] as const;
export type CasePriority = (typeof CASE_PRIORITIES)[number];

export const REQUEST_TYPES = ["NORMAL", "EMERGENCY"] as const;
export type RequestType = (typeof REQUEST_TYPES)[number];

export const REQUEST_SOURCES = ["WEBSITE", "HELPLINE", "PARTNER", "WALK_IN"] as const;
export type RequestSource = (typeof REQUEST_SOURCES)[number];

export const ASSISTANCE_REQUEST_STATUSES = ["SUBMITTED", "CONVERTED", "REJECTED"] as const;
export type AssistanceRequestStatus = (typeof ASSISTANCE_REQUEST_STATUSES)[number];

export const DOCUMENT_TYPES = [
  "DEATH_CERTIFICATE",
  "ID_PROOF",
  "ADDRESS_PROOF",
  "CREMATION_PROOF",
  "CONSENT_FORM",
  "BILL",
  "OTHER",
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const EXPENSE_STATUSES = ["SUBMITTED", "APPROVED", "REJECTED", "REVERSED"] as const;
export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number];

export const VOLUNTEER_STATUSES = ["ACTIVE", "INACTIVE", "BLACKLISTED"] as const;
export type VolunteerStatus = (typeof VOLUNTEER_STATUSES)[number];

export const VOLUNTEER_AVAILABILITY = ["AVAILABLE", "BUSY", "UNAVAILABLE"] as const;
export type VolunteerAvailability = (typeof VOLUNTEER_AVAILABILITY)[number];

// Registration-intake fields (the volunteer form's own "Availability"/"Preferred Role" dropdowns)
// — deliberately separate from VOLUNTEER_AVAILABILITY above, which is the real-time
// AVAILABLE/BUSY/UNAVAILABLE status a volunteer toggles once active. These are stated
// preferences captured once at signup, not an operational status.
export const VOLUNTEER_GENDERS = ["Male", "Female", "Other"] as const;
export type VolunteerGender = (typeof VOLUNTEER_GENDERS)[number];

export const VOLUNTEER_BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;
export type VolunteerBloodGroup = (typeof VOLUNTEER_BLOOD_GROUPS)[number];

export const VOLUNTEER_SCHEDULE_PREFERENCES = ["Weekdays", "Weekends", "Evenings", "Emergency Support", "Flexible"] as const;
export type VolunteerSchedulePreference = (typeof VOLUNTEER_SCHEDULE_PREFERENCES)[number];

export const VOLUNTEER_PREFERRED_ROLES = [
  "Field Volunteer",
  "Transport Support",
  "Documentation",
  "Family Coordination",
  "Ritual Assistance",
] as const;
export type VolunteerPreferredRole = (typeof VOLUNTEER_PREFERRED_ROLES)[number];

export const VERIFICATION_STATUSES = ["PENDING", "VERIFIED", "REJECTED"] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const ASSIGNMENT_STATUSES = [
  "ASSIGNED",
  "ACCEPTED",
  "DECLINED",
  "COMPLETED",
  "WITHDRAWN",
] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

export const ASSIGNMENT_ROLES = ["PRIMARY", "SUPPORT", "DRIVER"] as const;
export type AssignmentRole = (typeof ASSIGNMENT_ROLES)[number];

// PRD BR — assignments still counting against a volunteer's active caseload / a case's active
// PRIMARY slot. DECLINED/COMPLETED/WITHDRAWN have freed up that capacity.
export const ACTIVE_ASSIGNMENT_STATUSES: AssignmentStatus[] = ["ASSIGNED", "ACCEPTED"];

// PRD BR — a volunteer cannot be actively assigned to more than this many cases at once.
export const MAX_ACTIVE_CASES_PER_VOLUNTEER = 3;

export const NEW_DONATION_STATUSES = ["PENDING", "SUCCESS", "FAILED", "REFUNDED", "CANCELLED"] as const;
export type NewDonationStatus = (typeof NEW_DONATION_STATUSES)[number];

export const NEW_DONATION_TYPES = ["ONE_TIME", "RECURRING", "OFFLINE"] as const;
export type NewDonationType = (typeof NEW_DONATION_TYPES)[number];

export const PAYMENT_MODES = [
  "UPI",
  "CARD",
  "NETBANKING",
  "WALLET",
  "CASH",
  "CHEQUE",
  "BANK_TRANSFER",
] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];

export const SUBSCRIPTION_STATUSES = [
  "PENDING",
  "ACTIVE",
  "PAUSED",
  "CANCELLED",
  "COMPLETED",
  "HALTED",
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const RECEIPT_STATUSES = ["ISSUED", "VOID", "REISSUED"] as const;
export type ReceiptStatus = (typeof RECEIPT_STATUSES)[number];

export const CAMPAIGN_STATUSES = ["DRAFT", "ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const CONTENT_STATUSES = ["DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED"] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

export const NOTIFICATION_STATUSES = [
  "QUEUED",
  "SENT",
  "DELIVERED",
  "READ",
  "FAILED",
  "INVALID",
] as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];

export const NOTIFICATION_CHANNELS = ["WHATSAPP", "EMAIL", "BOTH"] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const NOTIFICATION_CATEGORIES = ["TRANSACTIONAL", "MARKETING"] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export const NEW_USER_STATUSES = ["ACTIVE", "INACTIVE", "LOCKED"] as const;
export type NewUserStatus = (typeof NEW_USER_STATUSES)[number];

/** Which panel/app a user account may authenticate into. */
export const USER_TYPES = ["INTERNAL", "VOLUNTEER", "DONOR"] as const;
export type UserType = (typeof USER_TYPES)[number];

export const ROLE_SCOPES = ["GLOBAL", "CITY"] as const;
export type RoleScope = (typeof ROLE_SCOPES)[number];

export const PERMISSION_ACTIONS = [
  "create",
  "read",
  "update",
  "delete",
  "approve",
  "export",
  "assign",
] as const;
export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

export const PERMISSION_SCOPE_QUALIFIERS = ["ALL", "OWN"] as const;
export type PermissionScopeQualifier = (typeof PERMISSION_SCOPE_QUALIFIERS)[number];

export const PARTNER_TYPES = [
  "NGO",
  "HOSPITAL",
  "MUNICIPAL",
  "CORPORATE_CSR",
  "CREMATION_GROUND",
  "OTHER",
] as const;
export type PartnerType = (typeof PARTNER_TYPES)[number];

export const PARTNER_STATUSES = ["LEAD", "ACTIVE", "EXPIRED", "INACTIVE"] as const;
export type PartnerStatus = (typeof PARTNER_STATUSES)[number];

// Logistics masters (PRD §11.4) — cremation grounds are tracked as a Partner (PARTNER_TYPES
// already has CREMATION_GROUND) rather than a fourth, overlapping collection here.
export const VEHICLE_TYPES = ["HEARSE", "AMBULANCE", "VAN", "OTHER"] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

export const SERVICE_PROVIDER_CATEGORIES = ["PRIEST", "CATERING", "AMBULANCE_SERVICE", "FLORIST", "OTHER"] as const;
export type ServiceProviderCategory = (typeof SERVICE_PROVIDER_CATEGORIES)[number];

// In-app admin notifications (the Topbar bell) — distinct from NOTIFICATION_* above, which is the
// outbound email system (notify.service.ts) for donors/families/volunteers. This is the internal
// "something happened, staff should know" feed: new donation, new enquiry, new request, a
// volunteer's availability changing.
export const ADMIN_NOTIFICATION_TYPES = ["DONATION", "ENQUIRY", "CASE", "VOLUNTEER"] as const;
export type AdminNotificationType = (typeof ADMIN_NOTIFICATION_TYPES)[number];
