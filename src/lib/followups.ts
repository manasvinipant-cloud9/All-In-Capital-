// Follow-ups are PREPARED, never sent. After 3 working days of silence a draft with two fresh free times waits for Riya's click.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { parseForm } from "./pipeline/ingest.ts";
import { followupDue } from "./schedule/auto.ts";
import type { Store } from "./schedule/store.ts";
import { candidateSlots, fillSlots, type Busy } from "./email/slots.ts";
import { firstName, pickFact } from "./email/offline.ts";

export type Followup = { id: string; threadId: string; slug: string; company: string; to: string; subject: string; body: string; offered: string[]; createdAt: string; status: "ready" | "sent" };
const FILE = ".local/followups.json";
export const loadFollowups = (): Followup[] => (existsSync(FILE) ? JSON.parse(readFileSync(FILE, "utf8")) : []);
export const saveFollowups = (f: Followup[]) => { mkdirSync(".local", { recursive: true }); writeFileSync(FILE, JSON.stringify(f, null, 2)); };

export const followupText = (first: string, fact: string) =>
  `Hi ${first},\nOne follow-up on this number: ${fact}.\nWould {slot_1} or {slot_2} work for a 30-minute call? If neither suits you, reply with a time that does.\nRiya`;

/** One follow-up per thread, only while the founder has not replied. Uses no model, so it runs even when the spend cap has paused the queue. */
export function prepareFollowups(d: { store: Store; now: Date; busy?: Busy[] }): Followup[] {
  const have = loadFollowups(), made: Followup[] = [];
  for (const t of d.store.threads.values()) {
    if (t.state !== "sent" || t.processed.length > 0 || have.some(f => f.threadId === t.id)) continue;
    if (!followupDue(new Date(t.sentAt), d.now, false)) continue;
    const slots = candidateSlots({ now: d.now, busy: d.busy });
    if (slots.length < 2) continue;
    const form = parseForm(readFileSync(`seed/forms/${t.slug}.json`, "utf8"));
    made.push({ id: `fu-${t.id}`, threadId: t.id, slug: t.slug, company: t.company, to: t.founderEmail, subject: "Following up on your application",
      body: fillSlots(followupText(firstName(t.founderName), pickFact(form).fact), slots), offered: slots.map(s => s.toISOString()), createdAt: d.now.toISOString(), status: "ready" });
  }
  if (made.length) saveFollowups([...have, ...made]);
  return made;
}
