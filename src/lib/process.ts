import { readFileSync } from "node:fs";
import { pdfPages, parseForm } from "./pipeline/ingest.ts";
import { reconcile } from "./pipeline/reconcile.ts";
import { g1, g2Offline, g3, g4 } from "./pipeline/gates.ts";
import { scoreApplication } from "./pipeline/score.ts";
import { realTransport, modelNames } from "./gateway/transport.ts";
import { loadConfig } from "./config.ts";
import { APPS } from "../../scripts/seed/apps.ts";
import type { Transport } from "./gateway/index.ts";
import type { Handler } from "./queue.ts";

export type Deps = { transport?: Transport | null; names?: { primary: string; fallback: string } | null };

/**
 * Deterministic steps always run. With a model, claims are extracted and each criterion is scored and saved.
 * Without one, those steps report plainly that they are waiting for a model key (blocked, not failed).
 */
export function makeProcessor(deps: Deps = {}): Handler {
  return async slug => {
    if (!/^[a-z0-9-]+$/.test(slug)) throw new Error("bad application id");
    const meta = APPS.find(a => a.slug === slug); if (!meta) throw new Error("unknown application");
    const deck = await pdfPages(`seed/decks/${slug}.pdf`), form = parseForm(readFileSync(`seed/forms/${slug}.json`, "utf8"));
    const checks = reconcile(form, deck), portfolio = JSON.parse(readFileSync("seed/portfolio.json", "utf8"));
    const gates = [g1(form, loadConfig().fund), g2Offline(deck), g3(deck[0].text, portfolio), g4(checks)];
    const steps: Record<string, string> = { ingest: "done", reconcile: `done (${checks.length} checks)`, gates: `done (${gates.filter(g => g.tripped).length} tripped)`, rank: "done" };
    const transport = "transport" in deps ? deps.transport : realTransport(), names = "names" in deps ? deps.names : modelNames();
    if (!transport || !names) {
      for (const s of ["extract_claims", "research", "score"]) steps[s] = "waiting for a model key";
      return { steps, blocked: "No model key is set up yet, so reading, research and scoring are waiting." };
    }
    const scored = await scoreApplication({ slug, company: meta.company, sector: meta.sector, form, deck, checks, gates }, { transport, ...names });
    steps.extract_claims = `done (${scored.claims.length} claims)`; steps.score = "done"; steps.research = "not built yet";
    return { steps };
  };
}
export const processApplication = makeProcessor();
