// Signed HMAC cookie sessions using Web Crypto, so the same code runs in middleware (edge) and routes (node).
export type Session = { email: string; role: "partner" | "associate"; exp: number };
export const COOKIE = "aic_session";
const enc = new TextEncoder();
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
const key = (secret: string) => crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);

export async function signSession(s: Session, secret: string): Promise<string> {
  const body = b64(enc.encode(JSON.stringify(s)));
  return `${body}.${b64(new Uint8Array(await crypto.subtle.sign("HMAC", await key(secret), enc.encode(body))))}`;
}
export async function verifySession(token: string | undefined, secret: string | undefined, now = Date.now()): Promise<Session | null> {
  if (!token || !secret || secret.length < 16) return null;
  const [body, sig] = token.split("."); if (!body || !sig) return null;
  try {
    if (!(await crypto.subtle.verify("HMAC", await key(secret), unb64(sig), enc.encode(body)))) return null;
    const s = JSON.parse(new TextDecoder().decode(unb64(body))) as Session;
    return s.exp > now ? s : null;
  } catch { return null; }
}
const list = (v?: string) => (v ?? "").split(",").map(x => x.trim().toLowerCase()).filter(Boolean);
/** Sign-in is limited to the allowlist: ALLOWED_EMAILS, PARTNER_EMAILS and MAILBOX_EMAIL. */
export function roleFor(email: string, env: Record<string, string | undefined> = process.env): "partner" | "associate" | null {
  const e = email.toLowerCase(), partners = list(env.PARTNER_EMAILS);
  if (partners.includes(e)) return "partner";
  return [...list(env.ALLOWED_EMAILS), ...list(env.MAILBOX_EMAIL)].includes(e) ? "associate" : null;
}
export const authRequired = (env: Record<string, string | undefined> = process.env) => env.NODE_ENV === "production" || env.REQUIRE_AUTH === "1";
