// Step 4: extend the training set to about 300 with synthetic examples, generated ONLY from training rows
// (never from the sealed test rows), labelled "synthetic", and kept only if they pass the same checks.
import { lint } from "../../src/lib/email/lint.ts";
import { readJson, sha256, writeJson } from "./lib.ts";

type Row = { row_id: string; founder_type: string; sector: string; traction_facts: string; final: string };
const train = readJson<Row[]>("train_pool.json");
const sealedIds = new Set(readJson<Row[]>("sealed_test.json").map(r => r.row_id));
if (train.some(r => sealedIds.has(r.row_id))) throw new Error("Sealed rows found in the training pool");

// Split each real Riya email into parts so new emails recombine parts that Riya actually wrote.
const parts = train.map(r => {
  const [, fact, why, ask] = r.final.match(/^Hi \[F1\],\n(.+?) is unusual for a pre-seed team, (.+?)\. (.+\?)\n/) ?? [];
  const slots = r.final.match(/Would (.+?) or (.+?) work for a 30-minute call\?/);
  return { fact, why, ask, a: slots?.[1], b: slots?.[2] };
}).filter(p => p.fact && p.why && p.ask && p.a && p.b);
const facts = [...new Set(train.map(r => r.traction_facts))];

let s = 7; const rnd = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
const out: Record<string, string | boolean>[] = [], seen = new Set<string>();
let tried = 0, rejected = 0;
while (out.length < 300 && tried < 5000) {
  tried++;
  const fact = pick(facts), why = pick(parts).why, ask = pick(parts).ask, p = pick(parts), parent = pick(train);
  const body = `Hi [F1],\n${fact} is unusual for a pre-seed team, ${why}. ${ask}\nWould ${p.a} or ${p.b} work for a 30-minute call? If neither suits you, reply with a time that does.\nRiya\nAll In Capital`;
  if (seen.has(sha256(body))) continue;
  if (lint({ template: "invite", subject: "Quick call", body: body.replace("[F1]", "Asha") }).length) { rejected++; continue; }
  seen.add(sha256(body));
  out.push({ id: `syn-${out.length + 1}`, source: "synthetic", traction_facts: fact, founder_type: parent.founder_type, sector: parent.sector, email: body, synthetic: true });
}
writeJson("train_extended.json", [...train.map(r => ({ id: r.row_id, source: "real_export_row", traction_facts: r.traction_facts, founder_type: r.founder_type, sector: r.sector, email: r.final, synthetic: false })), ...out]);
console.log(`Training pool rows: ${train.length}. Synthetic added: ${out.length} (tried ${tried}, rejected by checks ${rejected}). Total: ${train.length + out.length}.`);
console.log(`Note: ${train.length} "real" rows are themselves rows of a FICTIONAL export; the Drive exports were not readable. Synthetic rows only recombine their parts.`);
