// Deterministic linter. The model only drafts; this decides. Pure code, safe to import in the browser.
export type Template = "invite" | "dig" | "pass" | "followup";
export type Issue = { rule: string; msg: string };
const PRAISE = /\b(impressive|exciting|excited|love|great|amazing|fantastic|incredible|fascinating|caught our eye|exactly the kind)\b/i;
const BANNED = /\b(delve|leverage|utilize|utilise|robust|cutting-edge|game-changer|transformative|reach out|touch base|circle back|synergy)\b|hope this finds you/i;
const ACCUSE = /\b(lied|lie|fake|fraud|misled|misleading|dishonest|false|inflated|fabricated)\b/i;
const THROAT = /^(i hope|i wanted to|i am writing|i'm writing|just following|i'm reaching|i am reaching|thank you for (your|the) application)/i;
const SUMMARY_SIGNOFF = /(looking forward|hope to hear|in summary|to sum up|let me know if you have any)/i;
const NOT_X_BUT_Y = /\bnot (?:just |only |merely )?[\w-]+(?: [\w-]+){0,3}(?:,| —)? but\b/i;
// Riya's real offer is two dates, "Tuesday 20 May or Thursday 22 May, in the afternoon". A clock time is optional.
const OFFER_DAY = /\b(Tuesday|Thursday),?\s+\d{1,2}\s+[A-Z][a-z]{2,8}\b/g;
const OTHER_DAY = /\b(Monday|Wednesday|Friday|Saturday|Sunday),?\s+\d{1,2}\s+[A-Z][a-z]{2,8}\b/g;
const NUMBER_WORD = /\b(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|hundred|thousand|half|double|triple)\b/i;
const wc = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

export function lint(o: { template: Template; subject: string; body: string; deeptech?: boolean }): Issue[] {
  const { template: t, subject, body } = o, v: Issue[] = [];
  const add = (rule: string, msg: string) => v.push({ rule, msg });
  const max = t === "invite" ? 80 : 120;
  if (wc(body) > max) add("length", `${wc(body)} words; ${t} emails allow ${max}`);
  if (wc(subject) > 7 || wc(subject) === 0) add("subject", "Subject must be 1 to 7 words");
  const lines = body.trim().split("\n").map(l => l.trim()).filter(Boolean);
  const first = lines.find((l, i) => !(i === 0 && /^hi\b/i.test(l))) ?? "";
  if (t !== "pass" && !(/\d/.test(first.split(/(?<=[.!?])\s/)[0] ?? "") || NUMBER_WORD.test(first.split(/(?<=[.!?])\s/)[0] ?? ""))) add("first-number", "First sentence must cite a number");
  const q = (body.match(/\?/g) ?? []).length;
  if (t === "invite") {
    const real = (body.match(OFFER_DAY) ?? []).length, placeholders = body.includes("{slot_1}") && body.includes("{slot_2}");
    if (!placeholders && real < 2) add("slots", "Invite needs two Tuesday or Thursday dates (or {slot_1} and {slot_2})");
    if (OTHER_DAY.test(body)) add("slot-day", "Offer Tuesday or Thursday afternoons only");
    if (q < 1 || q > 2) add("questions", `Invite needs 1 to 2 question marks, has ${q}`);
    if (!placeholders) {   // dates only: say "afternoon". Clock times: they must fall in the afternoon (12:00 to 18:00).
      const times = [...body.matchAll(/\b(\d{1,2})(?::(\d{2}))?\s?(am|pm)\b/gi)].map(m => ((+m[1] % 12) + (m[3].toLowerCase() === "pm" ? 12 : 0)) * 60 + +(m[2] ?? 0));
      if (times.length ? times.some(t => t < 12 * 60 || t >= 18 * 60) : !/afternoon/i.test(body)) add("afternoon", "Offer afternoon times only (say \"afternoon\", or give times between 12 and 6 pm)");
    }
    if (PRAISE.test(body)) add("praise", "No praise words in invites");
    if (o.deeptech && !/Aditya/.test(body)) add("aditya", "Deeptech or hardware: say that Aditya will join");
  } else if (t === "dig") { if (q < 1 || q > 2) add("questions", `Dig emails ask 1 to 2 questions, has ${q}`); }
  else if (q > 1) add("questions", `${t} emails ask at most 1 question, has ${q}`);
  if (t === "pass" && ACCUSE.test(body)) add("accuse", "Pass emails never accuse");
  if (!/(^|\n)Riya\s*(\n\s*All In Capital\s*)?$/.test(body.trim())) add("signoff", 'Sign off with "Riya"' + (t === "invite" ? ", then All In Capital on the next line" : ""));
  else if (t === "invite" && !/Riya\s*\n\s*All In Capital\s*$/.test(body.trim())) add("signoff", "Invite: Riya, then All In Capital on the next line");
  if (/—|–/.test(body + subject)) add("dash", "No em dashes");
  if (BANNED.test(body)) add("banned", `Banned wording: ${body.match(BANNED)![0]}`);
  if (NOT_X_BUT_Y.test(body)) add("not-but", 'Avoid "not X but Y"');
  if (lines.some(l => THROAT.test(l))) add("throat", "No throat-clearing opener");
  if (SUMMARY_SIGNOFF.test(body)) add("summary-signoff", "No summary sign-off");
  return v;
}
