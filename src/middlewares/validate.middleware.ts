import { NextFunction, Request, Response } from "express";
import { AnyZodObject, ZodError } from "zod";
import { ApiError } from "../utils/ApiError";

/**
 * Validates { body, params, query } together against one schema and replaces each part
 * with its parsed (typed, defaulted) value. Pass a schema shaped as
 * z.object({ body: ..., params: ..., query: ... }) — omit keys you don't need to validate.
 */
export function validate(schema: AnyZodObject) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const parsed = schema.parse({ body: req.body, params: req.params, query: req.query });
      if (parsed.body) req.body = parsed.body;
      if (parsed.params) req.params = parsed.params;
      if (parsed.query) req.query = parsed.query;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        next(ApiError.badRequest("Validation failed", err.errors));
        return;
      }
      next(err);
    }
  };
}
