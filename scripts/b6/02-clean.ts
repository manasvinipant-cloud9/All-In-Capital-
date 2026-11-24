// Step 2: mask names, drop rows that break Riya's own standard, and check that all of her clean emails pass the linter.
import { lint } from "../../src/lib/email/lint.ts";
import { loop2, maskName, words, writeJson } from "./lib.ts";

const rows = loop2();
const kept: Record<string, string | number | boolean>[] = [];
const dropped: { row_id: string; why: string }[] = [];
const wrongChecks: { row_id: string; issues: string[] }[] = [];

for (const r of rows) {
  const final = maskName(r.riya_final_email, r.founder_name);
  const issues = lint({ template: "invite", subject: "Quick call", body: final.replace(/\[F1\]/g, r.founder_name) });
  // Rows that break her standard (a boilerplate email, a "Dear Ms" email) are dropped, not learned from.
  const breaksStandard = words(final) > 80 || /^Dear /i.test(final) || /kind regards|best regards/i.test(final);
  if (breaksStandard) { dropped.push({ row_id: r.row_id, why: `${words(final)} words or formal sign-off` }); continue; }
  if (issues.length) wrongChecks.push({ row_id: r.row_id, issues: issues.map(i => i.rule) });
  kept.push({ row_id: r.row_id, date: r.date_sent, founder_type: r.founder_type, sector: r.sector, stage: r.stage, traction_facts: r.traction_facts,
    system_draft: maskName(r.system_draft, r.founder_name), final, source: "real_export_row", synthetic_export: true });
}
writeJson("clean.json", kept);
console.log(`Rows in export: ${rows.length}. Dropped (break Riya's standard): ${dropped.length} ${JSON.stringify(dropped.map(d => d.row_id))}. Kept: ${kept.length}.`);
console.log(`Kept rows where Riya's own email fails the linter: ${wrongChecks.length}${wrongChecks.length ? " -> those checks are wrong: " + JSON.stringify(wrongChecks) : " (every clean Riya email passes, so the checks are consistent with her)"}.`);
if (wrongChecks.length) process.exit(1);
