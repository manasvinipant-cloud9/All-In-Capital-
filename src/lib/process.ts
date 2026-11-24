import { reconcile } from "./pipeline/reconcile.ts";
import { describe, g1, g2Offline, g3, g4 } from "./pipeline/gates.ts";
import { scoreApplication } from "./pipeline/score.ts";
import { realTransport, modelNames } from "./gateway/transport.ts";
import { loadConfig } from "./config.ts";
import { loadFiles, validSlug } from "./apps.ts";
import { getPortfolio } from "./seedData.ts";
import { researchApplication } from "./research/run.ts";
import { searchPort, webFetch, type FetchPort, type SearchPort } from "./research/web.ts";
import type { Research } from "./research/store.ts";
import type { Transport } from "./gateway/index.ts";
import type { Handler } from "./queue.ts";

export type Deps = { transport?: Transport | null; names?: { primary: string; fallback: string } | null; search?: SearchPort | null; fetch?: FetchPort };

/**
 * Deterministic steps always run. With a model, claims are extracted and each criterion is scored and saved.
 * Without one, those steps report plainly that they are waiting for a model key (blocked, not failed).
 */
export function makeProcessor(deps: Deps = {}): Handler {
  return async slug => {
    if (!validSlug(slug)) throw new Error("bad application id");
    const { meta, deck, form } = await loadFiles(slug);
    const checks = reconcile(form, deck), portfolio = getPortfolio();
    const gates = [g1(form, loadConfig().fund), g2Offline(deck), g3(describe(form, deck), portfolio), g4(checks)];
    const steps: Record<string, string> = { ingest: "done", reconcile: `done (${checks.length} checks)`, gates: `done (${gates.filter(g => g.tripped).length} tripped)`, rank: "done" };
    const transport = "transport" in deps ? deps.transport : realTransport(), names = "names" in deps ? deps.names : modelNames();
    if (!transport || !names) {
      for (const s of ["extract_claims", "research", "score"]) steps[s] = "waiting for a model key";
      return { steps, blocked: "No model key is set up yet, so reading, research and scoring are waiting." };
    }
    // Research is helpful but never required: if it fails, scoring goes on and says the backgrounds are not verified.
    let research: Research | null = null;
    try {
      research = await researchApplication({ slug, company: meta.company, sector: meta.sector, form, deck }, { search: "search" in deps ? deps.search ?? null : searchPort(), fetch: deps.fetch ?? webFetch, ctx: { transport, ...names } });
      steps.research = research.available ? `done (${research.facts.length} facts from ${research.pages.filter(p => p.status === "used").length} pages, ${research.queries.length} queries)` : "not run: no search key, backgrounds are not verified";
    } catch (e: any) { steps.research = `failed, scoring went on without it: ${String(e?.message ?? e).slice(0, 80)}`; }
    const scored = await scoreApplication({ slug, company: meta.company, sector: meta.sector, form, deck, checks, gates }, { transport, ...names }, research);
    steps.extract_claims = `done (${scored.claims.length} claims)`; steps.score = "done";
    return { steps };
  };
}
export const processApplication = makeProcessor();
