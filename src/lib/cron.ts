// What the 5-minute trigger does. (a) automatic scheduling, which uses no model so it runs even when the spend cap has paused the queue; (b) up to one application.
import { autoSchedule, type Action, type CalendarPort, type MailPort } from "./schedule/auto.ts";
import type { Store } from "./schedule/store.ts";
import { processNext, type Handler, type Job } from "./queue.ts";
import { isPaused } from "./spend.ts";

export async function runCron(d: { now: Date; store: Store; mail?: MailPort; cal?: CalendarPort; handler: Handler; paused?: boolean; aditya?: string }) {
  const out: { scheduler: Action[] | "skipped: Gmail and Calendar are not connected"; queue: Job | null | "paused: daily spend cap reached" } = { scheduler: "skipped: Gmail and Calendar are not connected", queue: null };
  if (d.mail && d.cal) out.scheduler = await autoSchedule({ store: d.store, mail: d.mail, cal: d.cal, now: d.now, aditya: d.aditya });
  const paused = d.paused ?? isPaused(d.now);
  out.queue = paused ? "paused: daily spend cap reached" : await processNext(d.handler, d.now);
  return out;
}
