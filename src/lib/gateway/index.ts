// The ONLY module allowed to call a model (enforced by tests/gateway-only.test.ts).
import { createHash } from "node:crypto";
import { assertNoPII, withDataGuard } from "./guards.ts";

export type LlmRequest = { step: string; system: string; user: string; temperature?: number; json?: boolean };
export type LlmResult = { text: string; model: string; cached: boolean; retries: number; fellBack: boolean; costUsd: number };
export type Transport = (model: string, req: Required<Pick<LlmRequest, "system" | "user">> & { temperature: number }) => Promise<{ text: string; costUsd?: number }>;

const CACHE_TTL_MS = 30 * 24 * 3600 * 1000;
const cache = new Map<string, { at: number; text: string }>();
export const calls: Array<{ step: string; model: string; cached: boolean; retries: number; fellBack: boolean; ok: boolean; error?: string; costUsd: number }> = [];

export const cacheKey = (model: string, system: string, user: string) => createHash("sha256").update(model + "\0" + system + "\0" + user).digest("hex");
const retryable = (e: any) => e?.status === 429 || (e?.status >= 500 && e?.status < 600);
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function callModel(req: LlmRequest, o: { transport: Transport; primary: string; fallback: string; sleepFn?: (ms: number) => Promise<void>; validate?: (t: string) => boolean }): Promise<LlmResult> {
  const system = withDataGuard(req.system);
  assertNoPII(req.user); assertNoPII(system);
  const temperature = req.temperature ?? 0;
  const wait = o.sleepFn ?? sleep;
  const cacheable = temperature <= 0.2;
  const key = cacheKey(o.primary, system, req.user);
  const hit = cache.get(key);
  if (cacheable && hit && Date.now() - hit.at < CACHE_TTL_MS && (o.validate?.(hit.text) ?? true)) {
    calls.push({ step: req.step, model: o.primary, cached: true, retries: 0, fellBack: false, ok: true, costUsd: 0 });
    return { text: hit.text, model: o.primary, cached: true, retries: 0, fellBack: false, costUsd: 0 };
  }
  let retries = 0, lastErr: any;
  for (const [idx, model] of [o.primary, o.fallback].entries()) {
    for (let attempt = 0; attempt < (idx === 0 ? 4 : 1); attempt++) {
      try {
        const r = await o.transport(model, { system, user: req.user, temperature });
        if (cacheable) cache.set(key, { at: Date.now(), text: r.text });
        const out = { text: r.text, model, cached: false, retries, fellBack: idx === 1, costUsd: r.costUsd ?? 0 };
        calls.push({ step: req.step, model, cached: false, retries, fellBack: idx === 1, ok: true, costUsd: out.costUsd });
        return out;
      } catch (e: any) {
        lastErr = e;
        if (!retryable(e)) throw e;
        retries++;
        if (attempt < 3 && idx === 0) await wait(1000 * 2 ** attempt + Math.floor(Math.random() * 250));
      }
    }
  }
  calls.push({ step: req.step, model: o.fallback, cached: false, retries, fellBack: true, ok: false, error: String(lastErr?.message ?? lastErr), costUsd: 0 });
  throw lastErr;
}

export function clearCache() { cache.clear(); calls.length = 0; }
