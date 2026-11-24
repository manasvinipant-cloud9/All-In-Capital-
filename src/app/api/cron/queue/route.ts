import { timingSafeEqual } from "node:crypto";
import { runCron } from "../../../../lib/cron";
import { appStore } from "../../../../lib/schedule/store";
import { googleCalendar, googleMail, googleConnected } from "../../../../lib/google";
import { processApplication } from "../../../../lib/process";
import { installLedger } from "../../../../lib/spend";
export const maxDuration = 300;

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
/** Accepts CRON_SECRET (the backup GitHub Action) or the token held in Supabase Vault, checked by the security-definer function check_cron_token. */
async function authorized(req: Request): Promise<boolean> {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  if (!token) return false;
  if (process.env.CRON_SECRET && same(token, process.env.CRON_SECRET)) return true;
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
    const { createClient } = await import("@supabase/supabase-js");
    const { data } = await createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY).rpc("check_cron_token", { token });
    return data === true;
  }
  return false;
}
export async function GET(req: Request) {
  if (!(await authorized(req))) return new Response("unauthorized", { status: 401 });
  installLedger();
  const connected = googleConnected();
  return Response.json(await runCron({ now: new Date(), store: appStore(), mail: connected ? googleMail : undefined, cal: connected ? googleCalendar : undefined, handler: processApplication, aditya: process.env.PARTNER_EMAILS?.split(",")[1]?.trim() }));
}
