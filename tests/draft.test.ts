import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { APPS } from "../scripts/seed/apps.ts";
import { offlineInvite, isDeeptech } from "../src/lib/email/offline.ts";
import { lint } from "../src/lib/email/lint.ts";
import { fillSlots, candidateSlots } from "../src/lib/email/slots.ts";
import { draftEmail } from "../src/lib/email/draft.ts";
import { clearCache } from "../src/lib/gateway/index.ts";
import { fromIST } from "../src/lib/ist.ts";

const NOW = fromIST(2026, 10, 24, 10, 0);
test("offline invite passes the linter for all 10 seed applications (before and after slots are filled)", () => {
  for (const a of APPS) {
    const d = offlineInvite(a.form, a.stage, a.sector, isDeeptech(a.sector));
    assert.deepEqual(lint({ template: "invite", subject: d.subject, body: d.body, deeptech: isDeeptech(a.sector) }), [], a.slug);
    assert.deepEqual(lint({ template: "invite", subject: d.subject, body: fillSlots(d.body, candidateSlots({ now: NOW })), deeptech: isDeeptech(a.sector) }), [], a.slug);
  }
});
test("model draft: failing draft is regenerated with the failures named; max 3 generations", async () => {
  clearCache(); const bad = { subject: "Hi", body: "Hi A,\nImpressive work! Chat?\nBest regards" }, good = offlineInvite({ "Founder name": "Asha", Revenue: "INR 9 L" }, "Pre-seed", "Fintech", false);
  const seen: string[] = []; let n = 0;
  const transport = async (_m: string, r: any) => { seen.push(r.system); return { text: JSON.stringify(++n < 3 ? bad : good) }; };
  const out = await draftEmail({ template: "invite", facts: "Revenue INR 9 L", examples: [], founders: [], transport, primary: "p", fallback: "f" });
  assert.equal(out.passed, true); assert.equal(out.attempts, 3); assert.match(seen[1], /failed these checks/);
  clearCache(); const always = async () => ({ text: JSON.stringify(bad) });
  const fail = await draftEmail({ template: "invite", facts: "x", examples: [], founders: [], transport: always, primary: "p2", fallback: "f" });
  assert.equal(fail.passed, false); assert.equal(fail.attempts, 3);
});
test("Aditya line is required for deeptech", () => {
  const a = APPS.find(x => x.slug === "dronedrishti")!; assert.match(offlineInvite(a.form, a.stage, a.sector, true).body, /Aditya/);
  void readFileSync;
});
