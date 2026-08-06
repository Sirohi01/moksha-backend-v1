import { z } from "zod";
import {
  CASE_STATUSES,
  CASE_PRIORITIES,
  VERIFICATION_STATUSES,
  DOCUMENT_TYPES,
  PAYMENT_MODES,
  ASSIGNMENT_ROLES,
} from "../../utils/constants";
import { zBoolean, paginationQueryShape } from "../../utils/zodHelpers";

const idParam = z.object({ id: z.string().trim().min(1) });

export const convertRequestSchema = z.object({
  params: idParam,
  body: z.object({
    priority: z.enum(CASE_PRIORITIES).optional(),
  }),
});

export const listCasesQuerySchema = z.object({
  query: z
    .object({
      status: z.enum(CASE_STATUSES).optional(),
      city: z.string().trim().optional(),
      priority: z.enum(CASE_PRIORITIES).optional(),
    })
    .merge(paginationQueryShape),
});

export const transitionStatusSchema = z.object({
  params: idParam,
  body: z.object({
    toStatus: z.enum(CASE_STATUSES),
    note: z.string().trim().max(1000).optional(),
  }),
});

export const verifyCaseSchema = z.object({
  params: idParam,
  body: z.object({
    outcome: z.enum(VERIFICATION_STATUSES),
    method: z.enum(["CALL", "FIELD_VISIT", "DOCUMENT", "VERBAL_PENDING_DOCS"]),
    note: z.string().trim().min(2, "A verification note is required"),
  }),
});

export const assignVolunteerSchema = z.object({
  params: idParam,
  body: z.object({
    volunteerId: z.string().trim().min(1, "volunteerId is required"),
    role: z.enum(ASSIGNMENT_ROLES).default("PRIMARY"),
    note: z.string().trim().max(500).optional(),
  }),
});

export const assignCaseManagerSchema = z.object({
  params: idParam,
  body: z.object({
    caseManagerId: z.string().trim().min(1, "caseManagerId is required"),
  }),
});

export const addDocumentSchema = z.object({
  params: idParam,
  body: z.object({
    docType: z.enum(DOCUMENT_TYPES),
    isProof: zBoolean(false),
  }),
});

export const addExpenseSchema = z.object({
  params: idParam,
  body: z.object({
    categoryId: z.string().trim().min(1, "Category is required"),
    amount: z.coerce.number().positive("Amount must be greater than zero"),
    expenseDate: z.coerce.date(),
    paymentMode: z.enum(PAYMENT_MODES),
    payeeName: z.string().trim().optional(),
    referenceNo: z.string().trim().optional(),
  }),
});

export const cancelCaseSchema = z.object({
  params: idParam,
  body: z.object({
    reason: z.string().trim().min(3, "A cancellation reason is required"),
  }),
});

export const withdrawAssignmentSchema = z.object({
  params: z.object({ id: z.string().trim().min(1), assignmentId: z.string().trim().min(1) }),
  body: z.object({
    reason: z.string().trim().max(500).optional(),
  }),
});

export const decideExpenseSchema = z.object({
  params: z.object({ id: z.string().trim().min(1), expenseId: z.string().trim().min(1) }),
  body: z.object({
    decision: z.enum(["APPROVED", "REJECTED"]),
    remark: z.string().trim().max(1000).optional(),
  }),
});

export const trackCaseSchema = z.object({
  query: z.object({
    caseId: z.string().trim().min(1, "Case ID is required"),
    phone: z.string().trim().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number"),
  }),
});
