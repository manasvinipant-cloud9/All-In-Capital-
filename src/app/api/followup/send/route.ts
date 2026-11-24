import { lint } from "../../../../lib/email/lint";
import { recheckForSend } from "../../../../lib/email/slots";
import { googleCalendar, googleConnected, googleMail } from "../../../../lib/google";
import { loadFollowups, saveFollowups } from "../../../../lib/followups";
import { appStore } from "../../../../lib/schedule/store";
import { addMin } from "../../../../lib/ist";

// A follow-up goes out only after Riya's click and a confirmation that names the recipient. Same thread, same checks as the first letter.
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const all = loadFollowups(), f = all.find(x => x.id === b.id && x.status === "ready");
  if (!f) return Response.json({ error: "not_found", message: "That follow-up is not waiting any more." }, { status: 404 });
  if (!googleConnected()) return Response.json({ error: "gmail_not_connected", message: "Connect Gmail to send." }, { status: 409 });
  if (b.confirmRecipient !== f.to) return Response.json({ error: "confirm_recipient", message: "Confirm the recipient to send." }, { status: 400 });
  const body = String(b.body ?? f.body), issues = lint({ template: "followup", subject: f.subject, body });
  if (issues.length) return Response.json({ error: "lint", message: issues.map(i => i.msg).join(" "), issues }, { status: 422 });
  const now = new Date(), busy = await googleCalendar.freeBusy(now, addMin(now, 60 * 24 * 60));
  const r = await recheckForSend({ body, offered: f.offered.map(s => new Date(s)), now, busy, isFree: async s => (await googleCalendar.freeBusy(s, addMin(s, 30))).length === 0 });
  const store = appStore(), t = store.threads.get(f.threadId);
  if (!t) return Response.json({ error: "no_thread", message: "The original thread was not found." }, { status: 404 });
  await googleMail.sendInThread(t, r.body);
  t.offered = r.offered.map(s => s.toISOString()); store.put(t);
  saveFollowups(all.map(x => (x.id === f.id ? { ...x, status: "sent" as const } : x)));
  return Response.json({ ok: true });
}
