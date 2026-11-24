import { test } from "node:test";
import assert from "node:assert/strict";
import { callModel, clearCache, cacheKey } from "../src/lib/gateway/index.ts";
import { redact, assertNoPII, DATA_NOT_INSTRUCTIONS } from "../src/lib/gateway/guards.ts";

const base = { primary: "p", fallback: "f", sleepFn: async () => {} };

test("redact names, emails, phones, linkedin", () => {
  const r = redact("Dhruv Shah (dhruv@x.in, +91 98765 43210, linkedin.com/in/dhruv) met Isha Merchant", ["Dhruv Shah", "Isha Merchant"]);
  assert.equal(r.text.includes("dhruv@x.in"), false);
  assert.match(r.text, /\[F1\]/); assert.match(r.text, /\[F2\]/);
  assert.doesNotThrow(() => assertNoPII(r.text));
});
test("guard throws on PII", async () => {
  clearCache();
  await assert.rejects(callModel({ step: "t", system: "s", user: "mail me a@b.com" }, { ...base, transport: async () => ({ text: "x" }) }), /PII guard/);
});
test("every system prompt ends with data guard", async () => {
  clearCache(); let seen = "";
  await callModel({ step: "t", system: "Score it.", user: "hi" }, { ...base, transport: async (_m, r) => { seen = r.system; return { text: "ok" }; } });
  assert.ok(seen.endsWith(DATA_NOT_INSTRUCTIONS));
});
test("retries 429 then succeeds", async () => {
  clearCache(); let n = 0;
  const r = await callModel({ step: "t", system: "s", user: "u1" }, { ...base, transport: async () => { if (++n < 3) throw { status: 429 }; return { text: "ok" }; } });
  assert.equal(r.retries, 2); assert.equal(r.fellBack, false);
});
test("falls back after 4 failures", async () => {
  clearCache();
  const r = await callModel({ step: "t", system: "s", user: "u2" }, { ...base, transport: async m => { if (m === "p") throw { status: 503 }; return { text: "fb" }; } });
  assert.equal(r.fellBack, true); assert.equal(r.model, "f");
});
test("non-retryable errors throw immediately", async () => {
  clearCache(); let n = 0;
  await assert.rejects(callModel({ step: "t", system: "s", user: "u3" }, { ...base, transport: async () => { n++; throw { status: 400 }; } }));
  assert.equal(n, 1);
});
test("deterministic calls are cached; hot calls are not", async () => {
  clearCache(); let n = 0;
  const t = async () => ({ text: String(++n) });
  await callModel({ step: "t", system: "s", user: "u4" }, { ...base, transport: t });
  const b = await callModel({ step: "t", system: "s", user: "u4" }, { ...base, transport: t });
  assert.equal(b.cached, true); assert.equal(n, 1);
  await callModel({ step: "t", system: "s", user: "u5", temperature: 0.9 }, { ...base, transport: t });
  await callModel({ step: "t", system: "s", user: "u5", temperature: 0.9 }, { ...base, transport: t });
  assert.equal(n, 3);
});
test("cache key is sha256 of model+system+user", () => assert.equal(cacheKey("a", "b", "c").length, 64));
