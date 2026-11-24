// Seed data + pipeline results. Scores come from the saved model run when one exists; otherwise they are labelled placeholders.
import { readFileSync } from "node:fs";
import { pdfPages, parseForm, type Page } from "./pipeline/ingest.ts";
import { reconcile, type Check } from "./pipeline/reconcile.ts";
import { describe, g1, g2Offline, g3, g4, type Gate } from "./pipeline/gates.ts";
import { total } from "./pipeline/validate.ts";
import { lensFor, lensWeights, WRITTEN } from "./pipeline/lens.ts";
import { loadConfig } from "./config.ts";
import { loadScored } from "./scored.ts";
import { loadResearch } from "./research/store.ts";
import type { Research } from "./research/store.ts";
import { recommend, lane, bucketOf, rank, type Rec } from "./pipeline/rank.ts";
import { listMeta, loadFiles, type Meta } from "./apps.ts";
import { jobs } from "./queue.ts";
import { getMemos, getPortfolio } from "./seedData.ts";

export { CRITERIA } from "./data-constants.ts";
import { CRITERIA } from "./data-constants.ts";
export type AppView = {
  slug: string; company: string; sector: string; stage: string; city: string; oneLiner: string; form: Record<string, string>; deck: Page[];
  scores: Record<string, number>; total: number; totalWritten: number; rec: Rec; lane: "yes" | "your_call" | "no" | "unscored"; leans?: "yes" | "no";
  gates: Gate[]; checks: Check[]; best: string; worst: string; reminds?: { company: string; outcome: string; why: string }; createdAt: string;
  source: "model" | "unscored"; waiting?: string; research: Research | null; uploaded: boolean; rationale: Record<string, string>; gaps: Record<string, string>; scoredAt?: string;
};
export { ratingWord } from "./rating.ts";
/** First real sentence of the deck: skips the page header and a sentence that is only the company name. */
export function oneLiner(text: string, company: string) {
  const t = text.replace(/^.*?\(page 1\)\s*/, "");
  const s = t.split(/\.\s+/).map(x => x.trim()).find(x => x.split(/\s+/).length >= 3 && x.toLowerCase() !== company.toLowerCase());
  return (s ?? t).slice(0, 140);
}
const stem = (s: string) => new Set(s.toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/).filter(w => w.length > 3).map(w => w.slice(0, 5)));

type Static = { a: Meta; i: number; deck: Page[]; form: Record<string, string>; checks: Check[]; g2: Gate; g3: Gate };
const statics = new Map<string, Static>();
async function load(): Promise<Static[]> {
  const portfolio = getPortfolio(), out: Static[] = [];
  for (const [i, a] of listMeta().entries()) {
    let st = statics.get(a.slug);
    if (!st) {
      const { deck, form } = await loadFiles(a.slug), checks = reconcile(form, deck);
      st = { a, i, deck, form, checks, g2: g2Offline(deck), g3: g3(describe(form, deck), portfolio) };
      statics.set(a.slug, st);
    }
    out.push({ ...st, a, i });
  }
  return out;
}

/** Why an application has no score yet, in plain words, from its queue job. */
function waitingReason(slug: string): string {
  const j = jobs().filter(x => x.slug === slug).at(-1);
  if (!j) return "Not queued yet.";
  if (j.status === "queued") return "In the queue. It is read on the next run, within 5 minutes.";
  if (j.status === "running") return "Being read now.";
  if (j.status === "blocked") return j.reason ?? "Checks are done. Scoring is waiting for a model key.";
  if (j.status === "needs_look") return j.reason ?? "Needs a look.";
  return "Done reading. Waiting for the score to be saved.";
}

/** Cheap to call on every request: only the scoring is recomputed, so a new model run shows up straight away. */
export async function allApps(): Promise<AppView[]> {
  const cfg = loadConfig(), out: AppView[] = [];
  for (const { a, i, deck, form, checks, g2, g3: gate3 } of await load()) {
    const gates = [g1(form, cfg.fund), g2, gate3, g4(checks)];
    const saved = loadScored(a.slug);
    if (!saved) {   // not scored yet: show the real checks, never a made-up rating
      out.push({ slug: a.slug, company: a.company, sector: a.sector, stage: a.stage, city: a.city, oneLiner: form["One-line description"] ?? oneLiner(deck[0]?.text ?? "", a.company), form, deck, scores: {}, total: 0, totalWritten: 0, rec: "Pass", lane: "unscored",
        gates, checks, best: "", worst: "", createdAt: a.addedAt ?? "9999", source: "unscored", waiting: waitingReason(a.slug), uploaded: a.source === "uploaded", rationale: {}, gaps: {}, research: loadResearch(a.slug) });
      continue;
    }
    const sc = saved.scores;
    const med = (k: string) => saved.confidence[k] !== "low";
    const t = total(sc, lensWeights(cfg.weights, lensFor(a.sector, JSON.stringify(form)), cfg.lensMultiplier)), tw = total(sc, WRITTEN), anyGate = gates.some(g => g.tripped), g1t = gates[0].tripped;
    const rec = recommend(t, anyGate, sc.C1 >= 5 && sc.C2 >= 5 && sc.C3 >= 5 && med("C1") && med("C2") && med("C3"), cfg.thresholds);
    const l = lane(t, rec, g1t, anyGate, cfg.thresholds);
    const ent = Object.entries(sc).sort((x, y) => y[1] - x[1]);
    const mine = stem(`${deck[0]?.text ?? ""} ${a.sector}`);
    const memo = getMemos().map(m => ({ m, o: [...stem(`${m.what} ${m.company}`)].filter(x => mine.has(x)).length })).sort((x, y) => y.o - x.o)[0];
    out.push({ slug: a.slug, company: a.company, sector: a.sector, stage: a.stage, city: a.city, oneLiner: form["One-line description"] ?? oneLiner(deck[0]?.text ?? "", a.company), form, deck,
      scores: sc, total: t, totalWritten: tw, rec, lane: l.lane, leans: l.leans, gates, checks, best: ent[0][0], worst: ent[ent.length - 1][0],
      reminds: memo && memo.o > 0 ? { company: memo.m.company, outcome: memo.m.outcome, why: memo.m.why } : undefined, createdAt: a.addedAt ?? `2026-11-${String(10 + i).padStart(2, "0")}`,
      source: "model", uploaded: a.source === "uploaded", rationale: saved.rationale, gaps: saved.gaps, scoredAt: saved.scoredAt, research: loadResearch(a.slug) });
  }
  const order = rank(out.filter(o => o.source !== "unscored").map(o => ({ id: o.slug, score: o.total, bucket: bucketOf(o.gates[0].tripped, o.gates.some(g => g.tripped)), coverage: 1, createdAt: o.createdAt })));
  return [...order.map(r => out.find(o => o.slug === r.id)!), ...out.filter(o => o.source === "unscored")];
}
export const judgement = (a: AppView) => `Strongest on ${CRITERIA[a.best]}; thinnest on ${CRITERIA[a.worst]}.`;
