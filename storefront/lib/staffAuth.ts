import "server-only";

/** Optional PIN for staff endpoints. If STAFF_PIN is unset, staff routes are open (demo mode). */
export function staffAuthorised(req: Request): boolean {
  const pin = process.env.STAFF_PIN;
  if (!pin) return true;
  return req.headers.get("x-staff-pin") === pin;
}
