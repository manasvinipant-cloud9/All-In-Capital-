// Deterministic reply parser. Never a model. Refusals are not proposals.
import { fromIST, ist, WD, MON } from "../ist.ts";
export type Parsed = { kind: "pick"; index: number } | { kind: "propose"; start: Date } | { kind: "refusal" } | { kind: "unclear" };

export function stripQuoted(text: string): string {
  const out: string[] = [];
  for (const line of text.split("\n")) {
    if (/^\s*>/.test(line) || /^On .{5,120} wrote:\s*$/i.test(line.trim()) || /^(--|Sent from my|Get Outlook)/i.test(line.trim()) || /^-{2,}\s*Original Message/i.test(line)) break;
    out.push(line);
  }
  return out.join("\n").trim();
}
const WDN = WD.map(w => w.toLowerCase());
const TIME12 = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i, TIME24 = /\b([01]?\d|2[0-3]):([0-5]\d)\b/;
const MONRE = MON.map(m => m.toLowerCase()).join("|");
const D_MON = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(${MONRE})[a-z]*\\b`, "i"), MON_D = new RegExp(`\\b(${MONRE})[a-z]*\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`, "i");
const REFUSE = /\b(can't|cant|cannot|can not|won't|unable|not able|doesn't|does not|don't|do not|not free|busy|clash|conflict|unavailable|no longer)\b/i;

function timeOf(s: string): { h: number; m: number } | null {
  const a = s.match(TIME12); if (a) { let h = parseInt(a[1]) % 12; if (a[3].toLowerCase() === "pm") h += 12; return { h, m: parseInt(a[2] ?? "0") }; }
  const b = s.match(TIME24); return b ? { h: parseInt(b[1]), m: parseInt(b[2]) } : null;
}
function dateOf(s: string, now: Date): { y: number; mo: number; d: number } | null {
  const t = ist(now), low = s.toLowerCase();
  if (/\btomorrow\b/.test(low)) { const x = ist(fromIST(t.y, t.mo, t.d + 1, 12)); return { y: x.y, mo: x.mo, d: x.d }; }
  const dm = low.match(D_MON), md = low.match(MON_D);
  const pick = dm ? [parseInt(dm[1]), dm[2]] : md ? [parseInt(md[2]), md[1]] : null;
  if (pick) { const mo = MON.findIndex(m => m.toLowerCase() === (pick[1] as string).slice(0, 3).toLowerCase()); let y = t.y; if (fromIST(y, mo, pick[0] as number, 23, 59) < now) y++; return { y, mo, d: pick[0] as number }; }
  const w = WDN.findIndex(n => new RegExp(`\\b${n}\\b`).test(low));
  if (w >= 0) { let add = (w - t.wd + 7) % 7; if (add === 0) add = 7; const x = ist(fromIST(t.y, t.mo, t.d + add, 12)); return { y: x.y, mo: x.mo, d: x.d }; }
  return null;
}
const weekdayIn = (s: string) => WDN.findIndex(n => new RegExp(`\\b${n}\\b`, "i").test(s));

export function parseReply(raw: string, offered: Date[], now: Date): Parsed {
  const text = stripQuoted(raw); let refused = false;
  for (let sent of text.split(/(?<=[.!?])\s+|\n+/).map(s => s.trim()).filter(Boolean)) {
    const alt = sent.match(/\b(?:but|instead|how about|rather|what about)\b(.*)$/i);
    if (REFUSE.test(sent)) { if (!alt) { refused = true; continue; } sent = alt[1]; refused = true; }
    const low = sent.toLowerCase();
    const isQ = sent.includes("?");
    const ORD = "(?:one|option|slot|time|choice|suggestion)";
    if (!isQ && /\b(either|both)\b[^.]*\b(work|works|fine|good|ok|okay)\b/.test(low)) return { kind: "pick", index: 0 };
    if (!isQ && new RegExp(`\\b(?:second|2nd|latter)\\s+${ORD}\\b|\\b${ORD}\\s+(?:two|2)\\b`).test(low) && offered[1]) return { kind: "pick", index: 1 };
    if (!isQ && new RegExp(`\\b(?:first|1st|former)\\s+${ORD}\\b|\\b${ORD}\\s+(?:one|1)\\b`).test(low) && offered[0]) return { kind: "pick", index: 0 };
    const tm = timeOf(sent), dt = dateOf(sent, now);
    if (dt && tm) {
      const start = fromIST(dt.y, dt.mo, dt.d, tm.h, tm.m);
      const idx = offered.findIndex(o => o.getTime() === start.getTime());
      return idx >= 0 ? { kind: "pick", index: idx } : { kind: "propose", start };
    }
    const w = weekdayIn(sent);
    if (w >= 0 && !tm && !isQ) { const m = offered.map((o, i) => [i, ist(o).wd] as const).filter(([, d]) => d === w); if (m.length === 1) return { kind: "pick", index: m[0][0] }; }
  }
  return refused ? { kind: "refusal" } : { kind: "unclear" };
}
/** Weekday, starts at 10:00 or later, ends by 19:00 IST, in the future, within 30 days. */
export function inHours(start: Date, now: Date): boolean {
  const t = ist(start), end = new Date(start.getTime() + 30 * 60000), e = ist(end);
  return t.wd >= 1 && t.wd <= 5 && t.h >= 10 && (e.h < 19 || (e.h === 19 && e.mi === 0)) && e.d === t.d && start > now && start.getTime() - now.getTime() <= 30 * 86400000;
}
