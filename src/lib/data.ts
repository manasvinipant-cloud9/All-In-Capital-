// Seed data + deterministic pipeline results. SCORES ARE PLACEHOLDERS (no model has scored anything); every screen labels them.
import { readFileSync } from "node:fs";
import { pdfPages, parseForm, type Page } from "./pipeline/ingest.ts";
import { reconcile, type Check } from "./pipeline/reconcile.ts";
import { g1, g2Offline, g3, g4, type Gate } from "./pipeline/gates.ts";
import { total } from "./pipeline/validate.ts";
import { recommend, lane, bucketOf, rank, type Rec } from "./pipeline/rank.ts";
import { APPS } from "../../scripts/seed/apps.ts";
import { MEMOS } from "../../scripts/seed/content.ts";

export const CRITERIA: Record<string, string> = { C1: "founder-market fit", C2: "risk ownership", C3: "customer pull", C4: "numbers fluency", C5: "pre-seed fit", C6: "why now" };
const PLACEHOLDER: Record<string, number[]> = {
  capilot: [6,5,6,5,7,5], greenloop: [8,7,9,8,7,7], scrollstar: [3,3,2,2,4,4], lendkart: [4,2,5,5,6,4], coinlane: [5,3,4,4,3,4],
  notelycalls: [5,5,6,5,6,3], earnwise: [3,3,4,3,5,4], dronedrishti: [8,7,6,6,6,8], laterstage: [6,6,7,6,2,5], ruralroots: [8,9,7,7,7,6],
};
export type AppView = {
  slug: string; company: string; sector: string; stage: string; city: string; oneLiner: string; form: Record<string, string>; deck: Page[];
  scores: Record<string, number>; total: number; rec: Rec; lane: "yes" | "your_call" | "no"; leans?: "yes" | "no";
  gates: Gate[]; checks: Check[]; best: string; worst: string; reminds?: { company: string; outcome: string; why: string }; createdAt: string;
};
export { ratingWord } from "./rating.ts";
const stem = (s: string) => new Set(s.toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/).filter(w => w.length > 3).map(w => w.slice(0, 5)));

let cache: AppView[] | null = null;
export async function allApps(): Promise<AppView[]> {
  if (cache) return cache;
  const portfolio = JSON.parse(readFileSync("seed/portfolio.json", "utf8"));
  const out: AppView[] = [];
  for (const [i, a] of APPS.entries()) {
    const deck = await pdfPages(`seed/decks/${a.slug}.pdf`);
    const form = parseForm(readFileSync(`seed/forms/${a.slug}.json`, "utf8"));
    const checks = reconcile(form, deck);
    const gates = [g1(form), g2Offline(deck), g3(`${deck[0].text} ${form["Product"] ?? ""}`, portfolio), g4(checks)];
    const sc = Object.fromEntries(Object.keys(CRITERIA).map((k, j) => [k, PLACEHOLDER[a.slug][j]]));
    const t = total(sc), anyGate = gates.some(g => g.tripped), g1t = gates[0].tripped;
    const rec = recommend(t, anyGate, sc.C1 >= 5 && sc.C2 >= 5 && sc.C3 >= 5);
    const l = lane(t, rec, g1t, anyGate);
    const ent = Object.entries(sc).sort((x, y) => y[1] - x[1]);
    const mine = stem(`${a.deck[0]} ${a.sector}`);
    const memo = MEMOS.map(m => ({ m, o: [...stem(`${m.what} ${m.company}`)].filter(x => mine.has(x)).length })).sort((x, y) => y.o - x.o)[0];
    out.push({ slug: a.slug, company: a.company, sector: a.sector, stage: a.stage, city: a.city, oneLiner: a.deck[0].split(". ").slice(1, 2).join("") || a.deck[0], form, deck,
      scores: sc, total: t, rec, lane: l.lane, leans: l.leans, gates, checks, best: ent[0][0], worst: ent[ent.length - 1][0],
      reminds: memo && memo.o > 0 ? { company: memo.m.company, outcome: memo.m.outcome, why: memo.m.why } : undefined, createdAt: `2026-11-${String(10 + i).padStart(2, "0")}` });
  }
  const order = rank(out.map(o => ({ id: o.slug, score: o.total, bucket: bucketOf(o.gates[0].tripped, o.gates.some(g => g.tripped)), coverage: 1, createdAt: o.createdAt })));
  cache = order.map(r => out.find(o => o.slug === r.id)!);
  return cache;
}
export const judgement = (a: AppView) => `Strongest on ${CRITERIA[a.best]}; thinnest on ${CRITERIA[a.worst]}.`;
