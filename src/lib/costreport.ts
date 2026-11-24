import type { CallLog } from "./gateway/index.ts";
import { istDay } from "./spend.ts";

const sum = (xs: CallLog[]) => xs.reduce((a, c) => a + c.costUsd, 0);
const by = (xs: CallLog[], f: (c: CallLog) => string) => {
  const m = new Map<string, CallLog[]>();
  for (const c of xs) m.set(f(c), [...(m.get(f(c)) ?? []), c]);
  return [...m.entries()].sort();
};

/** Terminal cost report. Cost never appears in the UI. */
export function costReport(calls: CallLog[]): string {
  if (!calls.length) return "No model calls recorded yet.";
  const paid = calls.filter(c => !c.cached);
  const apps = new Set(calls.map(c => c.application).filter(Boolean));
  const line = (k: string, xs: CallLog[]) =>
    `${k.padEnd(28)} ${String(xs.length).padStart(5)} calls  ${("$" + sum(xs).toFixed(4)).padStart(10)}  cached ${xs.filter(c => c.cached).length}  failed ${xs.filter(c => !c.ok).length}`;
  return [
    `Calls: ${calls.length} (${calls.length - paid.length} from cache at zero cost). Failed: ${calls.filter(c => !c.ok).length}. Fell back to second model: ${calls.filter(c => c.fellBack).length}.`,
    `Average cost per paid call: $${(paid.length ? sum(paid) / paid.length : 0).toFixed(5)}`,
    apps.size
      ? `Average cost per application: $${(sum(calls) / apps.size).toFixed(4)} across ${apps.size} applications`
      : "Average cost per application: no calls are tagged with an application yet.",
    "",
    "By day (IST)",
    ...by(calls, c => istDay(new Date(c.at))).map(([k, v]) => line(k, v)),
    "",
    "By month (IST)",
    ...by(calls, c => istDay(new Date(c.at)).slice(0, 7)).map(([k, v]) => line(k, v)),
    "",
    "By step",
    ...by(calls, c => c.step).map(([k, v]) => line(k, v)),
    "",
    "By application",
    ...by(calls.filter(c => c.application), c => c.application!).map(([k, v]) => line(k, v)),
  ].join("\n");
}
