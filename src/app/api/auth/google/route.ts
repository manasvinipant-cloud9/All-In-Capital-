import { NextRequest, NextResponse } from "next/server";
export async function GET(req: NextRequest) {
  const id = process.env.GOOGLE_CLIENT_ID;
  if (!id || !process.env.GOOGLE_CLIENT_SECRET || !process.env.SESSION_SECRET) return NextResponse.redirect(new URL("/login?error=config", req.url));
  const state = crypto.randomUUID();
  const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  u.search = new URLSearchParams({ client_id: id, redirect_uri: `${req.nextUrl.origin}/api/auth/callback`, response_type: "code", scope: "openid email", state, prompt: "select_account" }).toString();
  const res = NextResponse.redirect(u); res.cookies.set("aic_state", state, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 600, path: "/" });
  return res;
}
