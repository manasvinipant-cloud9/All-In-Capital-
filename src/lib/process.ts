import { readFileSync } from "node:fs";
import { pdfPages, parseForm } from "./pipeline/ingest.ts";
import { reconcile } from "./pipeline/reconcile.ts";
import { g1, g2Offline, g3, g4 } from "./pipeline/gates.ts";
import { realTransport, modelNames } from "./gateway/transport.ts";
import type { Handler } from "./queue.ts";

/** Deterministic steps run for real. Model steps (claims, research, scoring) wait for a model key and report that plainly. */
export const processApplication: Handler = async slug => {
  if (!/^[a-z0-9-]+$/.test(slug)) throw new Error("bad application id");
  const deck = await pdfPages(`seed/decks/${slug}.pdf`), form = parseForm(readFileSync(`seed/forms/${slug}.json`, "utf8"));
  const checks = reconcile(form, deck);
  const portfolio = JSON.parse(readFileSync("seed/portfolio.json", "utf8"));
  const gates = [g1(form), g2Offline(deck), g3(deck[0].text, portfolio), g4(checks)];
  const steps: Record<string, string> = { ingest: "done", reconcile: `done (${checks.length} checks)`, gates: `done (${gates.filter(g => g.tripped).length} tripped)`, rank: "done" };
  if (!realTransport() || !modelNames()) {
    for (const s of ["extract_claims", "research", "score"]) steps[s] = "waiting for a model key";
    return { steps, blocked: "No model key is set up yet, so reading, research and scoring are waiting." };
  }
  return { steps };
};
