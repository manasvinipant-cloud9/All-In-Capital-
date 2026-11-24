// Step 1: which loop is a fine-tuning candidate? Count how often each change appears, in both exports.
import { changeTags, loop1, loop2, words, writeJson } from "./lib.ts";

const l2 = loop2().slice(0, 58);                      // the last two rows are the planted dirty rows
const rewritten = l2.filter(r => r.riya_final_email !== r.system_draft);
const tagCount = new Map<string, number>();
let covered = 0;
for (const r of rewritten) {
  const tags = changeTags(r.system_draft, r.riya_final_email);
  for (const t of tags) tagCount.set(t, (tagCount.get(t) ?? 0) + 1);
  if (tags.length >= 3) covered++;
}
const l1 = loop1(), over = l1.filter(r => r.riya_final_call !== r.system_call);
const reasons = new Map<string, number>();
for (const r of over) reasons.set(r.riya_reason, (reasons.get(r.riya_reason) ?? 0) + 1);
const top3 = [...reasons.values()].sort((a, b) => b - a).slice(0, 3).reduce((a, b) => a + b, 0);

const result = {
  loop2: { rows: l2.length, rewritten: rewritten.length, rewriteRate: +(rewritten.length / l2.length).toFixed(3), coveredBy3PlusRules: covered, coverage: +(covered / rewritten.length).toFixed(3), tags: Object.fromEntries([...tagCount].sort((a, b) => b[1] - a[1])), avgDraftWords: +(l2.reduce((a, r) => a + words(r.system_draft), 0) / l2.length).toFixed(1), avgFinalWords: +(rewritten.reduce((a, r) => a + words(r.riya_final_email), 0) / rewritten.length).toFixed(1) },
  loop1: { rows: l1.length, overturned: over.length, overturnRate: +(over.length / l1.length).toFixed(3), distinctReasons: reasons.size, top3ReasonShare: +(top3 / over.length).toFixed(3), reasons: Object.fromEntries([...reasons].sort((a, b) => b[1] - a[1])) },
};
const pick = result.loop2.coverage >= result.loop1.top3ReasonShare ? "loop2" : "loop1";
writeJson("step.json", { ...result, pick });
console.log(JSON.stringify({ ...result, pick }, null, 2));
console.log(`\nLoop 2: ${rewritten.length} of ${l2.length} rewritten; ${(result.loop2.coverage * 100).toFixed(0)}% of rewrites are explained by 3 or more fixed rules.`);
console.log(`Loop 1: ${over.length} of ${l1.length} overturned; each reason needs context about the thesis, not a fixed rule (${reasons.size} distinct reasons).`);
console.log(`Candidate step: ${pick}`);
