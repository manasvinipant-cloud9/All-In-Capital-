// The examples loop. Riya's real sent emails are shown to the drafter, most similar first. Every email she edits and sends is added.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { parseCsv } from "../csv.ts";
import { nearestExamples } from "./draft.ts";

const FILE = ".local/style_examples.json";
type Stored = { sector: string; body: string; at: string };
const load = (): Stored[] => (existsSync(FILE) ? JSON.parse(readFileSync(FILE, "utf8")) : []);

/** Names and dates are removed so an example teaches style, not a person: "Hi [F1]," and the slot placeholders. */
export const normalizeExample = (body: string) =>
  body.replace(/^Hi [^,\n]+,/, "Hi [F1],").replace(/Would .+? or .+? work for a 30-minute call\?/, "Would {slot_1} or {slot_2} work for a 30-minute call?");

export function addStyleExample(o: { sector: string; body: string }) {
  mkdirSync(".local", { recursive: true });
  writeFileSync(FILE, JSON.stringify([{ sector: o.sector, body: normalizeExample(o.body), at: new Date().toISOString() }, ...load()], null, 2));
}
/** Three of Riya's real emails: same sector first, newest sent emails ahead of the seed set. */
export function styleExamples(sector: string, n = 3): string[] {
  const seed = existsSync("seed/exports/loop2_first_email.csv") ? parseCsv(readFileSync("seed/exports/loop2_first_email.csv", "utf8")).slice(0, 58) : [];
  const rows = [...load().map(s => ({ sector: s.sector, riya_final_email: s.body, system_draft: "" })), ...seed.map(r => ({ sector: r.sector, riya_final_email: r.riya_final_email, system_draft: r.system_draft }))];
  return nearestExamples(rows, sector, n).map(normalizeExample);
}
