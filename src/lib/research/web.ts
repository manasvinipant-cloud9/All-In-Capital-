// Search and page fetching. Public pages only: no logging in, no LinkedIn scraping, no private network addresses.
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export type Hit = { url: string; title: string; snippet: string };
export interface SearchPort { search(query: string): Promise<Hit[]> }
export type Fetched = { ok: true; text: string } | { ok: false; error: string };
export type FetchPort = (url: string) => Promise<Fetched>;

/** Web search through Brave. NOT TESTED against the live service: needs BRAVE_SEARCH_API_KEY. */
export function searchPort(env: Record<string, string | undefined> = process.env): SearchPort | null {
  const key = env.BRAVE_SEARCH_API_KEY; if (!key) return null;
  return { async search(query) {
    const r = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=6`, { headers: { "X-Subscription-Token": key, Accept: "application/json" }, signal: AbortSignal.timeout(10000) });
    if (!r.ok) throw new Error(`search ${r.status}`);
    const j = await r.json();
    return ((j.web?.results ?? []) as { url: string; title?: string; description?: string }[]).map(x => ({ url: x.url, title: x.title ?? "", snippet: (x.description ?? "").replace(/<[^>]+>/g, "") }));
  } };
}

// Sites that need a login or forbid scraping. A profile on one of these is linked for Riya to open, never fetched.
const NO_FETCH = ["linkedin.com", "facebook.com", "instagram.com", "x.com", "twitter.com", "whatsapp.com", "t.me", "youtube.com"];
const hostMatch = (h: string, d: string) => h === d || h.endsWith(`.${d}`);

export function isPrivateAddress(ip: string): boolean {
  if (ip.includes(":")) { const t = ip.toLowerCase(); return t === "::1" || t === "::" || t.startsWith("fc") || t.startsWith("fd") || t.startsWith("fe80") || t.startsWith("::ffff:") && isPrivateAddress(t.slice(7)); }
  const [a, b] = ip.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}
/** Synchronous checks on the URL itself. Returns a reason to refuse, or null. */
export function urlProblem(raw: string): string | null {
  let u: URL; try { u = new URL(raw); } catch { return "not a valid link"; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return "only http and https links are read";
  if (u.username || u.password) return "links with a password are not read";
  if (u.port && u.port !== "80" && u.port !== "443") return "unusual port";
  const h = u.hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");   // IPv6 hosts arrive in square brackets
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) return "local address";
  if (isIP(h) && isPrivateAddress(h)) return "private network address";
  if (NO_FETCH.some(d => hostMatch(h, d))) return "a login-only or no-scraping site: link it for a person to open";
  return null;
}
/** Also resolves the name, so a public-looking name that points at a private address is refused. */
export async function urlAllowed(raw: string): Promise<string | null> {
  const p = urlProblem(raw); if (p) return p;
  const h = new URL(raw).hostname.replace(/^\[|\]$/g, "");
  if (isIP(h)) return null;
  try { const all = await lookup(h, { all: true }); if (all.length === 0 || all.some(a => isPrivateAddress(a.address))) return "resolves to a private address"; } catch { return "could not look up the address"; }
  return null;
}

export function htmlToText(html: string): string {
  return html.replace(/<(script|style|noscript|svg|nav|footer|header|form|iframe)[\s\S]*?<\/\1>/gi, " ").replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|li|h[1-6]|br|tr)>/gi, "\n").replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&rsquo;|&lsquo;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/[ \t ]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
}

const MAX_BYTES = 600_000;
/** Reads one public page: guards on every redirect hop, a size cap and a timeout. */
export const webFetch: FetchPort = async url => {
  let cur = url;
  for (let hop = 0; hop < 4; hop++) {
    const why = await urlAllowed(cur); if (why) return { ok: false, error: `not read: ${why}` };
    let r: Response;
    try { r = await fetch(cur, { redirect: "manual", signal: AbortSignal.timeout(10000), headers: { "User-Agent": "AllInCapitalResearch/1.0 (public pages only)", Accept: "text/html,text/plain" } }); }
    catch { return { ok: false, error: "not read: the page did not respond" }; }
    if (r.status >= 300 && r.status < 400) { const loc = r.headers.get("location"); if (!loc) return { ok: false, error: "not read: bad redirect" }; cur = new URL(loc, cur).toString(); continue; }
    if (!r.ok) return { ok: false, error: `not read: status ${r.status}` };
    const type = r.headers.get("content-type") ?? ""; if (!/text\/(html|plain)|application\/xhtml/i.test(type)) return { ok: false, error: "not read: not a web page" };
    const reader = r.body?.getReader(); if (!reader) return { ok: false, error: "not read: empty" };
    const chunks: Uint8Array[] = []; let n = 0;
    for (;;) { const { done, value } = await reader.read(); if (done) break; n += value.length; chunks.push(value); if (n > MAX_BYTES) { await reader.cancel(); break; } }
    const raw = new TextDecoder("utf-8", { fatal: false }).decode(Buffer.concat(chunks));
    const text = /html/i.test(type) ? htmlToText(raw) : raw.replace(/\s+/g, " ").trim();
    return text.length < 80 ? { ok: false, error: "not read: almost no text" } : { ok: true, text };
  }
  return { ok: false, error: "not read: too many redirects" };
};
