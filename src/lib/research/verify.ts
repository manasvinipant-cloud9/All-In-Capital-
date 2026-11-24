import { domainOf, type Tier } from "./rank.ts";
import type { Fact } from "./extract.ts";

export type Verification = { claim: string; label: "verified" | "claimed" | "not found"; sources: { url: string; tier: Tier }[]; note: string };
const STOP = new Set(["the", "and", "for", "with", "years", "year", "worked", "work", "experience", "years", "from", "has", "was", "are", "his", "her", "who", "that", "this", "ex", "former", "months", "month"]);
/** Light stemming so "internship", "interned" and "intern" match, and "weeks" matches "week". */
const stem = (w: string) => { for (const suf of ["ships", "ship", "ing", "ed", "es", "s"]) if (w.endsWith(suf) && w.length - suf.length >= 4) return w.slice(0, -suf.length); return w; };
const tokens = (s: string) => [...new Set(s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(w => w.length > 2 && !STOP.has(w)).map(stem))];
const overlaps = (need: string[], text: string) => { const have = new Set(tokens(text)); return need.length > 0 && need.filter(t => have.has(t)).length >= Math.max(1, Math.ceil(need.length * 0.6)); };

/**
 * verified: an official/primary page confirms it, or two independent sites do (aggregators count once and never prove it alone).
 * claimed: it is in the application and at most one non-primary source mentions it.
 * not found: nothing on the web we read mentions it.
 */
export function verifyClaims(claims: string[], facts: Fact[]): Verification[] {
  const usable = facts.filter(f => f.same_person !== "no");
  return claims.map(claim => {
    const need = tokens(claim); if (need.length === 0) return { claim, label: "not found" as const, sources: [], note: "Nothing specific enough to look up." };
    const hits = usable.filter(f => overlaps(need, `${f.claim} ${f.quote}`));
    const byHost = new Map<string, { url: string; tier: Tier }>(); for (const h of hits) if (!byHost.has(domainOf(h.url))) byHost.set(domainOf(h.url), { url: h.url, tier: h.tier });
    const sources = [...byHost.values()], real = sources.filter(s => s.tier !== "aggregator");
    // A page that contradicts THIS statement means it cannot be called verified, however many pages mention the same company.
    if (hits.some(h => h.matches === "conflict" && (!h.about_claim || overlaps(need, h.about_claim)))) return { claim, label: "claimed" as const, sources, note: "A source says something different from this statement. See the flagged difference." };
    if (sources.some(s => s.tier === "primary")) return { claim, label: "verified" as const, sources, note: "Confirmed by an official or company page." };
    if (real.length >= 2) return { claim, label: "verified" as const, sources, note: "Confirmed by two independent sites." };
    if (sources.length >= 1) return { claim, label: "claimed" as const, sources, note: sources.every(s => s.tier === "aggregator") ? "Only an aggregator site mentions it. Not independently confirmed." : "Seen on only one site. Not independently confirmed." };
    return { claim, label: "not found" as const, sources: [], note: "Nothing found on the pages we read." };
  });
}
/** Facts where the page itself says the application differs. Each carries its quote. */
export const conflictsOf = (facts: Fact[]) => facts.filter(f => f.matches === "conflict" && f.same_person !== "no");
