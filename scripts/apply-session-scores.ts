// Applies scores written by Claude in a build session (seed/scores/claude-session.json) to .local/scores.
// They go through the same rules as a model run: every quote must appear word for word in the application, a score above 2 must cite one,
// nothing may be "high" confidence (no web research verified anything), and missing evidence scores 2 with the gap named.
// Usage: pnpm tsx scripts/apply-session-scores.ts
import { readFileSync } from "node:fs";
import { CRITERIA } from "../src/lib/data-constants.ts";
import { loadConfig } from "../src/lib/config.ts";
import { loadFiles } from "../src/lib/apps.ts";
import { formAsPage } from "../src/lib/pipeline/score.ts";
import { validateClaim, validateScore, type Claim } from "../src/lib/pipeline/validate.ts";
import { researchApplication } from "../src/lib/research/run.ts";
import { webFetch } from "../src/lib/research/web.ts";
import { saveScored } from "../src/lib/scored.ts";

type Crit = { score: number; confidence: "med" | "low"; why: string; cite?: string[]; gap?: string };
type Entry = { claims: Record<string, string>; scores: Record<string, Crit> };
const file = JSON.parse(readFileSync("seed/scores/claude-session.json", "utf8")) as { scoredBy: string; note: string; apps: Record<string, Entry> };
const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
let problems = 0;
const fail = (slug: string, msg: string) => { problems++; console.error(`  ${slug}: ${msg}`); };

for (const [slug, e] of Object.entries(file.apps)) {
  const before = problems, { meta, form, deck } = await loadFiles(slug);
  const formPage = deck.length + 1, pages = [...deck, { ...formAsPage(form), page: formPage }];   // the form gets its own page number so it is never confused with deck page 1
  const claims: Claim[] = [], idOf: Record<string, string> = {}; let d = 0, f = 0;
  for (const [key, quote] of Object.entries(e.claims)) {
    const page = pages.find(p => norm(p.text).includes(norm(quote)));
    if (!page) { fail(slug, `quote "${key}" is not in the application: "${quote}"`); continue; }
    const c: Claim = { id: page.page === formPage ? `f${++f}` : `d${++d}`, metric: key, value: "", quote, page: page.page };
    const why = validateClaim(c, pages); if (why) { fail(slug, `quote "${key}": ${why}`); continue; }
    claims.push(c); idOf[key] = c.id!;
  }
  const out = { slug, scores: {} as Record<string, number>, confidence: {} as Record<string, "high" | "med" | "low">, rationale: {} as Record<string, string>, gaps: {} as Record<string, string> };
  for (const k of Object.keys(CRITERIA)) {
    const s = e.scores[k]; if (!s) { fail(slug, `no score for ${k}`); continue; }
    const ids = (s.cite ?? []).map(c => { if (!idOf[c]) fail(slug, `${k} cites an unknown or missing quote "${c}"`); return idOf[c]; }).filter(Boolean);
    const why = validateScore({ criterion: k, score: s.score, confidence: s.confidence, claim_ids: ids, rationale: s.why, gap: s.gap });
    if (why) fail(slug, `${k}: ${why}`);
    if ((s.confidence as string) === "high") fail(slug, `${k}: nothing was verified on the web, so confidence cannot be high`);
    out.scores[k] = s.score; out.confidence[k] = s.confidence; out.rationale[k] = s.why; if (s.gap) out.gaps[k] = s.gap;
  }
  if (problems === before) saveScored({ ...out, claims, rubricVersion: loadConfig().version, promptVersion: 0, model: `${file.scoredBy} (not the app's model route)`, scoredAt: new Date().toISOString(), corrections: 0, memos: 0 });
  await researchApplication({ slug, company: meta.company, sector: meta.sector, form, deck }, { search: null, fetch: webFetch, ctx: null });   // records "not checked on the web"
  console.log(`${meta.company.padEnd(12)} claims ${claims.length}  scores ${Object.values(out.scores).join(" ")}`);
}
if (problems) { console.error(`\n${problems} problem(s). Fix seed/scores/claude-session.json and run again.`); process.exit(1); }
console.log("\nAll scores passed the app's own rules.");
