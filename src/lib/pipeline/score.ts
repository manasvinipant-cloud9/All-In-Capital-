// Scoring an application with the model. One call per criterion. The model gives each criterion a score;
// the total is computed in code. The scorer sees retrieved memo passages and past corrections (names removed), not every memo.
import { CRITERIA } from "../data-constants.ts";
import { loadConfig } from "../config.ts";
import { correctionsFor } from "../decisions.ts";
import { topMemos } from "../memos.ts";
import { saveScored, type Scored } from "../scored.ts";
import { extractClaims, scoreCriterion, type Ctx } from "./steps.ts";
import { missing, type Claim } from "./validate.ts";
import type { Page } from "./ingest.ts";
import type { Check } from "./reconcile.ts";
import type { Gate } from "./gates.ts";

export const PROMPT_VERSION = 1;
const PRIVATE = new Set(["Email", "Phone", "LinkedIn"]);

/** Founder names for redaction: the form's name plus anyone the deck lists with a founder title. */
export function foundersOf(form: Record<string, string>, deck: Page[]): string[] {
  const names = new Set<string>(); if (form["Founder name"]) names.add(form["Founder name"].trim());
  for (const m of deck.map(p => p.text).join(" ").matchAll(/([A-Z][a-z]+(?: [A-Z][a-z]+)+),? (?:CEO|CTO|COO|CFO|Co-?founder)/g)) names.add(m[1]);
  return [...names];
}
export const formAsPage = (form: Record<string, string>): Page => ({ page: 1, text: Object.entries(form).filter(([k]) => !PRIVATE.has(k)).map(([k, v]) => `${k}: ${v}.`).join(" ") });

export type App = { slug: string; company: string; sector: string; form: Record<string, string>; deck: Page[]; checks: Check[]; gates: Gate[] };
export async function scoreApplication(a: App, base: Omit<Ctx, "founders" | "application">): Promise<Scored> {
  const cfg = loadConfig(), ctx: Ctx = { ...base, founders: foundersOf(a.form, a.deck), application: a.slug };
  const deckC = await extractClaims(a.deck, ctx, "d"), formC = await extractClaims([formAsPage(a.form)], ctx, "f");
  const claims: Claim[] = [...deckC.accepted, ...formC.accepted];
  const known = new Set(claims.map(c => c.id!));
  const text = `${a.deck.map(p => p.text).join(" ")} ${JSON.stringify(a.form)}`;
  const memos = topMemos(text), fixes = correctionsFor(a.slug, a.company, text);
  const evidence = [
    "CLAIMS (cite these ids):", ...claims.map(c => `[${c.id}] ${c.metric}: ${c.value}${c.unit ? " " + c.unit : ""}${c.period ? " (" + c.period + ")" : ""}. Quote: "${c.quote}"`),
    "", "NUMBERS THAT DO NOT ADD UP:", ...(a.checks.length ? a.checks.map(c => `- ${c.name}: ${c.formula}`) : ["- none found"]),
    "", "CHECKS TRIPPED:", ...(a.gates.some(g => g.tripped) ? a.gates.filter(g => g.tripped).map(g => `- ${g.gate}: ${g.reason}`) : ["- none"]),
    ...(memos.length ? ["", "SIMILAR PAST MEMOS:", ...memos] : []),
    ...(fixes.length ? ["", "PAST CORRECTIONS BY THE PARTNERS (similar applications):", ...fixes.map(f => `- They decided ${f.decision}. ${f.note}`)] : []),
  ].join("\n");

  const out: Scored = { slug: a.slug, scores: {}, confidence: {}, rationale: {}, gaps: {}, claims, rubricVersion: cfg.version, promptVersion: PROMPT_VERSION, model: base.primary, scoredAt: new Date().toISOString(), corrections: fixes.length, memos: memos.length };
  for (const k of Object.keys(CRITERIA)) {
    const anchors = Object.entries(cfg.anchors[k]).map(([n, t]) => `${n}: ${t}`).join("; ");
    const s = claims.length === 0 ? missing(k) : await scoreCriterion(k, evidence, ctx, { known, guide: `${CRITERIA[k]}. Anchors: ${anchors}.` });
    out.scores[k] = s.score; out.confidence[k] = s.confidence; out.rationale[k] = s.rationale; if (s.gap) out.gaps[k] = s.gap;
  }
  saveScored(out);
  return out;
}
