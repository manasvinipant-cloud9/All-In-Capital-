// Step 4: extend the training set with synthetic examples, generated ONLY from training rows (never the sealed test rows),
// labelled "synthetic", and kept only if they pass the same checks. Without a model, a synthetic row can only vary what does not
// change the meaning: the offer paragraph (its wording and its dates). Facts and questions are never mixed between emails.
import { lint } from "../../src/lib/email/lint.ts";
import { readJson, sha256, writeJson } from "./lib.ts";

type Row = { row_id: string; founder_type: string; sector: string; traction_facts: string; final: string };
const train = readJson<Row[]>("train_pool.json");
const sealedIds = new Set(readJson<Row[]>("sealed_test.json").map(r => r.row_id));
if (train.some(r => sealedIds.has(r.row_id))) throw new Error("Sealed rows found in the training pool");

const MON = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const day = (d: Date) => `${d.getUTCDay() === 2 ? "Tuesday" : "Thursday"} ${d.getUTCDate()} ${MON[d.getUTCMonth()]}`;
let s = 11; const rnd = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
function datePair(): [string, string] {
  const base = new Date(Date.UTC(2025, 4, 1) + Math.floor(rnd() * 400) * 86400000);
  while (base.getUTCDay() !== 2) base.setUTCDate(base.getUTCDate() + 1);
  const th = new Date(base.getTime() + (rnd() < 0.5 ? 2 : 9) * 86400000), tu = new Date(base.getTime() + (rnd() < 0.5 ? 0 : 7) * 86400000);
  return rnd() < 0.5 ? [day(tu), day(th)] : [day(th), day(tu)];
}
const OFFERS = [(a: string, b: string) => `Would 30 minutes on ${a} or ${b}, either afternoon, work?`, (a: string, b: string) => `Could we do 30 minutes on ${a} or ${b}, in the afternoon?`, (a: string, b: string) => `Do you have 30 minutes on ${a} or ${b} afternoon?`];

// Real email = paragraphs: greeting, fact, question, offer (+ optional Aditya sentence), sign-off.
const parsed = train.map(r => { const p = r.final.split(/\n\s*\n/).map(x => x.trim()); return { r, p, aditya: /Aditya/.test(r.final) }; }).filter(x => x.p.length === 5 && /^Hi /.test(x.p[0]) && /Tuesday|Thursday/.test(x.p[3]));
const out: Record<string, string | boolean>[] = [], seen = new Set<string>(); let tried = 0, rejected = 0;
while (out.length < 300 && tried < 4000) {
  tried++;
  const { r, p, aditya } = pick(parsed), [a, b] = datePair();
  const offer = `${pick(OFFERS)(a, b)}${aditya ? " Our partner Aditya will join us for the technical part." : ""}`;
  const email = `${p[0]}\n\n${p[1]}\n\n${p[2]}\n\n${offer}\n\n${p[4]}`;
  if (email === r.final || seen.has(sha256(email))) continue;
  if (lint({ template: "invite", subject: "Quick call", body: email.replace("[F1]", "Asha"), deeptech: aditya }).length) { rejected++; continue; }
  seen.add(sha256(email));
  out.push({ id: `syn-${out.length + 1}`, source: "synthetic", parent: r.row_id, traction_facts: r.traction_facts, founder_type: r.founder_type, sector: r.sector, email, synthetic: true });
}
writeJson("train_extended.json", [...train.map(r => ({ id: r.row_id, source: "real_export_row", traction_facts: r.traction_facts, founder_type: r.founder_type, sector: r.sector, email: r.final, synthetic: false })), ...out]);
console.log(`Training rows (real): ${train.length}, usable for variants: ${parsed.length}. Synthetic added: ${out.length} (tried ${tried}, rejected by checks ${rejected}). Total: ${train.length + out.length}.`);
console.log("Synthetic rows differ from their parent only in the offer wording and dates. They add volume, not new style.");
