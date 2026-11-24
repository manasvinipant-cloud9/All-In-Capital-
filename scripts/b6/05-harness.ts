// Step 5: the harness. Refuses to run if the sealed test set changed. Deterministic checks only unless a model key exists.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { lint } from "../../src/lib/email/lint.ts";
import { realTransport, modelNames } from "../../src/lib/gateway/transport.ts";
import { DATA, readJson, sha256, writeJson } from "./lib.ts";

type Row = { row_id: string; founder_type: string; sector: string; traction_facts: string; system_draft: string; final: string };

// 1) The seal. Two independent copies of the fingerprint must match the file as it is now.
const body = readFileSync(`${DATA}/sealed_test.json`, "utf8");
const now = sha256(JSON.stringify(JSON.parse(body)));
const stored = readFileSync(`${DATA}/sealed_test.sha256`, "utf8").trim();
const committed = existsSync("docs/B6_SEAL.txt") ? (readFileSync("docs/B6_SEAL.txt", "utf8").match(/[0-9a-f]{64}/) ?? [""])[0] : "";
if (now !== stored || now !== committed) { console.error(`SEAL BROKEN. File ${now}, stored ${stored}, committed ${committed}. Refusing to run.`); process.exit(1); }
const test = JSON.parse(body) as Row[];
console.log(`Seal OK (${now.slice(0, 12)}...), ${test.length} rows.`);

// 2) Arms. A is measured. T is a fixed template with no model. B, C, E need a model; D (fine-tune) only if the stop rule does not fire.
const template = (r: Row) => {
  const fact = (r.traction_facts.split(";").map(x => x.trim()).find(x => /\d/.test(x)) ?? r.traction_facts.split(";")[0]).replace(/[.]$/, "");
  return `Hi [F1],\n\n${fact} is unusual for a ${r.sector.toLowerCase()} startup at this stage.\n\nHow much of that came from your first few customers?\n\nCould we do 30 minutes on Tuesday 2 December or Thursday 4 December, in the afternoon?\n\nRiya\nAll In Capital`;
};
const arms: Record<string, (r: Row) => string> = { "A: old system drafts": r => r.system_draft, "T: fixed template (no model)": template, "R: Riya's own emails (sanity)": r => r.final };

const tok = (s: string) => new Set(s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean));
const jaccard = (a: string, b: string) => { const x = tok(a), y = tok(b); return [...x].filter(t => y.has(t)).length / new Set([...x, ...y]).size; };
const nums = (s: string) => (s.match(/\d[\d,.]*/g) ?? []).map(n => n.replace(/[,.]+$/, ""));
const slotless = (s: string) => s.replace(/\[F\d+\]/g, "").split("\n").filter(l => !/Tuesday|Thursday/.test(l)).join("\n");

const results = Object.entries(arms).map(([name, gen]) => {
  const outs = test.map(r => ({ r, e: gen(r) }));
  const clean = outs.filter(({ e }) => lint({ template: "invite", subject: "Quick call", body: e.replace("[F1]", "Asha") }).length === 0).length;
  const fabricated = outs.filter(({ r, e }) => nums(slotless(e)).some(n => !nums(`${r.traction_facts} ${r.sector}`).includes(n))).length;
  return { arm: name, n: test.length, lintClean: clean, lintCleanRate: +(clean / test.length).toFixed(2), exactAsRiya: outs.filter(({ r, e }) => e === r.final).length, meanWordOverlapWithRiya: +(outs.reduce((a, { r, e }) => a + jaccard(e, r.final), 0) / test.length).toFixed(2), emailsWithNumberNotInSource: fabricated };
});

const modelReady = !!realTransport() && !!modelNames();
const notRun = ["B: current prompt", "C: new prompt + Riya's examples", "E: new prompt, no examples", "J: judge calibration on old drafts", "D: LoRA fine-tune"].map(a => ({ arm: a, status: a.startsWith("D") ? "not run: stop rule fires (see brief)" : modelReady ? "model key present: not wired in this version" : "not run: no model key" }));
writeJson("results.json", { sealed: now, measured: results, notRun });

const md = `# B6 harness results (sealed test set, ${test.length} rows)

Seal verified: \`${now}\`.

**Read this first:** the rows are the fund's real Loop 2 export (58 clean rows after dropping the two planted bad ones). With 20 test rows, every figure is rough: one email is 5 percentage points. Arms that need a model were not run.

| Arm | Passes all checks | Identical to Riya's email | Mean word overlap with Riya's | Emails with a number not in the facts |
|---|---|---|---|---|
${results.map(r => `| ${r.arm} | ${r.lintClean} of ${r.n} | ${r.exactAsRiya} | ${r.meanWordOverlapWithRiya} | ${r.emailsWithNumberNotInSource} |`).join("\n")}

"Identical to Riya's email" for arm A is the measured sent-as-is baseline on these rows (${results[0].exactAsRiya} of ${results[0].n}). Across all 60 rows it is 25 (42%).

## Not run
${notRun.map(n => `- ${n.arm}: ${n.status}`).join("\n")}

The deterministic checks cannot measure "sent as is": an email can pass every check and still be rewritten. That needs the judge, which needs a model key.
`;
writeFileSync("docs/B6_RESULTS.md", md);
console.log(md);
