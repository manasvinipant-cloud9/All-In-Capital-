// Blind backtest on the 12 memos. The scorer sees only What it does, Founder assessment and Risks, with the name redacted.
// It never sees the outcome, the stage label or "Why we...". In-sample: the memos shaped the rubric.
import { MEMOS } from "../../scripts/seed/content.ts";
import { total } from "./pipeline/validate.ts";
import { ratingWord } from "./rating.ts";
import { CRITERIA } from "./data-constants.ts";

export type Memo = (typeof MEMOS)[number];
export type Scorer = { name: string; offline: boolean; score(blind: string): Record<string, number> };

export function blindInput(m: Memo): string {
  const t = `What it does:\n${m.what}\n\nFounder assessment:\n${m.founder}\n\nRisks and open questions:\n${m.risks}`;
  return t.replaceAll(m.company, "[Company]");
}
// Rule-based stand-in used until a model key exists. Clearly labelled; it is NOT the model.
const CUES: [RegExp, Record<string, number>][] = [
  [/cohort|tracks repeat|margin per/i, { C3: 3, C4: 3 }], [/first loss|carries|owns/i, { C2: 3 }], [/milestone/i, { C6: 2, C2: 1 }],
  [/visited|rode with|field/i, { C1: 3, C3: 1 }], [/pilots?\b/i, { C3: 1 }], [/numerate|unit economics/i, { C4: 2 }],
  [/never tracked|no cohort|no repeat|no retention|downloads-led|missing/i, { C3: -2, C4: -3 }], [/problem|zero first-loss|partner can exit/i, { C2: -4 }],
  [/credentials only|no customers|no path to revenue|without evidence/i, { C1: -3, C3: -3 }], [/defensive/i, { C6: -3, C1: -1 }],
  [/regulation|regulatory/i, { C2: -3, C5: -2 }], [/capital intensive|wrong structure/i, { C5: -4 }], [/weak moat/i, { C6: -3 }], [/rising 3x/i, { C4: -1 }],
];
export const offlineScorer: Scorer = { name: "Offline rule-based stand-in (not a model)", offline: true, score(blind) {
  const s = Object.fromEntries(Object.keys(CRITERIA).map(k => [k, 5]));
  for (const [re, d] of CUES) if (re.test(blind)) for (const [k, v] of Object.entries(d)) s[k] = s[k] + v;
  return Object.fromEntries(Object.entries(s).map(([k, v]) => [k, Math.max(0, Math.min(10, v))]));
} };

const words = (s: string, n = 20) => s.replace(/\[[^\]]*\]/g, "").split(/\s+/).filter(Boolean).slice(0, n).join(" ");
const first = (s: string) => s.split(/(?<=[.!?])\s/)[0];
export type Row = { company: string; fund: "invested" | "passed"; predicted: "invest" | "pass"; score: number; word: string; agrees: boolean; yes?: string; no?: string; sources?: string[] };
export function runCalibration(scorer: Scorer = offlineScorer, threshold = 6, memos: Memo[] = MEMOS) {
  const rows: Row[] = memos.map(m => {
    const sc = scorer.score(blindInput(m)), t = total(sc), predicted = t >= threshold ? "invest" : "pass";
    const agrees = (predicted === "invest") === (m.outcome === "invested");
    const best = Object.entries(sc).sort((a, b) => b[1] - a[1])[0][0], worst = Object.entries(sc).sort((a, b) => a[1] - b[1])[0][0];
    const row: Row = { company: m.company, fund: m.outcome, predicted, score: t, word: ratingWord(t), agrees };
    if (!agrees) { row.yes = words(`Strongest on ${CRITERIA[best]}: ${first(m.founder)}`); row.no = words(`Weakest on ${CRITERIA[worst]}: ${first(m.risks)}`); row.sources = ["Founder assessment", "Risks and open questions"]; }
    return row;
  });
  const inv = rows.filter(r => r.fund === "invested"), pas = rows.filter(r => r.fund === "passed");
  let wins = 0; for (const a of inv) for (const b of pas) if (a.score > b.score) wins++;
  const ties = inv.flatMap(a => pas.filter(b => a.score === b.score)).length;
  return { scorer: scorer.name, offline: scorer.offline, threshold, rows, agreed: rows.filter(r => r.agrees).length, n: rows.length,
    matrix: { investedYes: inv.filter(r => r.predicted === "invest").length, investedNo: inv.filter(r => r.predicted === "pass").length, passedYes: pas.filter(r => r.predicted === "invest").length, passedNo: pas.filter(r => r.predicted === "pass").length },
    ranking: { wins, ties, pairs: inv.length * pas.length } };
}
export type Result = ReturnType<typeof runCalibration>;
export function reportMarkdown(r: Result): string {
  const m = r.matrix;
  return `# Calibration report\n\n**Scored by:** ${r.scorer}${r.offline ? " (no model key was available)" : ""}\n\n> In-sample: these 12 memos helped shape the rubric, so agreement here is optimistic. Scoring is blind: only "What it does", "Founder assessment" and "Risks" were shown, with names redacted.\n\n**Agreement:** ${r.agreed} of ${r.n}\n\n| | We would invest | We would pass |\n|---|---|---|\n| Fund invested | ${m.investedYes} | ${m.investedNo} |\n| Fund passed | ${m.passedYes} | ${m.passedNo} |\n\n**Ranking agreement:** the backed company outscored the passed one in ${r.ranking.wins} of ${r.ranking.pairs} pairs (${r.ranking.ties} ties).\n\n## Memos\n\n| Company | Fund did | We would | Rating |\n|---|---|---|---|\n${r.rows.map(x => `| ${x.company} | ${x.fund} | ${x.predicted} | ${x.word} |`).join("\n")}\n\n## Where we disagree\n\n${r.rows.filter(x => !x.agrees).map(x => `- **${x.company}** (fund ${x.fund})\n  - Case for yes: ${x.yes}\n  - Case for no: ${x.no}\n  - Sources: ${x.sources?.join("; ")}`).join("\n") || "None."}\n`;
}
