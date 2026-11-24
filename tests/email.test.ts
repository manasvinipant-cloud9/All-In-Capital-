import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { lint } from "../src/lib/email/lint.ts";
import { parseCsv } from "../src/lib/csv.ts";
import { candidateSlots, fillSlots, recheckForSend } from "../src/lib/email/slots.ts";
import { fmtSlot, fromIST } from "../src/lib/ist.ts";

const NOW = fromIST(2026, 10, 24, 10, 0); // Tue 24 Nov 2026 10:00 IST
const good = "Hi Asha,\n38 retailers is unusual for a pre-seed team. How did you get there with so little spend?\nWould 30 minutes on {slot_1} or {slot_2} work? If neither suits you, reply with a time that does.\nRiya\nAll In Capital";

test("linter: good invite passes", () => assert.deepEqual(lint({ template: "invite", subject: "38 retailers, quick call", body: good }), []));
test("linter rules fire", () => {
  const r = (b: string, extra: object = {}) => lint({ template: "invite", subject: "Quick call", body: b, ...extra }).map(i => i.rule);
  assert.ok(r(good.replace("is unusual", "is impressive and exciting")).includes("praise"));
  assert.ok(r(good.replace("38 retailers", "Retailers")).includes("first-number"));
  assert.ok(r(good.replace("{slot_2}", "soon")).includes("slots"));
  assert.ok(r(good.replace("All In Capital", "")).includes("signoff"));
  assert.ok(r(good + " — ok").includes("dash"));
  assert.ok(r(good.replace("How did", "We delve into how")).includes("banned"));
  assert.ok(r(good, { deeptech: true }).includes("aditya"));
  assert.ok(r("Hi A,\nI hope this finds you well. 3 things?\nRiya\nAll In Capital").includes("throat"));
  assert.ok(lint({ template: "invite", subject: "one two three four five six seven eight", body: good }).some(i => i.rule === "subject"));
  assert.ok(lint({ template: "invite", subject: "Hi", body: good + " ".repeat(1) + Array(80).fill("w").join(" ") }).some(i => i.rule === "length"));
  assert.ok(lint({ template: "pass", subject: "Your application", body: "Hi A,\n3 numbers looked inflated.\nRiya" }).some(i => i.rule === "accuse"));
  assert.ok(lint({ template: "followup", subject: "Checking in", body: "Hi A,\n1 note? Another? \nRiya" }).some(i => i.rule === "questions"));
});
test("every clean email Riya really sent passes the checker, her two planted bad rows fail, and most rewritten system drafts fail", () => {
  const rows = parseCsv(readFileSync("seed/exports/loop2_first_email.csv", "utf8")), BAD = new Set(["L2-030", "L2-054"]);
  assert.equal(rows.length, 60);
  let rewrittenFail = 0, rewritten = 0;
  for (const r of rows) {
    const deeptech = /deeptech|hardware/i.test(r.sector), issues = lint({ template: "invite", subject: "Quick call", body: r.riya_final_email, deeptech });
    if (BAD.has(r.row_id)) assert.ok(issues.length > 0, `${r.row_id} is a planted bad email and must fail`);
    else assert.deepEqual(issues, [], `a check Riya fails is a wrong check: ${r.row_id}`);
    if (r.riya_final_email.trim() !== r.system_draft.trim()) { rewritten++; if (lint({ template: "invite", subject: "Quick call", body: r.system_draft, deeptech }).length) rewrittenFail++; }
  }
  assert.equal(rewritten, 35); assert.ok(rewrittenFail >= 30, `only ${rewrittenFail} of ${rewritten} rewritten drafts fail`);
});
test("linter: Riya's real offer format passes; other weekdays, missing afternoon and number words are handled", () => {
  const base = (offer: string) => `Hi Asha,\n\nStores reordering every nine days is rare for a first-year wholesale app.\n\nWhat share of those reorders come through the app?\n\n${offer}\n\nRiya\nAll In Capital`;
  const r = (offer: string) => lint({ template: "invite", subject: "Quick call", body: base(offer) }).map(i => i.rule);
  assert.deepEqual(r("Could we do 30 minutes on Tuesday 20 May or Thursday 22 May, in the afternoon?"), []);
  assert.deepEqual(r("Do you have 30 minutes on Thursday, 26 Nov, 2:00 pm IST or Tuesday, 1 Dec, 3:30 pm IST?"), []);
  assert.ok(r("Could we do 30 minutes on Monday 19 May or Thursday 22 May, in the afternoon?").includes("slot-day"));
  assert.ok(r("Could we do 30 minutes on Tuesday 20 May or Thursday 22 May?").includes("afternoon"));
  assert.ok(r("Could we do 30 minutes on Tuesday 20 May at 10:00 am or Thursday 22 May at 11:00 am?").includes("afternoon"));
  assert.ok(r("Could we do 30 minutes sometime next week?").includes("slots"));
});

test("slots: Tue/Thu afternoons IST, 30 minutes, >=24h ahead", () => {
  const s = candidateSlots({ now: NOW });
  assert.deepEqual(s.map(fmtSlot), ["Thursday, 26 Nov, 2:00 pm IST", "Tuesday, 1 Dec, 2:00 pm IST"]);
  assert.match(fillSlots(good, s), /Thursday, 26 Nov, 2:00 pm IST or Tuesday, 1 Dec, 2:00 pm IST/);
  assert.ok(!fillSlots(good, s).includes("{slot"));
});
test("slots skip busy times", () => {
  const busy = [{ start: fromIST(2026, 10, 26, 14, 0), end: fromIST(2026, 10, 26, 14, 30) }];
  assert.equal(fmtSlot(candidateSlots({ now: NOW, busy })[0]), "Thursday, 26 Nov, 2:30 pm IST");
});
test("send recheck: both free keep; one taken swapped; Riya's own times untouched", async () => {
  const offered = candidateSlots({ now: NOW }), body = fillSlots(good, offered);
  assert.equal((await recheckForSend({ body, offered, isFree: async () => true, now: NOW })).swapped, 0);
  const taken = offered[0].getTime();
  const r = await recheckForSend({ body, offered, isFree: async s => s.getTime() !== taken, now: NOW });
  assert.equal(r.swapped, 1); assert.ok(!r.body.includes(fmtSlot(offered[0]))); assert.ok(r.body.includes(fmtSlot(offered[1])));
  const mine = body.replace(fmtSlot(offered[0]), "Friday at noon").replace(fmtSlot(offered[1]), "Monday morning");
  const e = await recheckForSend({ body: mine, offered, isFree: async () => false, now: NOW });
  assert.equal(e.riyaEdited, true); assert.equal(e.body, mine);
});
