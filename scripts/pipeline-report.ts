// Runs the deterministic steps (ingest, reconcile, G1-G4, rank) on all 10 seed applications and writes docs/PHASE2_REPORT.md.
import { readFileSync, writeFileSync } from "node:fs";
import { pdfPages, parseForm } from "../src/lib/pipeline/ingest.ts";
import { reconcile } from "../src/lib/pipeline/reconcile.ts";
import { g1, g2Offline, g3, g4 } from "../src/lib/pipeline/gates.ts";
import { APPS } from "./seed/apps.ts";

const portfolio = JSON.parse(readFileSync("seed/portfolio.json", "utf8"));
let md = "# Phase 2 report: deterministic steps on the 10 seed applications\nModel-backed steps (claim extraction, research, G2 model check, scoring) need a model key and were tested with a mock transport only. Run with `pnpm tsx scripts/pipeline-report.ts`.\n\n| App | Trap planted | Gates tripped | Checks |\n|---|---|---|---|\n";
for (const a of APPS) {
  const deck = await pdfPages(`seed/decks/${a.slug}.pdf`);
  const form = parseForm(readFileSync(`seed/forms/${a.slug}.json`, "utf8"));
  const checks = reconcile(form, deck);
  const appText = `${deck[0].text} ${form["Product"] ?? ""}`;
  const gates = [g1(form), g2Offline(deck), g3(appText, portfolio), g4(checks)];
  md += `| ${a.company} | ${a.trap} | ${gates.filter(g => g.tripped).map(g => g.gate).join(", ") || "none"} | ${checks.map(c => `${c.severity}: ${c.name} (${c.formula})`).join("<br>") || "none"} |\n`;
  md += "";
}
writeFileSync("docs/PHASE2_REPORT.md", md);
console.log(md);
