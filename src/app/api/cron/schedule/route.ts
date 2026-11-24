import { autoSchedule } from "../../../../lib/schedule/auto";
import { googleCalendar, googleMail, googleConnected } from "../../../../lib/google";
import { appStore } from "../../../../lib/schedule/store";
export const maxDuration = 300;
// Runs every 5 minutes (pg_cron in phase 6). Uses no model, so it keeps running when the spend cap pauses the queue.
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) return new Response("unauthorized", { status: 401 });
  if (!googleConnected()) return Response.json({ skipped: "gmail_not_connected" });
  const log = await autoSchedule({ store: appStore(), mail: googleMail, cal: googleCalendar, now: new Date(), aditya: process.env.PARTNER_EMAILS?.split(",")[1] });
  return Response.json({ log });
}
