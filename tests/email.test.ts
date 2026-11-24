import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { lint } from "../src/lib/email/lint.ts";
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
test("every real Riya email in the seed export passes; the system drafts do not", () => {
  const rows = readFileSync("seed/exports/loop2_first_email.csv", "utf8").split("\n").slice(1);
  let passed = 0, draftsFail = 0;
  for (const line of rows.slice(0, 58)) {
    const m = line.match(/^"([^"]*)",.*"(Hi [^"]*)","(Hi [^"]*Riya[^"]*)"|^/); void m;
  }
  // parse CSV properly
  const parse = (s: string) => { const out: string[][] = []; let row: string[] = [], cur = "", q = false; for (let i = 0; i < s.length; i++) { const c = s[i]; if (q) { if (c === '"' && s[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; } else if (c === '"') q = true; else if (c === ",") { row.push(cur); cur = ""; } else if (c === "\n") { row.push(cur); out.push(row); row = []; cur = ""; } else cur += c; } row.push(cur); out.push(row); return out; };
  const t = parse(readFileSync("seed/exports/loop2_first_email.csv", "utf8")), h = t[0], idx = (k: string) => h.indexOf(k);
  for (const r of t.slice(1, 59)) {
    const fin = r[idx("riya_final_email")], draft = r[idx("system_draft")];
    if (fin !== draft) { assert.deepEqual(lint({ template: "invite", subject: "Quick call", body: fin }), [], r[0]); passed++; }
    else draftsFail += lint({ template: "invite", subject: "Quick call", body: draft }).length > 0 ? 1 : 0;
  }
  assert.ok(passed > 20); assert.equal(draftsFail > 0, true);
  const dirty = t.slice(59, 61).map(r => lint({ template: "invite", subject: "Hi", body: r[idx("riya_final_email")] }).length);
  assert.ok(dirty.every(n => n > 0), "dirty rows must fail");
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
