import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
// Only src/lib/gateway may reference model endpoints or SDKs.
const FORBIDDEN = /openrouter\.ai|portkey|api\.anthropic|api\.openai|generativelanguage|@google\/genai|@anthropic-ai|from ["']openai["']/i;
function walk(d: string): string[] { return readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; }); }
test("only the gateway calls models", () => {
  const bad = ["src", "scripts"].flatMap(walk).filter(f => /\.(ts|tsx)$/.test(f) && !f.includes("src/lib/gateway/") && FORBIDDEN.test(readFileSync(f, "utf8")));
  assert.deepEqual(bad, []);
});
