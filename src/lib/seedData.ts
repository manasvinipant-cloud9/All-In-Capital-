// The fund's real seed data (see seed/README.md). Read at call time so tests can point at a different folder.
import { existsSync, readFileSync } from "node:fs";
export type Memo = { n: number; company: string; sector: string; stage: string; source: string; outcome: "invested" | "passed"; what: string; founder: string; risks: string; why: string };
export const getMemos = (): Memo[] => (existsSync("seed/memos.json") ? JSON.parse(readFileSync("seed/memos.json", "utf8")) : []);
export const getMeetings = (): { title: string; text: string }[] => (existsSync("seed/meetings.json") ? JSON.parse(readFileSync("seed/meetings.json", "utf8")) : []);
export const getPortfolio = (): { name: string; one_liner: string; sector: string; status: string; tags: string[]; domain: string; source_url: string; source_note: string }[] =>
  existsSync("seed/portfolio.json") ? JSON.parse(readFileSync("seed/portfolio.json", "utf8")) : [];

/** Founder names in a memo, found in its "Founder assessment" opening. Used to remove names before text goes into a prompt. */
export function memoPeople(m: Memo): string[] {
  const head = m.founder.slice(0, 200), out = new Set<string>();
  for (const x of head.matchAll(/(?:Dr\. )?[A-Z][a-z]+(?: [A-Z][a-z]+)+(?= \(|,| and )/g)) out.add(x[0]);
  return [...out].flatMap(n => [n, ...n.replace(/^Dr\. /, "").split(" ").filter(p => p.length > 2)]);
}
export function redactMemo(m: Memo, text: string): string {
  let t = text.replaceAll(m.company, "[Company]").replace(/^The \[Company\] Company/, "[Company]");
  for (const p of memoPeople(m).sort((a, b) => b.length - a.length)) t = t.replace(new RegExp(`\\b${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g"), "[Founder]");
  return t;
}
