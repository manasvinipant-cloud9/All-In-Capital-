// Real model transports. NOT TESTED against live services: needs keys. Local runs go through Portkey; production calls OpenRouter directly.
import type { Transport } from "./index.ts";

export function realTransport(env: Record<string, string | undefined> = process.env): Transport | null {
  const route = env.MODEL_ROUTE ?? (env.NODE_ENV === "production" ? "openrouter" : "portkey");
  const url = route === "openrouter" ? "https://openrouter.ai/api/v1/chat/completions" : "https://api.portkey.ai/v1/chat/completions";
  const headers: Record<string, string> | null = route === "openrouter"
    ? env.OPENROUTER_API_KEY ? { Authorization: `Bearer ${env.OPENROUTER_API_KEY}` } : null
    : env.PORTKEY_API_KEY && env.PORTKEY_VIRTUAL_KEY ? { "x-portkey-api-key": env.PORTKEY_API_KEY, "x-portkey-virtual-key": env.PORTKEY_VIRTUAL_KEY } : null;
  if (!headers) return null;
  return async (model, req) => {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, signal: AbortSignal.timeout(120000),
      body: JSON.stringify({ model, temperature: req.temperature, messages: [{ role: "system", content: req.system }, { role: "user", content: req.user }], usage: { include: true } }) });
    if (!r.ok) throw Object.assign(new Error(`model route ${r.status}`), { status: r.status });
    const j = await r.json();
    return { text: j.choices?.[0]?.message?.content ?? "", tokensIn: j.usage?.prompt_tokens, tokensOut: j.usage?.completion_tokens, costUsd: typeof j.usage?.cost === "number" ? j.usage.cost : 0 };
  };
}
export const modelNames = (env: Record<string, string | undefined> = process.env) => (env.MODEL_PRIMARY && env.MODEL_FALLBACK ? { primary: env.MODEL_PRIMARY, fallback: env.MODEL_FALLBACK } : null);
