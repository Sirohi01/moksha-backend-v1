/**
 * Strips undefined-valued keys from a filter object before it reaches Mongoose's .find().
 *
 * The MongoDB Node driver does NOT treat `{ status: undefined }` as "no filter on status" — by
 * default it serializes `undefined` to BSON `null`, so the query becomes "status IS null" and
 * matches nothing. Every admin list endpoint builds its filter from optional query params
 * (`{ status: req.query.status }`, which is `undefined` when the param is omitted), so without
 * this the "view everything, no filters applied" case — the default view — silently returns zero
 * results. Caught by the M2/M3 end-to-end test.
 */
export function compactFilter<T extends object>(filter: T): Partial<T> {
  const result: Partial<T> = {};
  for (const key of Object.keys(filter) as (keyof T)[]) {
    if (filter[key] !== undefined) result[key] = filter[key];
  }
  return result;
}
