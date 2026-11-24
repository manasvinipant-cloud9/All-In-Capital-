import { test } from "node:test";
import assert from "node:assert/strict";
import { autoSchedule, followupDue, type CalendarPort, type MailPort } from "../src/lib/schedule/auto.ts";
import { parseReply, inHours, stripQuoted } from "../src/lib/schedule/parse.ts";
import { Store, type Thread } from "../src/lib/schedule/store.ts";
import { candidateSlots, type Busy } from "../src/lib/email/slots.ts";
import { fromIST } from "../src/lib/ist.ts";

const NOW = fromIST(2026, 10, 24, 10, 0);
const offered = candidateSlots({ now: NOW }); // Thu 26 Nov 14:00, Tue 1 Dec 14:00

function world(replyText: string, busy: Busy[] = [], deeptech = false) {
  const events: any[] = [], sent: string[] = [];
  const cal: CalendarPort = { async freeBusy(s, e) { return busy.filter(b => s < b.end && e > b.start); }, async createEvent(o) { events.push(o); return { id: `ev${events.length}`, meetLink: "https://meet.example/x", calendarLink: "https://cal.example/x" }; } };
  const inbox = [{ id: "m1", text: replyText }];
  const mail: MailPort = { async newReplies() { return inbox; }, async sendInThread(_t, b) { sent.push(b); } };
  const store = new Store(false);
  const t: Thread = { id: "t1", slug: "x", company: "Acme", founderName: "Asha", founderEmail: "asha@example.test", deeptech, state: "sent", offered: offered.map(o => o.toISOString()), reoffers: 0, sentAt: NOW.toISOString(), processed: [] };
  store.put(t);
  return { events, sent, store, cal, mail, t, run: () => autoSchedule({ store, cal, mail, now: NOW, aditya: "aditya@example.test" }) };
}

test("parser: picks", () => {
  assert.deepEqual(parseReply("Thursday works!", offered, NOW), { kind: "pick", index: 0 });
  assert.deepEqual(parseReply("the second one is fine", offered, NOW), { kind: "pick", index: 1 });
  assert.deepEqual(parseReply("Either works for me", offered, NOW), { kind: "pick", index: 0 });
});
test("parser: own times", () => {
  const p = parseReply("Can we do Thursday at 3pm?", offered, NOW) as any; assert.equal(p.kind, "propose"); assert.equal(p.start.getTime(), fromIST(2026, 10, 26, 15, 0).getTime());
  assert.equal((parseReply("tomorrow 4 pm", offered, NOW) as any).start.getTime(), fromIST(2026, 10, 25, 16, 0).getTime());
  assert.equal((parseReply("2 Dec at 11:30 am", offered, NOW) as any).start.getTime(), fromIST(2026, 11, 2, 11, 30).getTime());
});
test("parser: refusals are not proposals; unclear stays unclear", () => {
  assert.equal(parseReply("I can't do Thursday.", offered, NOW).kind, "refusal");
  assert.equal(parseReply("Can you tell me more about the fund first?", offered, NOW).kind, "unclear");
  assert.equal((parseReply("I can't do Thursday, how about Friday at 11am?", offered, NOW) as any).kind, "propose");
  assert.equal(parseReply("Thanks!\n\n> Would Thursday work?\n> Riya", offered, NOW).kind, "unclear");
  assert.equal(stripQuoted("Sure\nOn Mon, 23 Nov, Riya wrote:\n> hi"), "Sure");
});
test("hours: weekday, 10:00 to 19:00 IST, future, within 30 days", () => {
  assert.equal(inHours(fromIST(2026, 10, 25, 10, 0), NOW), true);
  assert.equal(inHours(fromIST(2026, 10, 25, 9, 30), NOW), false);
  assert.equal(inHours(fromIST(2026, 10, 25, 18, 45), NOW), false);
  assert.equal(inHours(fromIST(2026, 10, 28, 12, 0), NOW), false);  // Saturday 28 Nov
  assert.equal(inHours(fromIST(2027, 0, 20, 12, 0), NOW), false);   // beyond 30 days
});

test("fixture: founder picks an offered time that is free -> booked with Meet link + confirmation", async () => {
  const w = world("Thursday works"); const log = await w.run();
  assert.equal(log[0].did, "booked"); assert.equal(w.events.length, 1);
  assert.equal(w.t.state, "booked"); assert.equal(w.t.meeting!.meetLink, "https://meet.example/x"); assert.equal(w.sent.length, 1); assert.match(w.sent[0], /Thursday, 26 Nov, 2:00 pm IST/);
});
test("fixture: founder's own time, free -> booked; deeptech adds Aditya", async () => {
  const w = world("tomorrow 4 pm", [], true); await w.run();
  assert.equal(w.events[0].start.getTime(), fromIST(2026, 10, 25, 16, 0).getTime()); assert.ok(w.events[0].attendees.includes("aditya@example.test")); assert.equal(w.t.meeting!.withAditya, true);
});
test("fixture: busy -> two new times offered, then the pick is booked", async () => {
  const w = world("Wednesday at 3pm", [{ start: fromIST(2026, 10, 25, 15, 0), end: fromIST(2026, 10, 25, 15, 30) }]);
  assert.equal((await w.run())[0].did, "reoffered"); assert.equal(w.events.length, 0); assert.equal(w.t.offered.length, 2); assert.equal(w.t.state, "reoffered");
  assert.match(w.sent[0], /clashes/);
  // founder now picks the second new time
  const newOffer = w.t.offered.map(s => new Date(s));
  const inbox = [{ id: "m2", text: "the second one" }];
  const run2 = await autoSchedule({ store: w.store, cal: w.cal, mail: { async newReplies() { return inbox; }, async sendInThread(_t, b) { w.sent.push(b); } }, now: NOW });
  assert.equal(run2[0].did, "booked"); assert.equal(w.events[0].start.getTime(), newOffer[1].getTime());
});
test("fixture: out of hours -> reoffered, never booked", async () => {
  const w = world("tomorrow 8 pm"); assert.equal((await w.run())[0].did, "reoffered"); assert.equal(w.events.length, 0);
});
test("fixture: unclear -> needs Riya, nothing sent, nothing booked", async () => {
  const w = world("Tell me more about the fund?"); assert.equal((await w.run())[0].did, "needs_riya"); assert.equal(w.sent.length, 0); assert.equal(w.events.length, 0); assert.equal(w.t.state, "needs_riya");
});
test("fixture: refusal alone -> needs Riya", async () => { const w = world("I can't do Thursday."); assert.equal((await w.run())[0].did, "needs_riya"); });
test("fixture: double run never double-books", async () => {
  const w = world("Thursday works"); await Promise.all([w.run(), w.run()]); await w.run();
  assert.equal(w.events.length, 1); assert.equal(w.sent.length, 1);
});
test("fixture: confirmation failure retries the note only", async () => {
  const w = world("Thursday works"); let fail = true; const sent: string[] = [];
  const mail: MailPort = { async newReplies() { return [{ id: "m1", text: "Thursday works" }]; }, async sendInThread(_t, b) { if (fail) throw new Error("gmail down"); sent.push(b); } };
  await assert.rejects(autoSchedule({ store: w.store, cal: w.cal, mail, now: NOW }));
  assert.equal(w.events.length, 1); assert.equal(w.t.meeting!.confirmationSent, false); fail = false;
  w.store.release("t1");
  await autoSchedule({ store: w.store, cal: w.cal, mail, now: NOW });
  assert.equal(w.events.length, 1); assert.equal(sent.length, 1); assert.equal(w.t.meeting!.confirmationSent, true);
});
test("follow-up due after 3 working days of silence, not after a reply", () => {
  const sent = fromIST(2026, 10, 24, 11, 0);
  assert.equal(followupDue(sent, fromIST(2026, 10, 26, 12, 0), false), false);
  assert.equal(followupDue(sent, fromIST(2026, 10, 27, 12, 0), false), true);
  assert.equal(followupDue(sent, fromIST(2026, 10, 30, 12, 0), true), false);
});
