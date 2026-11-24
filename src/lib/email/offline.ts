// Offline draft (no model): builds an invite from a number in the application so Riya can edit. Placeholders are filled by the caller.
export const firstName = (full: string) => full.replace(/^(dr|mr|ms|mrs)\.?\s+/i, "").split(/\s+/)[0];
const FIELDS: [string, string, string][] = [
  ["Repeat rate", "{v}", "Which channel brought the customers who came back?"],
  ["Paying customers", "{v}", "How many of those were still paying after three months?"],
  ["Pilots", "{v}", "Which of those would pay without the pilot discount?"],
  ["Revenue", "Revenue of {v}", "How much of that came from your first ten customers?"],
];
export function offlineInvite(form: Record<string, string>, stage: string, sector: string, deeptech: boolean) {
  const f = FIELDS.find(([k]) => /\d/.test(form[k] ?? "")) ?? FIELDS[3];
  const fact = f[1].replace("{v}", form[f[0]] ?? "your traction");
  const lines = [`Hi ${firstName(form["Founder name"] ?? "there")},`, `${fact} is unusual for a ${stage.toLowerCase()} ${sector.toLowerCase()} team. ${f[2]}`];
  if (deeptech) lines.push("Our partner Aditya will join us for the technical part.");
  lines.push("Would 30 minutes on {slot_1} or {slot_2} work? If neither suits you, reply with a time that does.", "Riya", "All In Capital");
  return { subject: "A quick call about your traction", body: lines.join("\n") };
}
export const isDeeptech = (sector: string) => /deeptech|hardware/i.test(sector);
