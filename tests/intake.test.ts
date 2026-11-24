import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import PDFDocument from "pdfkit";
import { normalizeForm, normalizeSector, normalizeStage, parseFormJson, parseFormText } from "../src/lib/intake/form.ts";
import { checkPdf, MAX_PDF, RateLimiter } from "../src/lib/intake/limits.ts";
import { saveApplication } from "../src/lib/intake/save.ts";
import { getMeta, listMeta, validSlug } from "../src/lib/apps.ts";
import { jobs } from "../src/lib/queue.ts";
import { allApps, oneLiner } from "../src/lib/data.ts";
import { makeProcessor } from "../src/lib/process.ts";
import { clearCache, type Transport } from "../src/lib/gateway/index.ts";

const ROOT = process.cwd();
const inTmp = async (f: () => void | Promise<void>) => {
  const dir = mkdtempSync(`${tmpdir()}/aic-`); symlinkSync(resolve(ROOT, "seed"), `${dir}/seed`); process.chdir(dir);
  try { await f(); } finally { process.chdir(ROOT); }
};
function pdf(pages: string[]): Promise<Uint8Array<ArrayBuffer>> {
  return new Promise(res => { const d = new PDFDocument({ autoFirstPage: false }), c: Buffer[] = []; d.on("data", b => c.push(b)); d.on("end", () => res(new Uint8Array(Buffer.concat(c))));
    for (const t of pages) { d.addPage(); d.fontSize(12).text(t); } d.end(); });
}
const FORM = "Company: Acme Foods\nFounder name: Asha Rao\nEmail: asha@acme.example\nPhone: +91 90000 11111\nStage: Pre seed\nRound size: INR 2 Cr\nValuation: INR 12 Cr\nSector: Consumer brand\nTeam size: 4\nRevenue: INR 6 L monthly";
const DECK = ["Acme Foods. Millet snacks for urban households. Pre-seed, raising INR 2 Cr, Pune. We sell forty thousand packs a month to two thousand stores and customers reorder every month, which is why we think repeat is real.",
  "Market: 2 crore households x INR 3,000 a year = INR 60,000 Cr. Team of 6. Founder Asha Rao, CEO."];
const NAMES = { primary: "p", fallback: "f" };

test("form reader: line layout, flattened layout and a differently worded layout all read the same fields", () => {
  const a = parseFormText(FORM), b = parseFormText(FORM.replace(/\n/g, " "));
  const c = parseFormText("Startup Name: Acme Foods\nName: Asha Rao\nE-mail: asha@acme.example\nFunding stage: Seed\nRaising: INR 2 Cr\nPost-money: INR 12 Cr\nIndustry: FMCG brand");
  for (const r of [a, b]) { assert.equal(r.Company, "Acme Foods"); assert.equal(r["Founder name"], "Asha Rao"); assert.equal(r.Email, "asha@acme.example"); assert.equal(r["Round size"], "INR 2 Cr"); assert.equal(r["Valuation (post-money)"], "INR 12 Cr"); assert.equal(r["Team size"], "4"); }
  assert.deepEqual([c.Company, c["Founder name"], c.Email, c.Stage, c["Round size"], c["Valuation (post-money)"], c.Sector], ["Acme Foods", "Asha Rao", "asha@acme.example", "Seed", "INR 2 Cr", "INR 12 Cr", "FMCG brand"]);
});
test("form reader: 'surname:' is not a name, 'Company name:' is not read as 'name', unknown labels are kept", () => {
  const r = parseFormText("Surname: Rao\nCompany name: Acme\nFounder name: Asha Rao\nFavourite colour: green");
  assert.equal(r["Founder name"], "Asha Rao"); assert.equal(r.Company, "Acme"); assert.equal(r["Favourite colour"], "green"); assert.equal(r.Surname, "Rao");
});
test("form reader: JSON keys are mapped by meaning", () => assert.deepEqual(parseFormJson({ "Startup Name": "Acme", Raise: "INR 1 Cr", nested: { a: 1 } }), { Company: "Acme", "Round size": "INR 1 Cr" }));
test("normalisation: stage, sector, typed overrides, required fields, bad email, control characters, caps", () => {
  assert.equal(normalizeStage("pre seed"), "Pre-seed"); assert.equal(normalizeStage("Pre-Seed"), "Pre-seed"); assert.equal(normalizeStage("SEED"), "Seed"); assert.equal(normalizeStage("series a"), "Series A");
  assert.equal(normalizeSector("D2C FMCG brand"), "Consumer brand"); assert.equal(normalizeSector("Drone hardware"), "Deeptech"); assert.equal(normalizeSector("???"), "Other");
  const ok = normalizeForm({ Company: "Acme", "Founder name": "A B", Stage: "pre seed" }, { Company: "Acme Two", "Round size": "INR 1 Cr" });
  assert.ok(ok.ok && ok.form.Company === "Acme Two" && ok.stage === "Pre-seed" && ok.form["Round size"] === "INR 1 Cr");
  assert.ok(ok.ok && ok.warnings.some(w => /Email/.test(w)));
  assert.deepEqual(normalizeForm({ "Founder name": "A B" }), { ok: false, message: "Company is missing. Type it in the box below." });
  assert.match((normalizeForm({ Company: "x", "Founder name": "y", Email: "not-an-email" }) as any).message, /email/i);
  const dirty = normalizeForm({ Company: "A\u0000cme\u0007", "Founder name": "B", "Founder background": "x".repeat(5000) });
  assert.ok(dirty.ok && dirty.form.Company === "Acme" && dirty.form["Founder background"].length === 2000);
});
test("PDF check: real PDF passes; text, images, empty and oversized files are refused", async () => {
  assert.equal(checkPdf(await pdf(["hi"]), "deck"), null);
  assert.match(checkPdf(new TextEncoder().encode("hello"), "deck")!, /not a PDF/); assert.match(checkPdf(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), "deck")!, /not a PDF/);
  assert.match(checkPdf(new Uint8Array(0), "deck")!, /empty/); assert.match(checkPdf(new Uint8Array(MAX_PDF + 1), "deck")!, /16 MB/);
});
test("rate limit: 10 an hour per key, then a wait time; other keys unaffected; the window slides", () => {
  const rl = new RateLimiter(10, 3600000); let t = 1000;
  for (let i = 0; i < 10; i++) assert.equal(rl.hit("a", t + i).ok, true);
  const blocked = rl.hit("a", t + 20); assert.equal(blocked.ok, false); assert.ok(!blocked.ok && blocked.retryAfterSec > 3500);
  assert.equal(rl.hit("b", t).ok, true); assert.equal(rl.hit("a", t + 3600001).ok, true);
});
test("slugs: only safe names are accepted", () => { for (const s of ["acme-foods-1a2b3c", "a"]) assert.ok(validSlug(s)); for (const s of ["", "../etc", "a/b", "A", "a b", "-x", "x".repeat(70)]) assert.ok(!validSlug(s), s); });
test("one-liner skips the page header and the company name", () => {
  assert.equal(oneLiner("Acme Foods (page 1) Acme Foods. Millet snacks for urban households. Seed.", "Acme Foods"), "Millet snacks for urban households");
});

test("save: stores deck, form and record under a safe slug, queues it, writes an audit line", async () => inTmp(async () => {
  const r = await saveApplication({ deck: await pdf(DECK), formFile: new TextEncoder().encode(FORM), addedBy: "riya@fund.test" });
  assert.ok(r.ok); if (!r.ok) return;
  assert.match(r.slug, /^acme-foods-[0-9a-f]{6}$/); assert.equal(r.duplicate, false);
  const m = getMeta(r.slug)!; assert.equal(m.source, "uploaded"); assert.equal(m.sector, "Consumer brand"); assert.equal(m.stage, "Pre-seed"); assert.equal(m.addedBy, "riya@fund.test");
  assert.equal(JSON.parse(readFileSync(`.local/applications/${r.slug}/form.json`, "utf8"))["Founder name"], "Asha Rao");
  assert.equal(jobs().filter(j => j.slug === r.slug && j.status === "queued").length, 1);
  assert.match(readFileSync(".local/audit.jsonl", "utf8"), /"action":"intake".*acme-foods/); assert.ok(listMeta().some(x => x.slug === r.slug));
}));
test("save: the same deck again is a duplicate, not a second application or job", async () => inTmp(async () => {
  const deck = await pdf(["Dupe Co. A deck with enough words in it to be read properly by the reader so that it is not flagged as empty. ".repeat(3)]);
  const a = await saveApplication({ deck, typed: { Company: "Dupe Co", "Founder name": "D U" }, addedBy: "x" }), b = await saveApplication({ deck, typed: { Company: "Other Name", "Founder name": "D U" }, addedBy: "x" });
  assert.ok(a.ok && b.ok && a.slug === b.slug && b.duplicate === true); assert.equal(jobs().length, 1); assert.equal(listMeta().filter(m => m.source === "uploaded").length, 1);
}));
test("save: refuses bad uploads in plain words and leaves nothing behind", async () => inTmp(async () => {
  const ok = await pdf(DECK);
  const text = await saveApplication({ deck: new TextEncoder().encode("not a pdf"), typed: { Company: "X", "Founder name": "Y" }, addedBy: "x" });
  assert.deepEqual(text, { ok: false, message: "The deck is not a PDF." });
  const garbage = await saveApplication({ deck: new TextEncoder().encode("%PDF-1.7\nthis is not really a pdf at all"), typed: { Company: "Garbled Co", "Founder name": "Y" }, addedBy: "x" });
  assert.ok(!garbage.ok && /could not be read/.test(garbage.message)); assert.ok(!existsSync(".local/applications") || listMeta().filter(m => m.source === "uploaded").length === 0);
  const noCompany = await saveApplication({ deck: ok, formFile: new TextEncoder().encode("Founder name: Asha Rao"), addedBy: "x" }); assert.deepEqual(noCompany, { ok: false, message: "Company is missing. Type it in the box below." });
  const badForm = await saveApplication({ deck: ok, formFile: new TextEncoder().encode("{ broken json"), addedBy: "x" }); assert.ok(!badForm.ok);
  const long = await saveApplication({ deck: await pdf(Array.from({ length: 81 }, (_, i) => `page ${i} with a little text`)), typed: { Company: "Long Co", "Founder name": "L C" }, addedBy: "x" });
  assert.ok(!long.ok && /80 pages/.test(long.message)); assert.equal(jobs().length, 0); assert.equal(listMeta().filter(m => m.source === "uploaded").length, 0);
}));
test("save: a hostile company name cannot escape the applications folder", async () => inTmp(async () => {
  const r = await saveApplication({ deck: await pdf(["Hostile deck text that is long enough to count as readable text for the reader. ".repeat(4)]), typed: { Company: "../../../etc/passwd; rm -rf /", "Founder name": "H K" }, addedBy: "x" });
  assert.ok(r.ok); if (!r.ok) return; assert.ok(validSlug(r.slug)); assert.ok(!r.slug.includes(".") && !r.slug.includes("/")); assert.ok(existsSync(`.local/applications/${r.slug}/deck.pdf`));
}));
test("save: a form given as a PDF is read by its labels", async () => inTmp(async () => {
  const r = await saveApplication({ deck: await pdf(DECK), formFile: await pdf([FORM.replace("Acme Foods", "Pdf Form Co")]), addedBy: "x" });
  assert.ok(r.ok && r.company === "Pdf Form Co"); if (r.ok) assert.equal(getMeta(r.slug)!.stage, "Pre-seed");
}));

test("end to end: uploaded application shows real checks with no invented rating, then a model score replaces the waiting state", async () => inTmp(async () => {
  clearCache();
  const r = await saveApplication({ deck: await pdf(DECK), formFile: new TextEncoder().encode(FORM.replace("Acme Foods", "Flow Foods")), addedBy: "x" }); assert.ok(r.ok); if (!r.ok) return;
  let a = (await allApps()).find(x => x.slug === r.slug)!;
  assert.equal(a.source, "unscored"); assert.equal(a.lane, "unscored"); assert.match(a.waiting!, /In the queue/); assert.deepEqual(a.scores, {}); assert.equal(a.uploaded, true);
  assert.ok(a.checks.some(c => /TAM/.test(c.name)), "the x10 market size is caught"); assert.ok(a.checks.some(c => /Team size/.test(c.name)), "team 4 vs 6 is caught"); assert.equal(a.gates[0].tripped, false); assert.equal(a.gates[3].tripped, true);
  assert.equal(a.oneLiner, "Millet snacks for urban households");
  const none = await makeProcessor({ transport: null, names: null })(r.slug); assert.match(none.blocked!, /No model key/);
  const mock: Transport = async (_m, q) => q.system.includes("Extract claims")
    ? { text: JSON.stringify(q.user.split("\n").map(l => l.match(/^\[page (\d+)\] (.*)$/)).filter(Boolean).slice(0, 2).map(m => ({ metric: "f", value: 1, quote: m![2].split(" ").slice(0, 5).join(" "), page: +m![1] }))) }
    : { text: JSON.stringify({ criterion: q.system.match(/criterion (C\d)/)![1], score: 8, confidence: "med", claim_ids: [[...q.user.matchAll(/^\[([df]\d+)\]/gm)][0][1]], rationale: "ok" }) };
  const done = await makeProcessor({ transport: mock, names: NAMES })(r.slug); assert.equal(done.blocked, undefined);
  a = (await allApps()).find(x => x.slug === r.slug)!; assert.equal(a.source, "model"); assert.equal(a.total, 8); assert.notEqual(a.lane, "unscored");
}));
test("route: validates the upload, refuses a missing deck, and limits repeat uploads", async () => inTmp(async () => {
  const { POST } = await import("../src/app/api/intake/route.ts");
  const call = (fd: FormData, ip: string) => POST(new Request("http://x/api/intake", { method: "POST", body: fd, headers: { "x-forwarded-for": ip } }));
  const none = await call(new FormData(), "3.3.3.3"); assert.equal(none.status, 400); assert.match((await none.json()).message, /pitch deck/);
  const fd = new FormData(); fd.set("deck", new File([await pdf(DECK)], "deck.pdf", { type: "application/pdf" })); fd.set("form", new File([FORM.replace("Acme Foods", "Route Foods")], "form.txt")); fd.set("round", "INR 3 Cr");
  const ok = await call(fd, "4.4.4.4"), j = await ok.json(); assert.equal(ok.status, 200); assert.equal(j.ok, true); assert.match(j.slug, /^route-foods-/);
  assert.equal(JSON.parse(readFileSync(`.local/applications/${j.slug}/form.json`, "utf8"))["Round size"], "INR 3 Cr", "typed field wins");
  const fake = new FormData(); fake.set("deck", new File(["<html>not a pdf</html>"], "deck.pdf", { type: "application/pdf" })); fake.set("company", "X"); fake.set("founderName", "Y");
  const bad = await call(fake, "5.5.5.5"); assert.equal(bad.status, 400); assert.match((await bad.json()).message, /not a PDF/);
  let last = 200; for (let i = 0; i < 11; i++) last = (await call(new FormData(), "6.6.6.6")).status; assert.equal(last, 429);
}));
