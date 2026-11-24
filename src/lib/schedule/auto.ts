// Automatic scheduling. Uses no model. Ports are injected so it is testable without Google.
import { addMin, fmtSlot } from "../ist.ts";
import { candidateSlots, type Busy } from "../email/slots.ts";
import { inHours, parseReply } from "./parse.ts";
import type { Store, Thread } from "./store.ts";

export interface CalendarPort {
  freeBusy(start: Date, end: Date): Promise<Busy[]>;
  createEvent(o: { start: Date; end: Date; summary: string; attendees: string[] }): Promise<{ id: string; meetLink: string; calendarLink: string }>;
}
export interface MailPort {
  newReplies(t: Thread): Promise<{ id: string; text: string }[]>;
  sendInThread(t: Thread, body: string): Promise<void>;
}
export type Deps = { store: Store; mail: MailPort; cal: CalendarPort; now: Date; runId?: string; aditya?: string; founderOf?: (t: Thread) => string };
export type Action = { thread: string; did: "booked" | "reoffered" | "needs_riya" | "confirmation_retry" | "skipped_claimed" };

const isFree = async (cal: CalendarPort, s: Date) => (await cal.freeBusy(s, addMin(s, 30))).length === 0;

export async function autoSchedule(d: Deps): Promise<Action[]> {
  const log: Action[] = [], run = d.runId ?? Math.random().toString(36).slice(2);
  for (const t0 of d.store.open()) {
    if (!d.store.claim(t0.id, run)) { log.push({ thread: t0.id, did: "skipped_claimed" }); continue; }
    const t = d.store.threads.get(t0.id)!;
    try {
      // A recorded meeting whose note failed to send: retry the note only.
      if (t.meeting && !t.meeting.confirmationSent) { await confirm(d, t); log.push({ thread: t.id, did: "confirmation_retry" }); continue; }
      if (t.meeting) continue;
      for (const m of (await d.mail.newReplies(t)).filter(x => !t.processed.includes(x.id))) {
        t.processed.push(m.id);
        const offered = t.offered.map(s => new Date(s)), p = parseReply(m.text, offered, d.now);
        if (p.kind === "unclear" || p.kind === "refusal") { t.state = "needs_riya"; d.store.save(); log.push({ thread: t.id, did: "needs_riya" }); break; }
        const start = p.kind === "pick" ? offered[p.index] : p.start;
        // Re-check free/busy right before booking.
        if (inHours(start, d.now) && (await isFree(d.cal, start))) {
          const attendees = [t.founderEmail, ...(t.deeptech && d.aditya ? [d.aditya] : [])];
          const ev = await d.cal.createEvent({ start, end: addMin(start, 30), summary: `${t.company} x All In Capital (30 min)`, attendees });
          t.meeting = { start: start.toISOString(), end: addMin(start, 30).toISOString(), meetLink: ev.meetLink, calendarLink: ev.calendarLink, eventId: ev.id, withAditya: attendees.length > 1, confirmationSent: false };
          t.state = "booked"; d.store.save();          // record the event before sending the note
          await confirm(d, t); log.push({ thread: t.id, did: "booked" }); break;
        }
        if (t.reoffers >= 2) { t.state = "needs_riya"; d.store.save(); log.push({ thread: t.id, did: "needs_riya" }); break; }
        const busy = await d.cal.freeBusy(d.now, new Date(d.now.getTime() + 60 * 86400000));
        const [a, b] = candidateSlots({ now: d.now, busy, exclude: [start] });
        await d.mail.sendInThread(t, `That time clashes for me. Would ${fmtSlot(a)} or ${fmtSlot(b)} work instead?\nRiya`);
        t.offered = [a.toISOString(), b.toISOString()]; t.reoffers++; t.state = "reoffered"; d.store.save();
        log.push({ thread: t.id, did: "reoffered" }); break;
      }
      d.store.save();
    } finally { d.store.release(t.id); }
  }
  return log;
}
async function confirm(d: Deps, t: Thread) {
  await d.mail.sendInThread(t, `Booked for ${fmtSlot(new Date(t.meeting!.start))}. The Meet link is in your calendar invite.\nRiya`);
  t.meeting!.confirmationSent = true; d.store.save();
}

/** Follow-up is prepared (never sent) when there is no reply after 3 working days. */
export function followupDue(sentAt: Date, now: Date, replied: boolean): boolean {
  if (replied) return false;
  let wd = 0; const c = new Date(sentAt);
  while (c < now && wd < 3) { c.setUTCDate(c.getUTCDate() + 1); const day = new Date(c.getTime() + 330 * 60000).getUTCDay(); if (day !== 0 && day !== 6 && c <= now) wd++; }
  return wd >= 3;
}
