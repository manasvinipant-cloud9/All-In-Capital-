// Job queue with idempotent steps. File-backed for development and tests; production uses pgmq (see supabase/migrations). Adapter for Supabase: not built yet.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
export type Job = { id: string; slug: string; status: "queued" | "running" | "done" | "blocked" | "needs_look"; attempts: number; error?: string; reason?: string; steps: Record<string, string>; updatedAt: string };
const FILE = ".local/queue.json", STALE_MS = 10 * 60000;
const load = (): Job[] => (existsSync(FILE) ? JSON.parse(readFileSync(FILE, "utf8")) : []);
const save = (j: Job[]) => { mkdirSync(".local", { recursive: true }); writeFileSync(FILE, JSON.stringify(j, null, 2)); };
export const jobs = load;
export function enqueue(slug: string, now = new Date()): Job {
  const all = load(), have = all.find(j => j.slug === slug && (j.status === "queued" || j.status === "running"));
  if (have) return have;                                    // never queue the same application twice
  const j: Job = { id: `${slug}-${now.getTime()}`, slug, status: "queued", attempts: 0, steps: {}, updatedAt: now.toISOString() };
  save([...all, j]); return j;
}
export type Handler = (slug: string) => Promise<{ steps: Record<string, string>; blocked?: string }>;
export const PLAIN_ERROR = "Something went wrong reading this application. Open it and try again, or ask the analyst.";
/** One application per call. Two failed attempts mark it "Needs a look" with a plain reason. Never loses an application. */
export async function processNext(handler: Handler, now = new Date()): Promise<Job | null> {
  const all = load();
  const j = all.find(x => x.status === "queued" || (x.status === "running" && now.getTime() - new Date(x.updatedAt).getTime() > STALE_MS));
  if (!j) return null;
  j.status = "running"; j.updatedAt = now.toISOString(); save(all);
  try {
    const r = await handler(j.slug);
    j.steps = { ...j.steps, ...r.steps };
    if (r.blocked) { j.status = "blocked"; j.reason = r.blocked; } else { j.status = "done"; delete j.reason; }
    delete j.error;
  } catch (e: any) {
    j.attempts++; j.error = String(e?.message ?? e).slice(0, 200);
    if (j.attempts >= 2) { j.status = "needs_look"; j.reason = PLAIN_ERROR; } else j.status = "queued";
  }
  j.updatedAt = new Date().toISOString(); save(all); return j;
}
