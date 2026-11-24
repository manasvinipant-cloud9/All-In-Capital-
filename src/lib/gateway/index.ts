// The ONLY module allowed to call a model (enforced by tests/gateway-only.test.ts).
import { createHash } from "node:crypto";
import { assertNoPII, withDataGuard } from "./guards.ts";

export type LlmRequest = { step: string; system: string; user: string; temperature?: number; json?: boolean; application?: string };
export type LlmResult = { text: string; model: string; cached: boolean; retries: number; fellBack: boolean; costUsd: number };
export type Reply = { text: string; costUsd?: number; tokensIn?: number; tokensOut?: number };
export type Transport = (model: string, req: Required<Pick<LlmRequest, "system" | "user">> & { temperature: number }) => Promise<Reply>;
export type CallLog = { at: string; step: string; application?: string; model: string; tokensIn: number; tokensOut: number; costUsd: number; latencyMs: number; retries: number; fellBack: boolean; cached: boolean; ok: boolean; error?: string };

const CACHE_TTL_MS = 30 * 24 * 3600 * 1000;
const cache = new Map<string, { at: number; text: string }>();
export const calls: CallLog[] = [];
let ledger: ((c: CallLog) => void) | null = null;
/** Where call logs go (file ledger, llm_calls table, Langfuse). Failures here never break a model call. */
export const setLedger = (fn: ((c: CallLog) => void) | null) => { ledger = fn; };
const record = (c: CallLog) => { calls.push(c); try { ledger?.(c); } catch {} };

export const cacheKey = (model: string, system: string, user: string) => createHash("sha256").update(model + "\0" + system + "\0" + user).digest("hex");
const retryable = (e: any) => e?.status === 429 || (e?.status >= 500 && e?.status < 600);
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function callModel(req: LlmRequest, o: { transport: Transport; primary: string; fallback: string; sleepFn?: (ms: number) => Promise<void>; validate?: (t: string) => boolean }): Promise<LlmResult> {
  const t0 = Date.now(), system = withDataGuard(req.system);
  assertNoPII(req.user); assertNoPII(system);
  const temperature = req.temperature ?? 0, wait = o.sleepFn ?? sleep, cacheable = temperature <= 0.2;
  const key = cacheKey(o.primary, system, req.user), hit = cache.get(key);
  const base = { at: new Date().toISOString(), step: req.step, application: req.application };
  if (cacheable && hit && Date.now() - hit.at < CACHE_TTL_MS && (o.validate?.(hit.text) ?? true)) {
    record({ ...base, model: o.primary, tokensIn: 0, tokensOut: 0, costUsd: 0, latencyMs: 0, retries: 0, fellBack: false, cached: true, ok: true });
    return { text: hit.text, model: o.primary, cached: true, retries: 0, fellBack: false, costUsd: 0 };
  }
  let retries = 0, lastErr: any;
  for (const [idx, model] of [o.primary, o.fallback].entries()) {
    for (let attempt = 0; attempt < (idx === 0 ? 4 : 1); attempt++) {
      try {
        const r = await o.transport(model, { system, user: req.user, temperature });
        if (cacheable) cache.set(key, { at: Date.now(), text: r.text });
        const out = { text: r.text, model, cached: false, retries, fellBack: idx === 1, costUsd: r.costUsd ?? 0 };
        record({ ...base, model, tokensIn: r.tokensIn ?? 0, tokensOut: r.tokensOut ?? 0, costUsd: out.costUsd, latencyMs: Date.now() - t0, retries, fellBack: idx === 1, cached: false, ok: true });
        return out;
      } catch (e: any) {
        lastErr = e;
        if (!retryable(e)) { record({ ...base, model, tokensIn: 0, tokensOut: 0, costUsd: 0, latencyMs: Date.now() - t0, retries, fellBack: idx === 1, cached: false, ok: false, error: `status ${e?.status ?? "?"}: ${String(e?.message ?? "error").slice(0, 120)}` }); throw e; }
        retries++;
        if (attempt < 3 && idx === 0) await wait(1000 * 2 ** attempt + Math.floor(Math.random() * 250));
      }
    }
  }
  record({ ...base, model: o.fallback, tokensIn: 0, tokensOut: 0, costUsd: 0, latencyMs: Date.now() - t0, retries, fellBack: true, cached: false, ok: false, error: `status ${lastErr?.status ?? "?"}: ${String(lastErr?.message ?? "failed").slice(0, 120)}` });
  throw lastErr;
}
export function clearCache() { cache.clear(); calls.length = 0; }
