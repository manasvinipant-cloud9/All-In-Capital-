// Model drafting through the gateway: up to 3 generations, each told exactly what failed. The linter decides, not the model.
import { callModel, type Transport } from "../gateway/index.ts";
import { redact } from "../gateway/guards.ts";
import { lint, type Issue, type Template } from "./lint.ts";

export async function draftEmail(o: { template: Template; facts: string; examples: string[]; founders: string[]; deeptech?: boolean; transport: Transport; primary: string; fallback: string; note?: string }) {
  let issues: Issue[] = [], last = { subject: "", body: "" };
  for (let attempt = 0; attempt < 3; attempt++) {
    const system = `Write a ${o.template} email in Riya's voice. Short. One specific number and why it is unusual, one sharp question, then the ask. Use {slot_1} and {slot_2} for times. Sign "Riya" then "All In Capital". Return JSON {subject, body}. Examples of her real emails:\n${o.examples.join("\n---\n")}`
      + (issues.length ? `\nYour last draft failed these checks, fix them: ${issues.map(i => `${i.rule}: ${i.msg}`).join("; ")}` : "") + (o.note ? `\nRiya's note: ${o.note}` : "");
    const r = await callModel({ step: "draft_email", system, user: redact(o.facts, o.founders).text, temperature: attempt === 0 ? 0.2 : 0.4 }, { transport: o.transport, primary: o.primary, fallback: o.fallback });
    last = JSON.parse(r.text);
    issues = lint({ template: o.template, subject: last.subject, body: last.body, deeptech: o.deeptech });
    if (!issues.length) return { ...last, issues, attempts: attempt + 1, passed: true };
  }
  return { ...last, issues, attempts: 3, passed: false };
}
/** Three of Riya's real sent emails, most similar (same sector) first. */
export function nearestExamples(rows: { sector: string; riya_final_email: string; system_draft: string }[], sector: string, n = 3) {
  return rows.filter(r => r.riya_final_email !== r.system_draft && r.riya_final_email.split(/\s+/).length < 80).sort((a, b) => Number(b.sector === sector) - Number(a.sector === sector)).slice(0, n).map(r => r.riya_final_email);
}
