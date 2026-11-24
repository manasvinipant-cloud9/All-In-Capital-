import { cookies } from "next/headers";
import { authRequired, COOKIE, verifySession, type Session } from "./session.ts";
export async function currentSession(): Promise<Session | null> {
  try { return await verifySession((await cookies()).get(COOKIE)?.value, process.env.SESSION_SECRET); } catch { return null; }   // no request scope (scripts, tests): no session
}
/** Partner-only actions. When sign-in is not enforced (local development) everything is allowed. */
export async function requirePartner(): Promise<Response | null> {
  if (!authRequired()) return null;
  const s = await currentSession();
  return s?.role === "partner" ? null : Response.json({ error: "partner_only" }, { status: 403 });
}
