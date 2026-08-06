/** PRD §11.1/§23.4 — every money field is stored and summed as an integer number of paise
 * (never a float rupee amount), so repeated addition/aggregation across donations, campaign
 * totals, and expense sums can never accumulate floating-point drift. Rupees are only ever a
 * display/input concept, converted at the two edges: toPaise() when a rupee amount from a
 * request body is about to be persisted, toRupees() when a stored paise amount is about to leave
 * the service layer in an API response. Nothing in between ever touches a rupee value. */

export function toPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

export function toRupees(paise: number): number {
  return Math.round(paise) / 100;
}
