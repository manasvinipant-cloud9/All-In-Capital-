import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
export type Decision = { slug: string; company: string; decision: "yes" | "no"; note: string; rec: string; against: boolean; by: string; at: string; reusedIn: string[] };
const FILE = ".local/decisions.json";
export const isAgainst = (decision: "yes" | "no", rec: string) => (decision === "yes" && rec === "Pass") || (decision === "no" && rec === "Take the call");
export const loadDecisions = (): Decision[] => (existsSync(FILE) ? JSON.parse(readFileSync(FILE, "utf8")) : []);
export function addDecision(d: Omit<Decision, "against" | "at" | "reusedIn">): Decision {
  const full: Decision = { ...d, against: isAgainst(d.decision, d.rec), at: new Date().toISOString(), reusedIn: [] };
  mkdirSync(".local", { recursive: true }); writeFileSync(FILE, JSON.stringify([...loadDecisions().filter(x => x.slug !== d.slug), full], null, 2));
  return full;
}
const stem = (s: string) => new Set(s.toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/).filter(w => w.length > 3).map(w => w.slice(0, 5)));
/** Similar past corrections shown to the scorer, application name redacted. Logs where each was reused. */
export function correctionsFor(slug: string, company: string, text: string, n = 3) {
  const mine = stem(text), all = loadDecisions();
  const hits = all.filter(d => d.against && d.slug !== slug && d.note).map(d => ({ d, o: [...stem(d.note + " " + d.company)].filter(x => mine.has(x)).length })).filter(x => x.o > 0).sort((a, b) => b.o - a.o).slice(0, n);
  if (hits.length) { for (const h of hits) h.d.reusedIn.push(slug); writeFileSync(FILE, JSON.stringify(all, null, 2)); }
  return hits.map(h => ({ decision: h.d.decision, note: h.d.note.replaceAll(h.d.company, "[Company]") }));
}
