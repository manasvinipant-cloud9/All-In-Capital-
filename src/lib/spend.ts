// File-backed llm_calls ledger (dev) and the daily spend cap. The cap pauses the queue and resumes on its own after midnight IST.
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { ist } from "./ist.ts";
import { setLedger, type CallLog } from "./gateway/index.ts";
import { langfuseSink } from "./gateway/trace.ts";

const FILE = ".local/llm_calls.jsonl";
export const readCalls = (): CallLog[] => (existsSync(FILE) ? readFileSync(FILE, "utf8").split("\n").filter(Boolean).map(l => JSON.parse(l)) : []);
export function installLedger() {
  const lf = langfuseSink();
  setLedger(c => { mkdirSync(".local", { recursive: true }); appendFileSync(FILE, JSON.stringify(c) + "\n"); lf?.(c); });
}
export const istDay = (d: Date) => { const t = ist(d); return `${t.y}-${String(t.mo + 1).padStart(2, "0")}-${String(t.d).padStart(2, "0")}`; };
export const spentOn = (day: string, calls = readCalls()) => calls.filter(c => istDay(new Date(c.at)) === day).reduce((a, c) => a + c.costUsd, 0);
/** Paused when today's (IST) spend has reached the cap. A new IST day starts at zero, so it resumes by itself. No cap set means never paused. */
export function isPaused(now: Date, calls = readCalls(), cap = parseFloat(process.env.DAILY_SPEND_CAP_USD ?? "")) {
  return Number.isFinite(cap) && cap > 0 && spentOn(istDay(now), calls) >= cap;
}
