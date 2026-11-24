// Langfuse tracing for every model call (fire and forget). No-op without keys. NOT TESTED against live Langfuse.
import type { CallLog } from "./index.ts";
export function langfuseSink(env: Record<string, string | undefined> = process.env): ((c: CallLog) => void) | null {
  if (!env.LANGFUSE_PUBLIC_KEY || !env.LANGFUSE_SECRET_KEY) return null;
  const host = env.LANGFUSE_HOST ?? "https://cloud.langfuse.com", auth = "Basic " + Buffer.from(`${env.LANGFUSE_PUBLIC_KEY}:${env.LANGFUSE_SECRET_KEY}`).toString("base64");
  return c => { void fetch(`${host}/api/public/ingestion`, { method: "POST", headers: { Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify({ batch: [{ id: crypto.randomUUID(), type: "generation-create", timestamp: c.at, body: { name: c.step, model: c.model, usage: { input: c.tokensIn, output: c.tokensOut }, metadata: { application: c.application, cached: c.cached, retries: c.retries, fellBack: c.fellBack, ok: c.ok, latencyMs: c.latencyMs } } }] }) }).catch(() => {}); };
}
