import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { parseCsv } from "../src/lib/csv.ts";
import { getMeetings, getMemos, getPortfolio, memoPeople, redactMemo } from "../src/lib/seedData.ts";
import { isTableForm, parseFormTable, splitFounder } from "../src/lib/intake/form.ts";
import { listMeta } from "../src/lib/apps.ts";
import { extractText, getDocumentProxy } from "unpdf";

const formText = async (slug: string) => ((await extractText(await getDocumentProxy(new Uint8Array(readFileSync(`seed/forms/${slug}.pdf`))), { mergePages: false })).text as string[]).join("\n");
const SLUGS = ["capilot", "carecorner", "earnwise", "grainkind", "pumpwise", "rentroute", "settlr", "stocksathi", "talkbook", "yatrika"];

test("the fund's real seed data is all there", () => {
  assert.deepEqual(listMeta().map(m => m.slug), SLUGS);
  for (const s of SLUGS) for (const f of [`seed/decks/${s}.pdf`, `seed/forms/${s}.pdf`, `seed/forms/${s}.json`]) assert.ok(existsSync(f), f);
  const memos = getMemos(); assert.equal(memos.length, 12); assert.equal(memos.filter(m => m.outcome === "invested").length, 6); assert.equal(memos.filter(m => m.outcome === "passed").length, 6);
  assert.ok(memos.every(m => m.what && m.founder && m.risks && m.why && m.sector && m.stage));
  assert.equal(getMeetings().length, 5);
  assert.equal(parseCsv(readFileSync("seed/exports/loop1_screening.csv", "utf8")).length, 40); assert.equal(parseCsv(readFileSync("seed/exports/loop2_first_email.csv", "utf8")).length, 60);
});
test("the portfolio is partial and says so: only what the provided files name", () => {
  const p = getPortfolio(), names = p.map(x => x.name);
  assert.equal(p.length, 7); for (const n of ["ePlane", "Unbox Robotics", "Wint Wealth", "Giva", "SuperK", "Jai Kisan", "MeetRecord"]) assert.ok(names.some(x => x.includes(n)), n);
  assert.match(readFileSync("seed/README.md", "utf8"), /partial/i);
});
test("form reader: every real form is recognised and gives company, founders, stage, raise, valuation and team size", async () => {
  for (const s of SLUGS) {
    const t = await formText(s); assert.ok(isTableForm(t), `${s} layout`);
    const f = parseFormTable(t);
    for (const k of ["Company", "Founder name", "Founder names", "Founder background", "Stage", "Round size", "Valuation (post-money)", "Team size", "Sector", "LinkedIn"]) assert.ok(f[k], `${s}: ${k}`);
    assert.match(f["Round size"], /^INR [\d.]+ Cr$/); assert.match(f["Valuation (post-money)"], /post-money/); assert.match(f.LinkedIn, /^https:\/\/www\.linkedin\.com\/in\/[\w-]+$/, `${s} linkedin`);
    assert.deepEqual(JSON.parse(readFileSync(`seed/forms/${s}.json`, "utf8")), f, `${s}: saved JSON matches a fresh read`);
  }
});
test("form reader: specific values, including the two layouts, wrapped links and a founder with no title", async () => {
  const f = async (s: string) => parseFormTable(await formText(s));
  assert.equal((await f("capilot"))["Founder names"], "Dhruv Shah; Isha Merchant"); assert.equal((await f("capilot")).Company, "CAPilot");
  assert.equal((await f("carecorner"))["Founder name"], "Dr. Lakshmi Reddy");
  assert.equal((await f("grainkind")).LinkedIn, "https://www.linkedin.com/in/ritu-hegde-example", "a link wrapped across two lines is joined");
  const ss = await f("stocksathi"); assert.equal(ss["Founder names"], "Aarav Deshmukh; Pooja Nair"); assert.match(ss["Founder background"], /FMCG distribution/); assert.match(ss["How is credit funded?"], /NBFC partner/);
  assert.equal((await f("yatrika"))["Founder names"], "Manish Joshi; Kavya Nair"); assert.match((await f("yatrika"))["Founder background"], /family's travel agency/);
  assert.equal((await f("earnwise"))["Founder name"], "Rohit Arora"); assert.match((await f("earnwise"))["Earlier co-founder"], /left in July 2026/);
  assert.equal((await f("settlr")).Stage, "Series A"); assert.equal((await f("talkbook"))["Other investors in conversation"], "One pre-seed fund.");
  assert.deepEqual(splitFounder("Meenakshi S, CTO. 4 years in speech ML. linkedin.com/in/meenakshi-s-example"), { name: "Meenakshi S", title: "CTO", rest: "4 years in speech ML.", linkedin: "linkedin.com/in/meenakshi-s-example" });
});
test("memos: parsed whole, and a blind copy has no company, founder name or outcome reasoning", () => {
  for (const m of getMemos()) {
    const people = memoPeople(m); assert.ok(people.length >= 2, `${m.company} names found`);
    const red = redactMemo(m, `${m.what} ${m.founder} ${m.risks}`);
    assert.ok(!red.includes(m.company.replace(/^The /, "").replace(/ Company$/, "")), `${m.company} company`); for (const p of people.filter(x => x.length > 3)) assert.ok(!red.includes(p), `${m.company}: ${p}`);
  }
  assert.equal(getMemos().find(m => m.company === "Prepnest")!.outcome, "passed"); assert.equal(getMemos().find(m => m.company === "Jai Kisan")!.outcome, "invested");
});
