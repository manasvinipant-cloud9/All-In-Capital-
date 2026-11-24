import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
export type ThreadState = "sent" | "reoffered" | "booked" | "needs_riya";
export type Meeting = { start: string; end: string; meetLink: string; calendarLink: string; eventId: string; withAditya: boolean; confirmationSent: boolean };
export type Thread = { id: string; slug: string; company: string; founderName: string; founderEmail: string; deeptech: boolean; state: ThreadState;
  offered: string[]; reoffers: number; sentAt: string; processed: string[]; claimedBy?: string; meeting?: Meeting };
const FILE = ".local/store.json";
export class Store {
  threads = new Map<string, Thread>();
  constructor(private persist = false) { if (persist && existsSync(FILE)) for (const t of JSON.parse(readFileSync(FILE, "utf8")) as Thread[]) this.threads.set(t.id, t); }
  save() { if (!this.persist) return; mkdirSync(".local", { recursive: true }); writeFileSync(FILE, JSON.stringify([...this.threads.values()], null, 2)); }
  put(t: Thread) { this.threads.set(t.id, t); this.save(); }
  /** Atomic claim so two runs cannot both act on one thread. */
  claim(id: string, by: string) { const t = this.threads.get(id); if (!t || t.claimedBy) return false; t.claimedBy = by; return true; }
  release(id: string) { const t = this.threads.get(id); if (t) { delete t.claimedBy; this.save(); } }
  open() { return [...this.threads.values()].filter(t => t.state === "sent" || t.state === "reoffered" || (t.state === "booked" && t.meeting && !t.meeting.confirmationSent)); }
}
export const appStore = () => new Store(true);
