import { addMin, fmtSlot, fromIST, ist } from "../ist.ts";
export type Busy = { start: Date; end: Date };
export const SLOT_MIN = 30;
const overlaps = (s: Date, b: Busy[]) => { const e = addMin(s, SLOT_MIN); return b.some(x => s < x.end && e > x.start); };

/** Next free Tuesday/Thursday-afternoon (14:00-18:00 IST) 30-minute slots, one per day, at least leadHours ahead. */
export function candidateSlots(o: { now: Date; busy?: Busy[]; count?: number; leadHours?: number; exclude?: Date[]; days?: number[] }): Date[] {
  const { now, busy = [], count = 2, leadHours = 24, exclude = [], days = [2, 4] } = o;
  const t0 = ist(now), out: Date[] = [];
  for (let off = 0; off < 90 && out.length < count; off++) {
    const day = ist(fromIST(t0.y, t0.mo, t0.d + off, 12));
    if (!days.includes(day.wd)) continue;
    for (let m = 14 * 60; m + SLOT_MIN <= 18 * 60; m += SLOT_MIN) {
      const s = fromIST(day.y, day.mo, day.d, Math.floor(m / 60), m % 60);
      if (s.getTime() < now.getTime() + leadHours * 3600000 || overlaps(s, busy) || exclude.some(x => x.getTime() === s.getTime())) continue;
      out.push(s); break;
    }
  }
  return out;
}
export const fillSlots = (text: string, [a, b]: Date[]) => text.replace(/\{slot_1\}/g, fmtSlot(a)).replace(/\{slot_2\}/g, fmtSlot(b));

/** At send: both free keep; one taken swap in a fresh free slot; if Riya edited the times herself (offered text absent), send her text as written. */
export async function recheckForSend(o: { body: string; offered: Date[]; isFree: (s: Date) => Promise<boolean>; now: Date; busy?: Busy[] }) {
  let body = o.body; const offered = [...o.offered]; let swapped = 0;
  const present = offered.filter(s => body.includes(fmtSlot(s)));
  if (present.length === 0) return { body, offered, swapped, riyaEdited: true };
  for (let i = 0; i < offered.length; i++) {
    if (!body.includes(fmtSlot(offered[i])) || (await o.isFree(offered[i]))) continue;
    const [fresh] = candidateSlots({ now: o.now, busy: o.busy, count: 1, exclude: offered });
    if (!fresh) continue;
    body = body.split(fmtSlot(offered[i])).join(fmtSlot(fresh)); offered[i] = fresh; swapped++;
  }
  return { body, offered, swapped, riyaEdited: false };
}
