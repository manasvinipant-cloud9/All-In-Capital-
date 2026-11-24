// What the 5-minute trigger does. (a) automatic scheduling, which uses no model so it runs even when the spend cap has paused the queue; (b) up to one application.
import { autoSchedule, type Action, type CalendarPort, type MailPort } from "./schedule/auto.ts";
import type { Store } from "./schedule/store.ts";
import { enqueue, jobs, processNext, type Handler, type Job } from "./queue.ts";
import { listMeta } from "./apps.ts";
import { loadScored } from "./scored.ts";
import { isPaused } from "./spend.ts";
import { prepareFollowups } from "./followups.ts";

export async function runCron(d: { now: Date; store: Store; mail?: MailPort; cal?: CalendarPort; handler: Handler; paused?: boolean; aditya?: string }) {
  const out: { scheduler: Action[] | "skipped: Gmail and Calendar are not connected"; queue: Job | null | "paused: daily spend cap reached"; followupsPrepared: number; queued: number } = { scheduler: "skipped: Gmail and Calendar are not connected", queue: null, followupsPrepared: 0, queued: 0 };
  if (d.mail && d.cal) out.scheduler = await autoSchedule({ store: d.store, mail: d.mail, cal: d.cal, now: d.now, aditya: d.aditya });
  const busy = d.cal ? await d.cal.freeBusy(d.now, new Date(d.now.getTime() + 60 * 86400000)) : [];
  out.followupsPrepared = prepareFollowups({ store: d.store, now: d.now, busy }).length;
  // Any application that has no job and no saved score joins the queue, so nothing waits unnoticed.
  const known = new Set(jobs().map(j => j.slug));
  for (const m of listMeta()) if (!known.has(m.slug) && !loadScored(m.slug)) { enqueue(m.slug, d.now); out.queued++; }
  const paused = d.paused ?? isPaused(d.now);
  out.queue = paused ? "paused: daily spend cap reached" : await processNext(d.handler, d.now);
  return out;
}
