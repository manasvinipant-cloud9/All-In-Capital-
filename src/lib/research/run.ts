// The research step. For each application: plan queries in code, search, rank sources, read a few pages, extract quoted facts, label them.
// Every query is logged, including empty ones. Nothing here logs in to a site or scrapes LinkedIn: profiles are only linked for Riya to open.
import { foundersOf } from "../pipeline/score.ts";
import type { Ctx } from "../pipeline/steps.ts";
import type { Page } from "../pipeline/ingest.ts";
import { extractFacts, type Fact } from "./extract.ts";
import { buildQueries, type Query } from "./plan.ts";
import { rankHits, type Tier } from "./rank.ts";
import { saveResearch, type PageLog, type Research } from "./store.ts";
import { conflictsOf, verifyClaims } from "./verify.ts";
import { urlProblem, type FetchPort, type Hit, type SearchPort } from "./web.ts";

export const MAX_PAGES = 8;
export type App = { slug: string; company: string; sector: string; form: Record<string, string>; deck: Page[] };
export type Deps = { search: SearchPort | null; fetch: FetchPort; ctx: Omit<Ctx, "founders" | "application"> | null; now?: Date };

/** What the application says about the founders, as short statements to check. */
export function backgroundClaims(form: Record<string, string>, deck: Page[], founders: string[]): string[] {
  const out: string[] = [], bg = form["Founder background"];
  if (bg) out.push(...bg.split(/[.;]\s*|,\s+(?=[A-Z])/).map(s => s.trim()).filter(s => s.length >= 6));
  const text = deck.map(p => p.text).join(" ");
  for (const f of founders) { const m = text.match(new RegExp(`${f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")},? (?:CEO|CTO|COO|CFO|Co-?founder)[,.]?\\s*([^.]+)`)); if (m) out.push(m[1].trim()); }
  for (const s of text.split(/(?<=\.)\s+/)) if (/\b(ex-|formerly|previously|MBA|IIT|IIM|PhD|alumn)/i.test(s)) out.push(...s.trim().replace(/\.$/, "").split(/,\s*(?=(?:Ex-|MBA|IIT|IIM|PhD|formerly|previously))/i));   // "Ex-A, Ex-B, MBA C" becomes three statements
  return [...new Set(out)].filter(s => s.length >= 6).slice(0, 10);
}
export function profileLinks(form: Record<string, string>, founders: string[], company: string) {
  const links: { label: string; url: string }[] = [];
  if (/^https:\/\/([a-z]{2,3}\.)?linkedin\.com\//i.test(form.LinkedIn ?? "")) links.push({ label: "LinkedIn profile from the form", url: form.LinkedIn });
  for (const f of founders) links.push({ label: `Search LinkedIn for ${f}`, url: `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`${f} ${company}`)}` });
  return links;
}

export async function researchApplication(a: App, d: Deps): Promise<Research> {
  const founders = foundersOf(a.form, a.deck).slice(0, 3), claims = backgroundClaims(a.form, a.deck, founders);
  const base = { slug: a.slug, founders, searchedAt: (d.now ?? new Date()).toISOString(), queries: [], pages: [], facts: [], conflicts: [], profileLinks: profileLinks(a.form, founders, a.company) } satisfies Partial<Research>;
  const notChecked = (reason: string): Research => {
    const r: Research = { ...base, available: false, reason, verifications: claims.map(claim => ({ claim, label: "claimed", sources: [], note: "Only in the application. Not checked." })) };
    saveResearch(r); return r;
  };
  if (!d.search) return notChecked("No search key is set up, so founder backgrounds were not checked. Treat every background as NOT VERIFIED.");
  if (!d.ctx) return notChecked("No model is set up to read the pages, so founder backgrounds were not checked.");
  let plan: Query[];
  try { plan = buildQueries({ company: a.company, founders, sector: a.sector }); }
  catch (e: any) { return notChecked(`A name could not be searched for safely (${String(e?.message ?? e).slice(0, 80)}), so backgrounds were not checked.`); }

  const found: { label: string; url: string }[] = [];
  const queries: Research["queries"] = [], ranked: { q: Query; hits: (Hit & { tier: Tier })[] }[] = [];
  for (const q of plan) {
    try {
      const hits = await d.search.search(q.query); queries.push({ ...q, results: hits.length });
      // A LinkedIn profile that turns up in a search is linked for Riya to open. It is never fetched or scraped.
      if (q.purpose === "founder") { const li = hits.find(h => /^https:\/\/([a-z]{2,3}\.)?linkedin\.com\/in\//i.test(h.url)); if (li && !found.some(f => f.label.endsWith(q.subject))) found.push({ label: `LinkedIn result for ${q.subject}`, url: li.url }); }
      ranked.push({ q, hits: rankHits(hits, a.company, 3) });
    }
    catch (e: any) { queries.push({ ...q, results: 0, error: String(e?.message ?? "search failed").slice(0, 80) }); }
  }
  // Round robin across queries so one noisy query cannot use every page slot.
  const picked: { url: string; tier: Tier; q: Query }[] = [], seen = new Set<string>(), skipped: PageLog[] = [];
  for (let i = 0; i < 3 && picked.length < MAX_PAGES; i++) for (const { q, hits } of ranked) { const h = hits[i]; if (!h || seen.has(h.url)) continue; seen.add(h.url);
    const why = urlProblem(h.url);
    if (why) { skipped.push({ url: h.url, tier: h.tier, purpose: q.purpose, subject: q.subject, status: "not_read", note: `link only: ${why}` }); continue; }
    if (picked.length < MAX_PAGES) picked.push({ url: h.url, tier: h.tier, q }); }

  const pages: PageLog[] = [...skipped], facts: Fact[] = [], ctx: Ctx = { ...d.ctx, founders, application: a.slug };
  for (const p of picked) {
    const log = { url: p.url, tier: p.tier, purpose: p.q.purpose, subject: p.q.subject };
    const got = await d.fetch(p.url);
    if (!got.ok) { pages.push({ ...log, status: "not_read", note: got.error }); continue; }
    try {
      const r = await extractFacts({ ...log, text: got.text }, { company: a.company, sector: a.sector, founders, applicationClaims: claims, ctx });
      if (r.setAside) pages.push({ ...log, status: "set_aside", note: r.setAside });
      else { facts.push(...r.facts); pages.push({ ...log, status: r.facts.length ? "used" : "no_facts", note: r.dropped.length ? `${r.dropped.length} claim(s) dropped: ${r.dropped[0]}` : undefined }); }
    } catch (e: any) { pages.push({ ...log, status: "not_read", note: `could not read the page: ${String(e?.message ?? e).slice(0, 80)}` }); }
  }
  const uniq = new Map<string, Fact>(); for (const f of facts) uniq.set(`${f.url}|${f.claim.toLowerCase()}`, f);
  const final = [...uniq.values()].map((f, i) => ({ ...f, id: `r${i + 1}` }));
  const r: Research = { ...base, profileLinks: [...base.profileLinks, ...found], available: true, queries, pages, facts: final, verifications: verifyClaims(claims, final), conflicts: conflictsOf(final) };
  saveResearch(r); return r;
}
