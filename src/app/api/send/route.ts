import { lint } from "../../../lib/email/lint";
import { recheckForSend } from "../../../lib/email/slots";
import { googleConnected, googleCalendar, sendFirstEmail } from "../../../lib/google";
import { appStore } from "../../../lib/schedule/store";
import { addMin } from "../../../lib/ist";
import { addStyleExample } from "../../../lib/email/examples";

// First letter: sent only after Riya's click and a confirmation that names the recipient.
export async function POST(req: Request) {
  const b = await req.json();
  if (!googleConnected()) return Response.json({ error: "gmail_not_connected", message: "Connect Gmail to send." }, { status: 409 });
  if (b.confirmRecipient !== b.to) return Response.json({ error: "confirm_recipient" }, { status: 400 });
  const issues = lint({ template: "invite", subject: b.subject, body: b.body, deeptech: b.deeptech });
  if (issues.length) return Response.json({ error: "lint", issues }, { status: 422 });
  const now = new Date(), offered = (b.offered as string[]).map(s => new Date(s));
  const busy = await googleCalendar.freeBusy(now, addMin(now, 60 * 24 * 60));
  const r = await recheckForSend({ body: b.body, offered, now, busy, isFree: async s => (await googleCalendar.freeBusy(s, addMin(s, 30))).length === 0 });
  const { gmailThreadId } = await sendFirstEmail(b.to, b.subject, r.body);
  if (typeof b.original === "string" && b.original !== b.body && typeof b.sector === "string") addStyleExample({ sector: b.sector, body: r.body });  // an edited email becomes an example
  const store = appStore();
  store.put({ id: gmailThreadId, gmailThreadId, slug: b.slug, company: b.company, founderName: b.founderName, founderEmail: b.to, deeptech: !!b.deeptech, state: "sent", offered: r.offered.map(s => s.toISOString()), reoffers: 0, sentAt: now.toISOString(), processed: [] } as any);
  return Response.json({ ok: true, swapped: r.swapped, riyaEdited: r.riyaEdited });
}
