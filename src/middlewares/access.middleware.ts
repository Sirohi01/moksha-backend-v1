import { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/ApiError";
import { asyncHandler } from "../utils/asyncHandler";
import { AccessGrant } from "../models/accessGrant.model";
import { Organisation } from "../models/organisation.model";
import { resolvePermissionsForRoleId } from "../lib/permissions.service";

/** Attached by authorizeScoped() once a grant has been resolved, so the controller/service can
 * scope its own queries (e.g. `Delegate.find({ organisationId: req.scope.organisationId })`)
 * without re-deriving it. Never trust an organisation/project value supplied directly in the
 * request body/query for anything security-relevant — this is the one place it's resolved. */
export interface ScopeContext {
  organisationId: string;
  organisationCode: string;
  programCode?: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      scope?: ScopeContext;
    }
  }
}

type ScopeResolver = (req: Request) => string | undefined;

interface AuthorizeScopedOptions {
  /** module.action key, same convention as the existing authorize(). */
  permission: string;
  /** An Organisation code, either fixed for the whole route (e.g. "NAMOGANGE") or derived from
   * the request — e.g. by loading the business record the route acts on and reading ITS
   * organisationId, never by trusting a client-supplied field. Required. */
  organisation: string | ScopeResolver;
  /** A Project programCode. Omit entirely for organisation-level (non-project) modules — do not
   * pass a resolver that can return undefined for a route that's supposed to be project-scoped. */
  project?: string | ScopeResolver;
}

/**
 * Namo Gange Unified Platform — organisation/project-aware authorization, additive alongside the
 * existing permission-key `authorize()` in auth.middleware.ts (which is untouched and keeps
 * working exactly as before for Moksha's own non-project-scoped modules).
 *
 * Resolution order, ALL required, default deny:
 *   1. requireAuth must have already run (needs req.auth) — mount this after requireAuth, same as
 *      the existing authorize().
 *   2. Resolve the target Organisation by code. Unknown/inactive organisation -> 403.
 *   3. If the route declares a project, resolve the target programCode. Missing -> 403.
 *   4. Load the user's ACTIVE, non-expired AccessGrants. Require at least one grant whose
 *      organisationId is null (= all organisations, Super Admin) OR matches the resolved
 *      organisation, AND whose programCode is null (= all projects in that organisation) OR
 *      matches the resolved project (only checked when the route declares one) — AND whose
 *      granted Role actually carries the requested permission key.
 *   5. No matching grant -> 403, REGARDLESS of what the user's own primary Role/permissions
 *      (req.auth.permissions, from auth.middleware.ts) would otherwise allow. A Moksha staffer's
 *      own role must never implicitly grant Namo Gange/Arogya access — that's the entire point of
 *      keeping this separate from the existing authorize().
 *
 * A route that mounts neither authorize() nor authorizeScoped() is unprotected by definition —
 * there is no implicit/default-allow path here for that case either.
 */
export function authorizeScoped(options: AuthorizeScopedOptions) {
  return asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) return next(ApiError.forbidden("You do not have permission to perform this action"));
    if (req.auth.twoFactorPending) {
      return next(ApiError.forbidden("Two-factor authentication setup is required before you can continue"));
    }

    const organisationCode =
      typeof options.organisation === "function" ? options.organisation(req) : options.organisation;
    if (!organisationCode) {
      return next(ApiError.forbidden("Unable to resolve an organisation for this request"));
    }

    const organisation = await Organisation.findOne({
      code: organisationCode.toUpperCase(),
      status: "ACTIVE",
    });
    if (!organisation) {
      return next(ApiError.forbidden("Unknown or inactive organisation"));
    }

    let programCode: string | undefined;
    if (options.project) {
      const resolved = typeof options.project === "function" ? options.project(req) : options.project;
      if (!resolved) return next(ApiError.forbidden("Unable to resolve a project for this request"));
      programCode = resolved.toUpperCase();
    }

    const now = new Date();
    const candidateGrants = await AccessGrant.find({
      userId: req.auth.userId,
      status: "ACTIVE",
      $and: [
        { $or: [{ organisationId: null }, { organisationId: organisation._id }] },
        { $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gt: now } }] },
      ],
    });

    const scopedGrants = candidateGrants.filter(
      (grant) => !programCode || grant.programCode === null || grant.programCode === programCode
    );

    for (const grant of scopedGrants) {
      const { permissions } = await resolvePermissionsForRoleId(grant.roleId);
      if (permissions.includes(options.permission)) {
        req.scope = {
          organisationId: organisation._id.toString(),
          organisationCode: organisation.code,
          programCode,
        };
        return next();
      }
    }

    return next(ApiError.forbidden("You do not have permission to perform this action"));
  });
}
