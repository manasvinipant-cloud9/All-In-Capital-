// Offline draft (no model): builds an invite from a number in the application so Riya can edit. Placeholders are filled by the caller.
export const firstName = (full: string) => full.replace(/^(dr|mr|ms|mrs)\.?\s+/i, "").split(/\s+/)[0];
const FIELDS: [string, string][] = [
  ["Repeat behaviour", "Which channel brought the customers who came back?"], ["Repeat", "Which families came back, and how soon?"], ["Customers", "How many of those would pay again without a discount?"],
  ["Active customers", "How many of those come back each week?"], ["Rent volume", "How much of that is repeat payers?"], ["Revenue", "How much of that came from your first ten customers?"], ["Users", "How many of those are paying?"], ["Advances", "How many workers took a second advance?"],
];
/** The first clause of a form answer, kept short: "24 paying CA firms, 7 on free trial. 2 firms churned." becomes "24 paying CA firms". */
const clause = (v: string) => v.split(/[.,;(]/)[0].trim().split(/\s+/).slice(0, 12).join(" ");
export function pickFact(form: Record<string, string>) {
  const hit = FIELDS.find(([k]) => /\d/.test(clause(form[k] ?? ""))) ?? FIELDS[5];
  const v = clause(form[hit[0]] ?? "");
  return { fact: /\d/.test(v) ? v : "your traction", question: hit[1] };
}
export function offlineInvite(form: Record<string, string>, stage: string, sector: string, deeptech: boolean) {
  const { fact, question } = pickFact(form);
  const lines = [`Hi ${firstName(form["Founder name"] ?? "there")},`, `${fact} is unusual for a ${stage.toLowerCase()} ${sector.toLowerCase()} team. ${question}`];
  if (deeptech) lines.push("Our partner Aditya will join us for the technical part.");
  lines.push("Would 30 minutes on {slot_1} or {slot_2} work? If neither suits you, reply with a time that does.", "Riya", "All In Capital");
  return { subject: "A quick call about your traction", body: lines.join("\n") };
}
export const isDeeptech = (sector: string) => /deeptech|hardware/i.test(sector);
