// Fires 20 model calls at once and reports success, failure, error type and time.
// Default: a simulated model (some 429s, one bad request). --live uses the real route if keys exist.
import { callModel, clearCache, calls, type Transport } from "../src/lib/gateway/index.ts";
import { modelNames, realTransport } from "../src/lib/gateway/transport.ts";

const live = process.argv.includes("--live");
let transport: Transport;
let names = { primary: "sim-primary", fallback: "sim-fallback" };

if (live) {
  const t = realTransport();
  const n = modelNames();
  if (!t || !n) {
    console.error("No model key or model names set. Run without --live for the simulated test.");
    process.exit(2);
  }
  transport = t;
  names = n;
} else {
  let n = 0;
  transport = async (_m, r) => {
    const i = ++n;
    await new Promise(res => setTimeout(res, 50 + Math.random() * 250));
    if (i % 5 === 0 && i <= 15) throw Object.assign(new Error("rate limited"), { status: 429 });
    if (r.user.endsWith("#13")) throw Object.assign(new Error("bad request"), { status: 400 });
    return { text: "ok", costUsd: 0.001, tokensIn: 400, tokensOut: 60 };
  };
}

clearCache();
const t0 = Date.now();
const results = await Promise.allSettled(
  Array.from({ length: 20 }, (_, i) => callModel({ step: "loadtest", system: "Reply ok.", user: `request #${i + 1}` }, { transport, ...names })),
);
const ok = results.filter(r => r.status === "fulfilled");
const bad = results.filter(r => r.status === "rejected") as PromiseRejectedResult[];
const types = new Map<string, number>();
for (const b of bad) {
  const k = `status ${b.reason?.status ?? "?"}`;
  types.set(k, (types.get(k) ?? 0) + 1);
}
console.log(
  [
    `${live ? "LIVE" : "SIMULATED"} load test: 20 calls at once`,
    `Succeeded: ${ok.length}`,
    `Failed: ${bad.length}${types.size ? ` (${[...types].map(([k, v]) => `${k} x${v}`).join(", ")})` : ""}`,
    `Retried calls: ${calls.filter(c => c.retries > 0).length}, fell back: ${calls.filter(c => c.fellBack).length}`,
    `Total time: ${((Date.now() - t0) / 1000).toFixed(1)}s`,
  ].join("\n"),
);
