import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { assertSafeQuery, buildQueries } from "../src/lib/research/plan.ts";
import { isPrivateAddress, htmlToText, urlProblem, webFetch, type FetchPort, type SearchPort } from "../src/lib/research/web.ts";
import { rankHits, tierOf } from "../src/lib/research/rank.ts";
import { excerpt, extractFacts, relevance, type Fact } from "../src/lib/research/extract.ts";
import { conflictsOf, verifyClaims } from "../src/lib/research/verify.ts";
import { backgroundClaims, MAX_PAGES, researchApplication } from "../src/lib/research/run.ts";
import { loadResearch } from "../src/lib/research/store.ts";
import { researchSection, scoreApplication, foundersOf } from "../src/lib/pipeline/score.ts";
import { loadFiles } from "../src/lib/apps.ts";
import { reconcile } from "../src/lib/pipeline/reconcile.ts";
import { makeProcessor } from "../src/lib/process.ts";
import { allApps } from "../src/lib/data.ts";
import { clearCache, type Transport } from "../src/lib/gateway/index.ts";
import { loadScored } from "../src/lib/scored.ts";

const ROOT = process.cwd();
const inTmp = async (f: () => void | Promise<void>) => {
  const dir = mkdtempSync(`${tmpdir()}/aic-`); symlinkSync(resolve(ROOT, "seed"), `${dir}/seed`); process.chdir(dir);
  try { await f(); } finally { process.chdir(ROOT); }
};
const NAMES = { primary: "p", fallback: "f" };

// A small fake web. EarnWise's deck says "Ex-Goldman Sachs, Ex-Google, MBA IIM Ahmedabad"; its form says internship, vendor contract, tier-2 school.
const PAGES: Record<string, string> = {
  "https://earnwise.example/about": "EarnWise is an earned wage access product for factory workers in India. Nikhil Verma, co-founder of EarnWise, spent ten weeks as a summer intern at Goldman Sachs in 2019. He later worked as a vendor contractor at Google for five months. EarnWise raised a small pre-seed round last year.",
  "https://www.livemint.com/companies/earnwise-fintech-wages": "Fintech startup EarnWise lets factory workers draw wages early. Founder Nikhil Verma previously interned at Goldman Sachs before starting the company in Gurugram, according to people familiar with his career.",
  "https://www.crunchbase.com/organization/earnwise": "EarnWise is a fintech company founded by Nikhil Verma. The company offers earned wage access. Nikhil Verma studied business and worked at Google.",
  "https://blog.example/nikhil-verma-chef": "Nikhil Verma is a chef in Pune known for his biryani. Nikhil Verma opened his third restaurant this spring and teaches cooking classes on weekends for local students and families.",
};
const SEARCH_HITS: Record<string, string[]> = {
  company: ["https://earnwise.example/about", "https://www.crunchbase.com/organization/earnwise", "https://www.livemint.com/companies/earnwise-fintech-wages"],
  founder: ["https://www.linkedin.com/in/nikhil-verma-123", "https://blog.example/nikhil-verma-chef", "https://www.livemint.com/companies/earnwise-fintech-wages"],
};
function fakeSearch(log: string[], o: { failOn?: RegExp; emptyOn?: RegExp } = {}): SearchPort {
  return { async search(query) {
    log.push(query);
    if (o.failOn?.test(query)) throw new Error("search 429");
    if (o.emptyOn?.test(query)) return [];
    const urls = /lawsuit|fraud/.test(query) ? [] : /"Nikhil Verma"/.test(query) ? SEARCH_HITS.founder : SEARCH_HITS.company;
    return urls.map(url => ({ url, title: "", snippet: "" }));
  } };
}
const fakeFetch = (log: string[]): FetchPort => async url => { log.push(url); const t = PAGES[url]; return t ? { ok: true, text: t } : { ok: false, error: "not read: status 404" }; };

/** Fake model for page reading: quotes the first sentence that mentions Goldman or Google, and flags "intern" as a conflict with the deck's "Ex-Goldman". */
function fakeModel(seen: { system: string; user: string }[]): Transport {
  return async (_m, r) => {
    seen.push({ system: r.system, user: r.user });
    if (!r.system.includes("You read one public web page")) throw new Error("unexpected call");
    const page = r.user.split(/PAGE \([^)]*\):\n/)[1] ?? "";
    const sents = page.split(/(?<=\.)\s+/).filter(s => /Goldman|Google/.test(s));
    return { text: JSON.stringify(sents.map(s => ({ subject: "[F1]", type: "career", claim: s.replace(/\.$/, ""), quote: s.split(" ").slice(0, 14).join(" "), same_person: "yes", matches_application: /intern|vendor/.test(s) ? "conflict" : "match", application_claim: /Goldman/.test(s) ? "Ex-Goldman Sachs" : "Ex-Google" }))) };
  };
}
const earnwise = async () => { const f = await loadFiles("earnwise"); return { slug: "earnwise", company: "EarnWise", sector: "Fintech", form: f.form, deck: f.deck }; };

test("plan: queries use only names and fixed words; capped; founders capped at 3", () => {
  const q = buildQueries({ company: "EarnWise", founders: ["Nikhil Verma", "A One", "B Two", "C Three"], sector: "Fintech" });
  assert.ok(q.length <= 12 && q.length >= 4); assert.ok(q.some(x => x.purpose === "company") && q.some(x => x.purpose === "founder") && q.some(x => x.purpose === "conflict"));
  assert.ok(!q.some(x => x.query.includes("C Three")), "only 3 founders are searched");
  assert.ok(q.every(x => !/\d/.test(x.query)), "no numbers: nothing from a deck");
});
test("plan guard: deck wording, emails, links, phone numbers and odd names are refused", () => {
  const o = { company: "EarnWise", founders: ["Nikhil Verma"], sector: "Fintech" };
  for (const bad of ['"EarnWise" earned wage access factory workers', '"Nikhil Verma" nikhil@earnwise.example', '"EarnWise" https://x.example', '"Nikhil Verma" linkedin', '"EarnWise" 9876543210']) assert.throws(() => assertSafeQuery(bad, o), /guard/, bad);
  assert.doesNotThrow(() => assertSafeQuery('"Nikhil Verma" "EarnWise"', o));
  for (const name of ["Nikhil <script>", "a@b.com", "", "x".repeat(70)]) assert.throws(() => buildQueries({ company: "EarnWise", founders: [name], sector: "Fintech" }), /not safe/, name);
});
test("web: unsafe addresses and login-only sites are refused before any request", async () => {
  for (const [u, re] of [["file:///etc/passwd", /http/], ["ftp://x.example/a", /http/], ["http://user:pw@x.example/", /password/], ["http://x.example:8080/", /port/], ["http://localhost/a", /local/], ["http://127.0.0.1/a", /private/], ["http://10.0.0.5/a", /private/], ["http://169.254.169.254/latest", /private/],
    ["http://[::1]/a", /private/], ["https://www.linkedin.com/in/someone", /login-only/], ["https://x.com/someone", /login-only/], ["not a url", /valid/]] as const) assert.match(urlProblem(u) ?? "", re, u);
  assert.equal(urlProblem("https://www.livemint.com/a"), null);
  for (const ip of ["10.1.2.3", "172.16.0.1", "172.31.255.1", "192.168.1.1", "127.0.0.1", "169.254.1.1", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:10.0.0.1"]) assert.ok(isPrivateAddress(ip), ip);
  for (const ip of ["8.8.8.8", "172.32.0.1", "93.184.216.34", "2606:4700::1111"]) assert.ok(!isPrivateAddress(ip), ip);
  assert.match(JSON.stringify(await webFetch("http://127.0.0.1/x")), /private/); assert.match(JSON.stringify(await webFetch("http://127.0.0.1:9/x")), /not read/); assert.match(JSON.stringify(await webFetch("https://www.linkedin.com/in/x")), /login-only/);
});
test("web: page text keeps content and drops scripts, menus and tags", () => {
  const t = htmlToText("<html><nav>Menu Home</nav><script>alert('x')</script><h1>EarnWise</h1><p>Nikhil &amp; team &quot;raised&quot; funds.</p><footer>Copyright</footer></html>");
  assert.match(t, /EarnWise/); assert.match(t, /Nikhil & team "raised" funds\./); assert.doesNotMatch(t, /alert|Menu Home|Copyright|<p>/);
});
test("sources: official and company pages beat press, press beats others, aggregators last; one page once, two per site", () => {
  assert.equal(tierOf("https://mca.gov.in/x", "EarnWise"), "primary"); assert.equal(tierOf("https://earnwise.example/about", "EarnWise"), "primary"); assert.equal(tierOf("https://www.livemint.com/a", "EarnWise"), "press");
  assert.equal(tierOf("https://www.crunchbase.com/o/earnwise", "EarnWise"), "aggregator"); assert.equal(tierOf("https://random.example/a", "EarnWise"), "other"); assert.equal(tierOf("https://x.ac.in/p", "EarnWise"), "primary");
  const hits = ["https://www.crunchbase.com/a", "https://random.example/a", "https://www.livemint.com/a", "https://earnwise.example/about", "https://www.livemint.com/a/", "https://www.livemint.com/b", "https://www.livemint.com/c"].map(url => ({ url, title: "", snippet: "" }));
  const r = rankHits(hits, "EarnWise", 10); assert.deepEqual(r.map(x => x.tier).slice(0, 3), ["primary", "press", "press"]); assert.equal(r.at(-1)!.tier, "aggregator");
  assert.equal(r.filter(x => x.url.includes("livemint")).length, 2); assert.equal(rankHits(hits, "EarnWise", 2).length, 2);
});
test("relevance: a same-name person without the company or field is set aside in code", () => {
  const o = { company: "EarnWise", sector: "Fintech", purpose: "founder" as const, subject: "Nikhil Verma" };
  assert.equal(relevance(PAGES["https://earnwise.example/about"], o), null); assert.equal(relevance(PAGES["https://www.livemint.com/companies/earnwise-fintech-wages"], o), null);
  assert.match(relevance(PAGES["https://blog.example/nikhil-verma-chef"], o)!, /different person/); assert.match(relevance("A page about someone else entirely.", o)!, /does not mention this founder/);
  assert.match(relevance("A page about a different firm.", { ...o, purpose: "company", subject: "EarnWise" })!, /does not mention the company/);
  const long = "x ".repeat(5000) + "EarnWise is here " + "y ".repeat(5000); assert.ok(excerpt(long, ["EarnWise"]).includes("EarnWise is here")); assert.ok(excerpt(long, ["EarnWise"]).length <= 6000);
});

test("page reading: names never reach the model, quotes must be on the page, other-person facts are dropped, set-aside pages cost no call", async () => {
  clearCache(); const seen: { system: string; user: string }[] = [], ctx = { transport: fakeModel(seen), ...NAMES, founders: ["Nikhil Verma"], application: "earnwise" };
  const o = { company: "EarnWise", sector: "Fintech", founders: ["Nikhil Verma"], applicationClaims: ["Ex-Goldman Sachs"], ctx };
  const ok = await extractFacts({ url: "https://earnwise.example/about", text: PAGES["https://earnwise.example/about"], tier: "primary", purpose: "founder", subject: "Nikhil Verma" }, o);
  assert.equal(ok.facts.length, 2); assert.doesNotMatch(seen[0].user + seen[0].system, /Nikhil|Verma/); assert.match(seen[0].user, /\[F1\]/); assert.equal(ok.facts[0].matches, "conflict");
  const before = seen.length, aside = await extractFacts({ url: "https://blog.example/nikhil-verma-chef", text: PAGES["https://blog.example/nikhil-verma-chef"], tier: "other", purpose: "founder", subject: "Nikhil Verma" }, o);
  assert.match(aside.setAside!, /different person/); assert.equal(seen.length, before, "the model was never called for it");
  clearCache(); let n = 0; const sys: string[] = [];
  const t: Transport = async (_m, r) => { sys.push(r.system); n++; const quote = n === 1 ? "Goldman Sachs made this up" : "ten weeks as a summer intern at Goldman Sachs"; return { text: JSON.stringify([{ subject: "[F1]", type: "career", claim: "intern", quote, same_person: "yes", matches_application: "conflict" }, { subject: "[F1]", type: "career", claim: "other person", quote: "ten weeks as a summer intern", same_person: "no", matches_application: "match" }]) }; };
  const r = await extractFacts({ url: "https://earnwise.example/about", text: PAGES["https://earnwise.example/about"], tier: "primary", purpose: "founder", subject: "Nikhil Verma" }, { ...o, ctx: { ...ctx, transport: t } });
  assert.match(sys[1], /rejected: quote not found verbatim/); assert.equal(r.facts.length, 1); assert.ok(r.dropped.some(d => /different person/.test(d)));
});

test("labels: verified by an official page or two independent sites; aggregators never prove it alone; single sources stay claimed", () => {
  const f = (url: string, tier: Fact["tier"], claim: string, extra: Partial<Fact> = {}): Fact => ({ subject: "[F1]", type: "career", claim, quote: claim, url, tier, same_person: "yes", matches: "match", ...extra });
  const v = verifyClaims(["Ex-Goldman Sachs", "Worked at Google", "MBA IIM Ahmedabad", "Ran a drone lab"], [
    f("https://earnwise.example/about", "primary", "Interned at Goldman Sachs"), f("https://www.livemint.com/a", "press", "Worked at Google"), f("https://blog.example/b", "other", "Worked at Google as a contractor"),
    f("https://www.crunchbase.com/x", "aggregator", "MBA IIM Ahmedabad"), f("https://x.example/y", "other", "Ran a drone lab", { same_person: "no" })]);
  assert.deepEqual(v.map(x => x.label), ["verified", "verified", "claimed", "not found"]); assert.match(v[2].note, /aggregator/); assert.equal(v[1].sources.length, 2);
  // Stemming: "internship" matches "interned"; a conflict flagged against THIS statement blocks 'verified', one flagged against another statement does not.
  assert.equal(verifyClaims(["10-week internship at Goldman"], [f("https://earnwise.example/a", "primary", "He interned at Goldman Sachs for ten weeks")])[0].label, "verified");
  const conflict = f("https://earnwise.example/a", "primary", "He interned at Goldman Sachs for ten weeks", { matches: "conflict", about_claim: "Ex-Goldman Sachs" });
  assert.equal(verifyClaims(["Ex-Goldman Sachs"], [conflict])[0].label, "claimed"); assert.equal(verifyClaims(["10-week internship at Goldman"], [conflict])[0].label, "verified");
  assert.equal(verifyClaims(["Worked at Google"], [f("https://www.livemint.com/a", "press", "Worked at Google")])[0].label, "claimed");
  assert.equal(verifyClaims(["Worked at Google"], [f("https://www.crunchbase.com/a", "aggregator", "Worked at Google"), f("https://www.tracxn.com/a", "aggregator", "Worked at Google")])[0].label, "claimed");
  assert.deepEqual(conflictsOf([f("https://a.example", "other", "x", { matches: "conflict" }), f("https://b.example", "other", "y", { matches: "conflict", same_person: "no" })]).map(x => x.claim), ["x"]);
});

test("research run: logs every query (empty and failed too), never fetches LinkedIn, sets the other person aside, finds the conflict, verifies from the official page", async () => inTmp(async () => {
  clearCache(); const searched: string[] = [], fetched: string[] = [], seen: { system: string; user: string }[] = [], a = await earnwise();
  const r = await researchApplication(a, { search: fakeSearch(searched, { failOn: /controversy OR lawsuit OR fraud/, emptyOn: /career OR experience/ }), fetch: fakeFetch(fetched), ctx: { transport: fakeModel(seen), ...NAMES } });
  assert.equal(r.available, true); assert.equal(r.queries.length, searched.length); assert.ok(r.queries.some(q => q.results === 0 && !q.error), "an empty query is logged"); assert.ok(r.queries.some(q => q.error), "a failed query is logged");
  assert.ok(!fetched.some(u => u.includes("linkedin")), "LinkedIn is never fetched"); assert.ok(fetched.length <= MAX_PAGES); assert.equal(new Set(fetched).size, fetched.length, "no page twice");
  assert.ok(r.pages.some(p => p.status === "set_aside" && /different person/.test(p.note!))); assert.ok(r.pages.some(p => p.status === "used" && p.tier === "primary"));
  assert.deepEqual(r.facts.map(f => f.id).slice(0, 2), ["r1", "r2"]); assert.ok(r.conflicts.length > 0 && r.conflicts.every(c => /intern|vendor/.test(c.claim)));
  const by = (re: RegExp) => r.verifications.find(v => re.test(v.claim))!;
  assert.equal(by(/10-week internship/).label, "verified", "what the FORM says about the internship is confirmed by the company page");
  assert.equal(by(/^Ex-Goldman/).label, "claimed", "the deck's 'Ex-Goldman Sachs' is NOT verified: the page says intern"); assert.match(by(/^Ex-Goldman/).note, /something different/);
  assert.equal(by(/^Ex-Google/).label, "claimed", "'Ex-Google' is not verified when the page says vendor contractor"); assert.ok(r.verifications.some(v => /IIM/.test(v.claim)));
  assert.ok(r.profileLinks.some(l => /Search LinkedIn for Nikhil Verma/.test(l.label))); assert.deepEqual(loadResearch("earnwise"), JSON.parse(JSON.stringify(r)));
  for (const x of seen) assert.doesNotMatch(x.system + x.user, /Nikhil|Verma|@|\+91 9/, "no names, emails or phones reach the model");
  for (const q of searched) assert.doesNotThrow(() => assertSafeQuery(q, { company: "EarnWise", founders: ["Nikhil Verma"], sector: "Fintech" })); assert.ok(searched.every(q => !/earned wage|factory|IIM|Goldman/i.test(q)), "no deck content in any search");
}));
test("research run: no search key, no model or an unsafe name means 'not checked', and every background stays claimed", async () => inTmp(async () => {
  const a = await earnwise(), claims = backgroundClaims(a.form, a.deck, foundersOf(a.form, a.deck)); assert.ok(claims.length >= 3);
  const none = await researchApplication(a, { search: null, fetch: fakeFetch([]), ctx: { transport: fakeModel([]), ...NAMES } });
  assert.equal(none.available, false); assert.match(none.reason!, /NOT VERIFIED/); assert.ok(none.verifications.every(v => v.label === "claimed")); assert.equal(none.queries.length, 0);
  assert.match((await researchApplication(a, { search: fakeSearch([]), fetch: fakeFetch([]), ctx: null })).reason!, /No model/);
  assert.match((await researchApplication({ ...a, company: "Evil <script>" }, { search: fakeSearch([]), fetch: fakeFetch([]), ctx: { transport: fakeModel([]), ...NAMES } })).reason!, /could not be searched for safely/);
}));
test("research run: when every search and page fails, it finishes cleanly with nothing found", async () => inTmp(async () => {
  const a = await earnwise(), r = await researchApplication(a, { search: fakeSearch([], { failOn: /./ }), fetch: fakeFetch([]), ctx: { transport: fakeModel([]), ...NAMES } });
  assert.equal(r.available, true); assert.equal(r.facts.length, 0); assert.ok(r.queries.every(q => q.error)); assert.ok(r.verifications.every(v => v.label === "claimed" || v.label === "not found"));
}));

test("scoring: research ids can be cited, made-up ones are rejected, and unchecked backgrounds are marked NOT VERIFIED", async () => inTmp(async () => {
  clearCache(); const a = await earnwise(), searched: string[] = [], research = await researchApplication(a, { search: fakeSearch(searched), fetch: fakeFetch([]), ctx: { transport: fakeModel([]), ...NAMES } });
  assert.equal(research.available, true); const full = { ...a, checks: reconcile(a.form, a.deck), gates: [] };
  const sec = researchSection(research).join("\n"); assert.match(sec, /RESEARCH \(public web/); assert.match(sec, /FOUNDER BACKGROUND CHECKS/); assert.match(researchSection(null).join("\n"), /NOT VERIFIED/);
  const seen: { system: string; user: string }[] = [];
  const t = (cite: (given: string[]) => string[]): Transport => async (_m, r) => {
    seen.push(r);
    if (r.system.includes("Extract claims")) return { text: JSON.stringify(r.user.split("\n").map(l => l.match(/^\[page (\d+)\] (.*)$/)).filter(Boolean).slice(0, 1).map(m => ({ metric: "f", value: 1, quote: m![2].split(" ").slice(0, 4).join(" "), page: +m![1] }))) };
    return { text: JSON.stringify({ criterion: r.system.match(/criterion (C\d)/)![1], score: 6, confidence: "high", claim_ids: cite([...r.user.matchAll(/^\[([dfr]\d+)\]/gm)].map(m => m[1])), rationale: "ok" }) };
  };
  const good = await scoreApplication(full, { transport: t(g => g.filter(x => x.startsWith("r")).slice(0, 1)), ...NAMES }, research);
  assert.ok(Object.values(good.scores).every(v => v === 6), "a research fact can be cited"); assert.match(seen.find(x => x.system.includes("Score criterion"))!.system, /high only if research verified it/);
  clearCache(); const fake = await scoreApplication(full, { transport: t(() => ["r99"]), ...NAMES }, research); assert.ok(Object.values(fake.scores).every(v => v === 2)); assert.match(fake.gaps.C1, /do not exist/);
  clearCache(); seen.length = 0; await scoreApplication(full, { transport: t(g => g.slice(0, 1)), ...NAMES }, { ...research, available: false, reason: "No search key is set up." });
  assert.match(seen.find(x => x.system.includes("Score criterion"))!.user, /NOT VERIFIED/);
}));
test("queue handler: research runs before scoring, a search outage does not stop scoring, no key says so", async () => inTmp(async () => {
  clearCache(); const s1: string[] = [];
  const mk = (): Transport => async (_m, r) => r.system.includes("You read one public web page") ? fakeModel([])(_m, r) : r.system.includes("Extract claims")
    ? { text: JSON.stringify(r.user.split("\n").map(l => l.match(/^\[page (\d+)\] (.*)$/)).filter(Boolean).slice(0, 1).map(m => ({ metric: "f", value: 1, quote: m![2].split(" ").slice(0, 4).join(" "), page: +m![1] }))) }
    : { text: JSON.stringify({ criterion: r.system.match(/criterion (C\d)/)![1], score: 5, confidence: "med", claim_ids: [[...r.user.matchAll(/^\[([dfr]\d+)\]/gm)][0][1]], rationale: "ok" }) };
  const ok = await makeProcessor({ transport: mk(), names: NAMES, search: fakeSearch(s1), fetch: fakeFetch([]) })("earnwise");
  assert.match(ok.steps.research, /^done \(\d+ facts from \d+ pages, \d+ queries\)/); assert.equal(ok.steps.score, "done"); assert.ok(loadResearch("earnwise")?.available); assert.ok(loadScored("earnwise"));
  const view = (await allApps()).find(x => x.slug === "earnwise")!; assert.equal(view.research?.available, true); assert.equal(view.source, "model");
  clearCache(); const down = await makeProcessor({ transport: mk(), names: NAMES, search: fakeSearch([], { failOn: /./ }), fetch: fakeFetch([]) })("earnwise"); assert.match(down.steps.research, /^done \(0 facts/); assert.equal(down.steps.score, "done");
  clearCache(); const nokey = await makeProcessor({ transport: mk(), names: NAMES, search: null })("earnwise"); assert.match(nokey.steps.research, /no search key, backgrounds are not verified/); assert.equal(nokey.steps.score, "done"); assert.equal(loadResearch("earnwise")?.available, false);
}));
