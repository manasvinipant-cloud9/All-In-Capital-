import { NextRequest, NextResponse } from "next/server";
import { COOKIE, roleFor, signSession } from "../../../../lib/session";
const back = (req: NextRequest, e: string) => NextResponse.redirect(new URL(`/login?error=${e}`, req.url));
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code"), state = req.nextUrl.searchParams.get("state");
  if (!code || !state || state !== req.cookies.get("aic_state")?.value) return back(req, "failed");
  const t = await fetch("https://oauth2.googleapis.com/token", { method: "POST", body: new URLSearchParams({ code, client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, redirect_uri: `${req.nextUrl.origin}/api/auth/callback`, grant_type: "authorization_code" }) });
  if (!t.ok) return back(req, "failed");
  const u = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${(await t.json()).access_token}` } });
  const info = u.ok ? await u.json() : null;
  if (!info?.email || info.email_verified === false) return back(req, "failed");
  const role = roleFor(info.email); if (!role) return back(req, "not_allowed");
  const res = NextResponse.redirect(new URL("/", req.url));
  res.cookies.set(COOKIE, await signSession({ email: info.email.toLowerCase(), role, exp: Date.now() + 7 * 86400000 }, process.env.SESSION_SECRET!), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 7 * 86400, path: "/" });
  res.cookies.delete("aic_state"); return res;
}
