import { fmtSlot } from "./ist.ts";
import { appStore, type Thread } from "./schedule/store.ts";
export type Status = { kind: "none" | "waiting" | "reoffered" | "needs_you" | "booked"; text: string; meeting?: Thread["meeting"] };
export function statusOf(t?: Thread): Status {
  if (!t) return { kind: "none", text: "Not sent yet" };
  if (t.state === "booked" && t.meeting) return { kind: "booked", text: `Call booked for ${fmtSlot(new Date(t.meeting.start))}. It's on your Google Calendar with a Meet link.`, meeting: t.meeting };
  if (t.state === "needs_riya") return { kind: "needs_you", text: "Founder replied: needs you" };
  if (t.state === "reoffered") return { kind: "reoffered", text: `Two free times offered: ${t.offered.map(s => fmtSlot(new Date(s))).join(" or ")}` };
  return { kind: "waiting", text: `Waiting for the founder's time. Offered ${t.offered.map(s => fmtSlot(new Date(s))).join(" or ")}` };
}
export const threads = () => [...appStore().threads.values()];
export const threadFor = (slug: string) => threads().find(t => t.slug === slug);
