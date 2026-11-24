import { draftForApp } from "../../../lib/email/draftApp";
import { modelNames, realTransport } from "../../../lib/gateway/transport";
import { installLedger } from "../../../lib/spend";
import { isPaused } from "../../../lib/spend";

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  if (typeof b.slug !== "string") return Response.json({ error: "bad_request" }, { status: 400 });
  const transport = realTransport(), names = modelNames();
  if (!transport || !names) return Response.json({ error: "no_model", message: "Drafting with the model needs a model key, which is not set up yet. Edit the draft by hand." }, { status: 503 });
  if (isPaused(new Date())) return Response.json({ error: "paused", message: "New drafts are on hold for today and will continue after midnight." }, { status: 503 });
  installLedger();
  try {
    return Response.json(await draftForApp(b.slug, { transport, names, note: typeof b.note === "string" ? b.note : undefined }));
  } catch (e: any) {
    return Response.json({ error: "draft_failed", message: e?.status === 429 ? "The writing service is busy. Try again in a minute." : "Could not draft this one. Try again, or edit by hand." }, { status: 502 });
  }
}
