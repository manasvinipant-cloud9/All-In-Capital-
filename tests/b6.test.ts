import { test } from "node:test";
import assert from "node:assert/strict";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { changeTags, maskName, parseCsv, sha256 } from "../scripts/b6/lib.ts";

test("b6 lib: csv with quotes and newlines, name masking, change tags", () => {
  const rows = parseCsv('a,b\n"x, y","line1\nline2"\n"he said ""hi""",z\n');
  assert.deepEqual(rows, [{ a: "x, y", b: "line1\nline2" }, { a: 'he said "hi"', b: "z" }]);
  assert.equal(maskName("Hi Asha Rao, Asha met Rao.", "Asha Rao"), "Hi [F1], [F1] met [F1].");
  const t = changeTags("Hi A,\nImpressive! Open to a chat sometime?\nBest regards,\nRiya", "Hi A,\n38 retailers is unusual for a pre-seed team. How?\nWould Tuesday 2 Dec 3pm IST or Thursday 4 Dec 4pm IST work?\nRiya\nAll In Capital");
  for (const k of ["praise_removed", "two_slots_added", "generic_ask_replaced_by_pointed_question", "signoff_fixed", "why_unusual_added"]) assert.ok(t.includes(k), k);
});

const ready = existsSync("scripts/b6/data/sealed_test.json") && existsSync("docs/B6_SEAL.txt");
test("b6: the sealed set matches both fingerprints and contains no training rows", { skip: !ready && "run the b6 steps first" }, () => {
  const body = readFileSync("scripts/b6/data/sealed_test.json", "utf8"), fp = sha256(JSON.stringify(JSON.parse(body)));
  assert.equal(fp, readFileSync("scripts/b6/data/sealed_test.sha256", "utf8").trim());
  assert.equal(fp, readFileSync("docs/B6_SEAL.txt", "utf8").match(/[0-9a-f]{64}/)![0]);
  const sealed = new Set((JSON.parse(body) as { row_id: string }[]).map(r => r.row_id)), ext = JSON.parse(readFileSync("scripts/b6/data/train_extended.json", "utf8")) as { id: string }[];
  assert.equal(sealed.size, 20); assert.equal(ext.filter(e => sealed.has(e.id)).length, 0);
});
test("b6: the harness refuses to run if the sealed set was changed, and the extended set has no sealed text", { skip: !ready && "run the b6 steps first" }, () => {
  const f = "scripts/b6/data/sealed_test.json", backup = "scripts/b6/data/sealed_test.backup";
  copyFileSync(f, backup);
  try {
    writeFileSync(f, readFileSync(f, "utf8").replace("Riya", "Rita"));
    const r = spawnSync("pnpm", ["tsx", "scripts/b6/05-harness.ts"], { encoding: "utf8" });
    assert.notEqual(r.status, 0); assert.match(r.stderr + r.stdout, /SEAL BROKEN/);
  } finally { copyFileSync(backup, f); }
  const ok = spawnSync("pnpm", ["tsx", "scripts/b6/05-harness.ts"], { encoding: "utf8" });
  assert.equal(ok.status, 0, ok.stderr); assert.match(ok.stdout, /Seal OK/);
});
