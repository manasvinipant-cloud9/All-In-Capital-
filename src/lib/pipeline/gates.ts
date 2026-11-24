import { parseInr, toCr } from "./units.ts";
import type { Page } from "./ingest.ts";
import { hasRed, type Check } from "./reconcile.ts";

export type Gate = { gate: "G1" | "G2" | "G3" | "G4"; tripped: boolean; reason: string; cite?: { page?: number; field?: string; quote?: string }[] };
/** What the company says it does: the one-line description and what it has built, falling back to the deck cover. */
export const describe = (form: Record<string, string>, deck: Page[]) => `${form["One-line description"] ?? ""} ${form["What have you built?"] ?? ""} ${(form["One-line description"] ?? "").length < 20 ? deck[0]?.text ?? "" : ""}`;
export type PortfolioRow = { name: string; one_liner: string };

/** G1: pre-seed or seed, raise <= Rs 10 Cr, post-money <= Rs 40 Cr. Unreadable amounts are flagged with the text. Deterministic. */
export function g1(form: Record<string, string>, lim = { raiseMaxCr: 10, postMaxCr: 40 }): Gate {
  const stage = (form["Stage"] ?? "").toLowerCase();
  const round = form["Round size"] ?? "", post = form["Valuation (post-money)"] ?? "";
  const r = parseInr(round), p = parseInr(post);
  const why: string[] = [];
  if (!/pre-?seed|^seed$/.test(stage)) why.push(`stage is "${form["Stage"]}"`);
  if (r == null) why.push(`could not read round size: "${round}"`); else if (toCr(r) > lim.raiseMaxCr) why.push(`raise Rs ${toCr(r)} Cr is above Rs ${lim.raiseMaxCr} Cr`);
  if (p == null) why.push(`could not read valuation: "${post}"`); else if (toCr(p) > lim.postMaxCr) why.push(`post-money Rs ${toCr(p)} Cr is above Rs ${lim.postMaxCr} Cr`);
  return { gate: "G1", tripped: why.length > 0, reason: why.join("; ") || "Pre-seed or seed, within the cheque.", cite: [{ field: "Stage / Round size / Valuation" }] };
}

/** G2 offline fallback: wording that says the business exists only if a rule changes. The model version (cited) replaces this when a key exists. */
export function g2Offline(deck: Page[]): Gate {
  for (const p of deck) { const m = p.text.match(/[^.]*(?:depends? on|only exists if|once the government)[^.]*(?:legali[sz]|regulat)[^.]*/i); if (m) return { gate: "G2", tripped: true, reason: "Business depends on a regulatory change going its way.", cite: [{ page: p.page, quote: m[0].trim() }] }; }
  return { gate: "G2", tripped: false, reason: "No regulatory dependence found in the deck wording (offline check)." };
}

const STOP = new Set(["and","the","for","with","that","this","from","into","your","our","are","has","who","per","app","ai"]);
const stems = (s: string) => new Set(s.toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/).filter(w => w.length > 2 && !STOP.has(w)).map(w => w.replace(/s$/, "").slice(0, 5)));
/** G3: similarity of the one-liner against every portfolio row. Stand-in for the vector match (same interface). A false alarm beats a miss. */
export function g3(appText: string, portfolio: PortfolioRow[]): Gate & { matches: { name: string; overlap: number }[] } {
  const a = stems(appText);
  const matches = portfolio.map(p => ({ name: p.name, overlap: [...stems(p.one_liner)].filter(x => a.has(x)).length })).filter(m => m.overlap >= 2).sort((x, y) => y.overlap - x.overlap);
  return { gate: "G3", tripped: matches.length > 0, matches, reason: matches.length ? `Possible overlap with portfolio company ${matches.map(m => m.name).join(", ")}. A false alarm beats a miss.` : "No portfolio overlap found." };
}

export function g4(checks: Check[]): Gate {
  const reds = checks.filter(c => c.severity === "red");
  return { gate: "G4", tripped: hasRed(checks), reason: reds.length ? `${reds.length} numbers or claims to confirm: ${reds.map(r => r.name).join("; ")}. Ask for the numbers.` : "Deck and form agree." , cite: reds.map(r => ({ page: r.page, quote: r.quote }))};
}
