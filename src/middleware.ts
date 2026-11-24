import { NextRequest, NextResponse } from "next/server";
import { authRequired, COOKIE, verifySession } from "./lib/session";

// Production requires sign-in everywhere except the login page, the OAuth routes and the cron routes (which check their own secret).
const OPEN = [/^\/login$/, /^\/api\/auth\//, /^\/api\/cron\//];
export async function middleware(req: NextRequest) {
  if (!authRequired()) return NextResponse.next();
  const p = req.nextUrl.pathname;
  if (OPEN.some(r => r.test(p))) return NextResponse.next();
  const s = await verifySession(req.cookies.get(COOKIE)?.value, process.env.SESSION_SECRET);
  if (s) return NextResponse.next();
  if (p.startsWith("/api/")) return NextResponse.json({ error: "sign_in_required" }, { status: 401 });
  return NextResponse.redirect(new URL("/login", req.url));
}
export const config = { matcher: ["/((?!_next/|favicon.ico).*)"] };
