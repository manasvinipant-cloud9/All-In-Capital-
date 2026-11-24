import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { APPS } from "../scripts/seed/apps.ts";
import { PORTFOLIO, MEMOS, MEETINGS } from "../scripts/seed/content.ts";

test("seed counts", () => {
  assert.equal(APPS.length, 10); assert.equal(PORTFOLIO.length, 18); assert.equal(MEMOS.length, 12); assert.equal(MEETINGS.length, 5);
  assert.equal(readdirSync("seed/decks").length, 10);
  assert.equal(readFileSync("seed/exports/loop1_screening.csv", "utf8").split("\n").length, 41);
  assert.equal(readFileSync("seed/exports/loop2_first_email.csv", "utf8").split("\n").length >= 61, true);
});
test("planted traps exist", () => {
  const t = APPS.map(a => a.trap).join("|");
  for (const k of ["TAM", "NBFC", "regulation", "portfolio", "later-stage", "downloads", "hardware"]) assert.match(t, new RegExp(k, "i"));
});
test("EarnWise TAM is off by x10 from its own inputs", () => {
  assert.equal(4e7 * 2280 / 1e7, 9120); // Cr; deck says 91,200
  assert.match(APPS.find(a => a.slug === "earnwise")!.deck.join(" "), /91,200/);
});
