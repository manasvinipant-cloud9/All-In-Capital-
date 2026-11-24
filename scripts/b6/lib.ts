// Shared helpers for the fine-tuning experiment. Data lives in scripts/b6/data (git-ignored).
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

export const DATA = "scripts/b6/data";
export const ensure = () => mkdirSync(DATA, { recursive: true });
export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
export const writeJson = (name: string, v: unknown) => { ensure(); writeFileSync(`${DATA}/${name}`, JSON.stringify(v, null, 2)); };
export const readJson = <T,>(name: string): T => JSON.parse(readFileSync(`${DATA}/${name}`, "utf8"));

export function parseCsv(s: string): Record<string, string>[] {
  const out: string[][] = [];
  let row: string[] = [], cur = "", q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === '"' && s[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(cur); cur = ""; }
    else if (c === "\n") { row.push(cur); out.push(row); row = []; cur = ""; }
    else cur += c;
  }
  if (cur || row.length) { row.push(cur); out.push(row); }
  const [h, ...rows] = out;
  return rows.filter(r => r.length === h.length).map(r => Object.fromEntries(h.map((k, i) => [k, r[i]])));
}
export const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
export const loop1 = () => parseCsv(readFileSync("seed/exports/loop1_screening.csv", "utf8"));
export const loop2 = () => parseCsv(readFileSync("seed/exports/loop2_first_email.csv", "utf8"));

/** Founder names become [F1] so no name ever sits in an experiment file or a prompt. */
export function maskName(text: string, name: string): string {
  let out = text;
  for (const part of [name, ...name.split(/\s+/).filter(p => p.length > 2)]) out = out.replace(new RegExp(`\\b${part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g"), "[F1]");
  return out;
}

const PRAISE = /\b(impressive|exciting|excited|love|great|amazing|fantastic|incredible|fascinating)\b/i;
const SLOT = /\b(?:Mon|Tues|Wednes|Thurs|Fri)day[^.?\n]*?\d{1,2}(?::\d{2})?\s?(?:am|pm)/gi;
/** Deterministic labels for what Riya changed between the system draft and her final email. */
export function changeTags(draft: string, final: string): string[] {
  const t: string[] = [];
  if (PRAISE.test(draft) && !PRAISE.test(final)) t.push("praise_removed");
  if ((final.match(SLOT) ?? []).length >= 2 && (draft.match(SLOT) ?? []).length < 2) t.push("two_slots_added");
  if (/chat sometime|tell us more|open to a chat/i.test(draft) && /\?/.test(final) && !/chat sometime|tell us more/i.test(final)) t.push("generic_ask_replaced_by_pointed_question");
  if (/best regards|kind regards/i.test(draft) && /Riya\s*\nAll In Capital\s*$/.test(final.trim())) t.push("signoff_fixed");
  if (/unusual|rare/i.test(final) && !/unusual|rare/i.test(draft)) t.push("why_unusual_added");
  if (words(final) < words(draft) * 0.8) t.push("shortened");
  if (words(final) > words(draft) * 1.2) t.push("lengthened");
  return t;
}
