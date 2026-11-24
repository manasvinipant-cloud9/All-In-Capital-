// One small model call per page. The page is checked for relevance first (same-name, different-person pages are set aside in code),
// names are replaced with [F1], and every fact must carry a quote that appears on the page.
import { callModel } from "../gateway/index.ts";
import { redact } from "../gateway/guards.ts";
import { parseJson } from "../pipeline/json.ts";
import { validateClaim } from "../pipeline/validate.ts";
import type { Ctx } from "../pipeline/steps.ts";
import type { Tier } from "./rank.ts";
import type { Purpose } from "./plan.ts";

export type Fact = { id?: string; subject: string; type: string; claim: string; quote: string; url: string; tier: Tier; same_person: "yes" | "no" | "unclear"; matches: "match" | "conflict" | "unclear"; about_claim?: string };
type Raw = { subject?: string; type?: string; claim?: string; quote?: string; same_person?: string; matches_application?: string; application_claim?: string };
const lower = (s: string) => s.toLowerCase();

/** Returns a reason to set the page aside, or null if it is about the right company (and person). */
export function relevance(text: string, o: { company: string; sector: string; purpose: Purpose; subject: string }): string | null {
  const t = lower(text), company = lower(o.company);
  if (o.purpose === "company" || o.subject === o.company) return t.includes(company) ? null : "does not mention the company";
  const surname = lower(o.subject).split(/\s+/).filter(w => w.length >= 3).at(-1) ?? "";
  if (!surname || !t.includes(surname)) return "does not mention this founder";
  const field = lower(o.sector).split(/\s+/).filter(w => w.length >= 4);
  return t.includes(company) || field.some(w => t.includes(w)) ? null : "names a person like this founder but not the company or the field, so it may be a different person";
}
/** Windows of text around the mentions that matter, so a long page does not bury them. */
export function excerpt(text: string, keys: string[], max = 6000): string {
  const t = lower(text), spans: [number, number][] = [];
  for (const k of keys.map(lower).filter(k => k.length >= 3)) { let i = t.indexOf(k); let n = 0; while (i >= 0 && n < 3) { spans.push([Math.max(0, i - 1000), Math.min(text.length, i + 1000)]); i = t.indexOf(k, i + 2000); n++; } }
  if (!spans.length) return text.slice(0, max);
  spans.sort((a, b) => a[0] - b[0]); const merged: [number, number][] = [];
  for (const s of spans) { const l = merged.at(-1); if (l && s[0] <= l[1]) l[1] = Math.max(l[1], s[1]); else merged.push([...s]); }
  return merged.map(([a, b]) => text.slice(a, b)).join("\n...\n").slice(0, max);
}

export async function extractFacts(page: { url: string; text: string; tier: Tier; purpose: Purpose; subject: string }, o: { company: string; sector: string; founders: string[]; applicationClaims: string[]; ctx: Ctx }):
  Promise<{ facts: Fact[]; setAside?: string; dropped: string[] }> {
  const why = relevance(page.text, { company: o.company, sector: o.sector, purpose: page.purpose, subject: page.subject });
  if (why) return { facts: [], setAside: why, dropped: [] };
  const seen = redact(excerpt(page.text, [o.company, ...o.founders.map(f => f.split(/\s+/).at(-1) ?? f)]), o.founders).text;
  const said = o.applicationClaims.length ? o.applicationClaims.map(c => `- ${redact(c, o.founders).text}`).join("\n") : "- (nothing stated)";
  const user = `Company: ${o.company}. Sector: ${o.sector}.\nThe application says about the founders (written [F1], [F2]):\n${said}\n\nPAGE (${page.url}):\n${seen}`;
  const system = "You read one public web page. Using only the page text, extract facts about the company and the founders ([F1], [F2]): career, education, earlier startups, company facts, news, conflicts or controversies. "
    + "Return a JSON array of {subject, type, claim, quote, same_person, matches_application}. subject is the company name or [F1]/[F2]. type is career, education, prior_startup, company_info, news, conflict or controversy. "
    + "quote must be copied exactly from the page, at most 25 words. same_person is yes, no or unclear: say no if the page seems to be about a different person or company with a similar name. "
    + "matches_application compares the fact with the application statement it relates to most: match, conflict or unclear. application_claim is that statement copied exactly from the list above, or empty. Return [] if the page has nothing relevant.";
  const ask = async (extra = "") => parseJson<Raw[]>((await callModel({ step: "research_extract", application: o.ctx.application, system: system + extra, user }, { transport: o.ctx.transport, primary: o.ctx.primary, fallback: o.ctx.fallback })).text);
  const pages = [{ page: 1, text: seen }];
  const check = (xs: Raw[]) => xs.map(x => [x, typeof x.quote === "string" && typeof x.claim === "string" ? validateClaim({ metric: "fact", value: "", quote: x.quote, page: 1 }, pages) : "missing quote or claim"] as const);
  let raw = await ask(), res = check(raw);
  if (res.some(([, w]) => w)) { raw = await ask(` Previous output rejected: ${res.filter(([, w]) => w).map(([, w]) => w).join("; ")}`); res = check(raw); }
  const dropped: string[] = res.filter(([, w]) => w).map(([x, w]) => `${w}: ${String(x.claim ?? "").slice(0, 60)}`);
  const facts: Fact[] = [];
  for (const [x, w] of res) {
    if (w) continue;
    const same = (["yes", "no", "unclear"].includes(x.same_person ?? "") ? x.same_person : "unclear") as Fact["same_person"];
    if (same === "no") { dropped.push(`different person or company: ${String(x.claim).slice(0, 60)}`); continue; }
    facts.push({ subject: String(x.subject ?? o.company), type: String(x.type ?? "news"), claim: String(x.claim), quote: String(x.quote), url: page.url, tier: page.tier, same_person: same,
      matches: (["match", "conflict", "unclear"].includes(x.matches_application ?? "") ? x.matches_application : "unclear") as Fact["matches"], about_claim: typeof x.application_claim === "string" && x.application_claim.trim() ? x.application_claim.trim().slice(0, 200) : undefined });
  }
  return { facts, dropped };
}
